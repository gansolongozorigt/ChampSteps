// =============================================================================
// AccountSettingsModal — the signed-in account (e-mail, role, plan) with a
// Danger zone: delete the whole account. Parents and teachers both get it.
// Confirmation = typing the e-mail exactly; the server verifies it again.
// UI: brand tokens (docs/BRAND.md); error colour on the buttons only.
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileJson, Loader2, TriangleAlert } from "lucide-react";
import { buildUserExport, downloadJson, downloadZip, type ZipProgress } from "../lib/exportFetch";
import { exportFilename } from "../lib/exportData";
import type { AppUser } from "../lib/auth";
import { daysLeft, isActive, type SubscriptionInfo } from "../lib/subscription";
import { PLANS } from "../../shared/plans.js";
import ReminderSettings from "./ReminderSettings";

interface Props {
  user: AppUser;
  subscriptionInfo: SubscriptionInfo;
  childrenCount: number;
  onClose: () => void;
  /** Resolves once the account is gone (caller signs out); rejects with a message to show. */
  onDeleteAccount: () => Promise<void>;
  /** Opens the iOS "Add to Home Screen" guide (reminders need the installed app on iOS). */
  onShowInstall?: () => void;
}

export default function AccountSettingsModal({ user, subscriptionInfo, childrenCount, onClose, onDeleteAccount, onShowInstall }: Props) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<"settings" | "confirm">("settings");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "My data" export: json | zip while running, plus a status line
  const [exporting, setExporting] = useState<"json" | "zip" | null>(null);
  const [exportMsg, setExportMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);

  const email = user.email.trim();
  const matches = typed.trim().toLowerCase() === email.toLowerCase() && email.length > 0;
  const lang = (i18n.language?.slice(0, 2) === "en" ? "en" : i18n.language?.slice(0, 2) === "ru" ? "ru" : "mn") as "mn" | "en" | "ru";
  const planActive = isActive(subscriptionInfo);
  const days = daysLeft(subscriptionInfo);
  const planLabel = PLANS[subscriptionInfo.tier]?.label[lang] ?? subscriptionInfo.tier;
  const roleLabel = user.role === "teacher" ? t("login.teacher") : t("login.parent");

  async function exportData(kind: "json" | "zip") {
    if (exporting) return;
    setExporting(kind);
    setExportMsg(null);
    setZipProgress(null);
    try {
      const file = await buildUserExport(user);
      if (kind === "json") {
        downloadJson(file);
        setExportMsg({ kind: "info", text: t("myData.done", { file: exportFilename(new Date(file.exportedAt), "json") }) });
      } else {
        const r = await downloadZip(file, setZipProgress);
        if (!r.ok) setExportMsg({ kind: "error", text: t("myData.tooBig", { count: file.images.length }) });
        else if (r.missing > 0) setExportMsg({ kind: "info", text: t("myData.doneMissing", { count: r.missing }) });
        else setExportMsg({ kind: "info", text: t("myData.done", { file: exportFilename(new Date(file.exportedAt), "zip") }) });
      }
    } catch (e) {
      console.error("[champstep] export failed:", e);
      setExportMsg({ kind: "error", text: t("myData.error") });
    } finally {
      setExporting(null);
      setZipProgress(null);
    }
  }

  async function confirm() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onDeleteAccount();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("danger.account.error"));
      setDeleting(false);
    }
  }

  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={deleting ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          {step === "settings" ? (
            <>
              <header>
                <p className="t-caption">{user.displayName}</p>
                <h2 id="account-title" className="t-h1 mt-1">{t("danger.account.heading")}</h2>
              </header>

              <dl className="mt-5 divide-y divide-line rounded-card border border-line">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="t-caption">{t("auth.email")}</dt>
                  <dd className="t-body-strong text-ink truncate">{email || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="t-caption">{t("danger.account.role")}</dt>
                  <dd className="t-body-strong text-ink">{roleLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="t-caption">{t("sub.currentPlan")}</dt>
                  <dd className="t-body-strong text-ink">
                    {planLabel}
                    {planActive && days !== null && <span className="t-caption ml-1">· {t("sub.daysLeft", { days })}</span>}
                  </dd>
                </div>
              </dl>

              <ReminderSettings user={user} onShowInstall={() => onShowInstall?.()} />

              <section className="mt-6 border-t border-line pt-5" aria-labelledby="account-mydata" data-testid="my-data">
                <h3 id="account-mydata" className="t-h2">{t("myData.title")}</h3>
                <p className="t-caption mt-1">{t("myData.desc")}</p>
                {user.role === "teacher" && <p className="t-caption mt-1">{t("myData.teacherNote")}</p>}
                {user.isOffline && <p className="t-caption mt-1">{t("myData.guestNote")}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void exportData("json")} disabled={exporting !== null} className="cs-btn cs-btn-outline" data-testid="export-json">
                    {exporting === "json" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileJson size={16} aria-hidden="true" />}
                    {t("myData.json")}
                  </button>
                  {user.role !== "teacher" && !user.isOffline && (
                    <button type="button" onClick={() => void exportData("zip")} disabled={exporting !== null} className="cs-btn cs-btn-outline" data-testid="export-zip">
                      {exporting === "zip" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                      {t("myData.zip")}
                    </button>
                  )}
                </div>
                {zipProgress && zipProgress.total > 0 && (
                  <p className="t-caption mt-2" role="status">{t("myData.progress", { done: zipProgress.done, total: zipProgress.total })}</p>
                )}
                {exportMsg && (
                  <p className={`mt-2 t-caption ${exportMsg.kind === "error" ? "text-error" : "text-primary"}`} role="status" data-testid="export-status">{exportMsg.text}</p>
                )}
              </section>

              <section className="mt-6 border-t border-line pt-5" aria-labelledby="account-danger">
                <h3 id="account-danger" className="t-h2">{t("danger.zoneTitle")}</h3>
                <p className="t-caption mt-1">
                  {user.role === "teacher" ? t("danger.account.summaryTeacher") : t("danger.account.summaryParent", { children: childrenCount })}
                </p>
                <button type="button" onClick={() => setStep("confirm")} className="cs-btn cs-btn-outline mt-4 border-error text-error hover:bg-error-soft" data-testid="account-delete-open">
                  {t("danger.account.button")}
                </button>
              </section>

              <div className="mt-6 flex justify-end pb-[env(safe-area-inset-bottom)]">
                <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost">{t("sub.close")}</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-soft text-error" aria-hidden="true">
                  <TriangleAlert size={20} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h2 id="account-title" className="t-h1">{t("danger.account.title")}</h2>
                  <p className="t-body text-ink-2 mt-2">
                    {user.role === "teacher" ? t("danger.account.summaryTeacher") : t("danger.account.summaryParent", { children: childrenCount })}
                  </p>
                  {planActive && days !== null && days > 0 && (
                    <p className="mt-3 rounded-input bg-warn-soft px-3 py-2 text-[13px] font-semibold text-warn" role="note">
                      {t("danger.account.planWarning", { days, plan: planLabel })}
                    </p>
                  )}
                </div>
              </div>

              <label className="mt-5 block">
                <span className="cs-field-label">{t("danger.account.typeEmail", { email })}</span>
                <input
                  type="email"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void confirm(); }}
                  disabled={deleting}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="cs-input"
                  data-testid="account-delete-email"
                />
              </label>

              {error && (
                <p className="mt-3 rounded-input bg-error-soft px-3 py-2 text-[13px] font-semibold text-error" role="alert">{error}</p>
              )}

              <div className="mt-6 flex items-center justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
                <button type="button" onClick={() => { setStep("settings"); setTyped(""); setError(null); }} disabled={deleting} className="cs-btn cs-btn-ghost">
                  {t("danger.cancel")}
                </button>
                <button type="button" onClick={() => void confirm()} disabled={!matches || deleting} className="cs-btn cs-btn-danger min-w-[120px]" data-testid="account-delete-confirm">
                  {deleting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      {t("danger.account.deleting")}
                    </span>
                  ) : t("danger.account.confirm")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
