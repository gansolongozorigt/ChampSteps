// =============================================================================
// ReminderSettings — "Сануулга" section of the account settings modal.
// Two toggles (daily 20:00, day-before-competition) stored in users/{uid}.reminders
// (client-writable field). Turning the first one on asks for notification
// permission from THIS tap (never automatically) and registers the FCM token
// through /api/push/register (src/lib/push.ts). iOS browser tab → install hint.
// =============================================================================

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing, Download, Loader2 } from "lucide-react";
import type { AppUser } from "../lib/auth";
import { currentIdToken, getReminderPrefs, setReminderPrefs, type ReminderPrefs } from "../lib/firebase";
import { disablePush, enablePush, pushState, storedPushToken } from "../lib/push";
import { canPromptInstall, onInstallPromptChange, promptInstall } from "../lib/install";
import { isNative } from "../lib/platform";
import { nativeDisablePush, nativeEnablePush, nativePushState, storedNativeToken } from "../lib/nativePush";

interface Props {
  user: AppUser;
  /** Opens the iOS "Add to Home Screen" guide (InstallGuideModal). */
  onShowInstall: () => void;
}

type Note = { kind: "info" | "error"; text: string; install?: boolean } | null;

export default function ReminderSettings({ user, onShowInstall }: Props) {
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null);
  const [busy, setBusy] = useState<keyof ReminderPrefs | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [canInstall, setCanInstall] = useState(canPromptInstall());

  useEffect(() => onInstallPromptChange(() => setCanInstall(canPromptInstall())), []);
  useEffect(() => {
    if (user.isOffline) return;
    let alive = true;
    getReminderPrefs(user.uid).then((p) => { if (alive) setPrefs(p); }).catch(() => { if (alive) setPrefs({ daily: false, competition: false }); });
    return () => { alive = false; };
  }, [user.uid, user.isOffline]);

  if (user.role !== "parent") return null;

  async function toggle(key: keyof ReminderPrefs) {
    if (!prefs || busy) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setNote(null);
    setBusy(key);
    try {
      if (next[key] && !(isNative ? storedNativeToken() : storedPushToken())) {
        const r = isNative ? await nativeEnablePush(currentIdToken, i18n.language) : await enablePush(currentIdToken, i18n.language);
        if (!r.ok) {
          if (r.reason === "not-configured" && isNative) setNote({ kind: "info", text: t("reminders.iosPushLater") });
          else if (r.reason === "ios-not-installed") setNote({ kind: "info", text: t("reminders.installFirst"), install: true });
          else if (r.reason === "denied") setNote({ kind: "error", text: t("reminders.denied") });
          else if (r.reason === "unsupported") setNote({ kind: "error", text: t("reminders.unsupported") });
          else if (r.reason === "not-configured") setNote({ kind: "error", text: t("reminders.notConfigured") });
          else if (r.reason === "permission-dismissed") setNote({ kind: "info", text: t("reminders.dismissed") });
          else setNote({ kind: "error", text: t("reminders.error") });
          return;
        }
      }
      await setReminderPrefs(user.uid, next);
      setPrefs(next);
      if (!next.daily && !next.competition) await (isNative ? nativeDisablePush(currentIdToken) : disablePush(currentIdToken));
    } catch (e) {
      console.warn("[reminders] toggle failed:", e);
      setNote({ kind: "error", text: t("reminders.error") });
    } finally {
      setBusy(null);
    }
  }

  const state = isNative ? nativePushState() : pushState();

  return (
    <section className="mt-6 border-t border-line pt-5" aria-labelledby="account-reminders" data-testid="reminder-settings">
      <h3 id="account-reminders" className="t-h2 inline-flex items-center gap-2"><BellRing size={18} strokeWidth={2.2} aria-hidden />{t("reminders.title")}</h3>
      <p className="t-caption mt-1">{t("reminders.desc")}</p>
      {user.isOffline ? (
        <p className="t-caption mt-2">{t("reminders.guestNote")}</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            <ToggleRow id="rem-daily" label={t("reminders.daily")} hint={t("reminders.dailyHint")} checked={!!prefs?.daily} busy={busy === "daily"} disabled={!prefs || !!busy} onChange={() => void toggle("daily")} />
            <ToggleRow id="rem-competition" label={t("reminders.competition")} hint={t("reminders.competitionHint")} checked={!!prefs?.competition} busy={busy === "competition"} disabled={!prefs || !!busy} onChange={() => void toggle("competition")} />
          </div>
          <p className="t-caption mt-2">{t("reminders.timeNote")}</p>
          {state === "not-configured" && !note && <p className="t-caption mt-1 text-warn">{isNative ? t("reminders.iosPushLater") : t("reminders.notConfigured")}</p>}
          {note && (
            <div role="status" className={`mt-3 rounded-input px-3 py-2 t-caption ${note.kind === "error" ? "bg-error-soft text-error" : "bg-bg-soft text-ink-2"}`} data-testid="reminder-note">
              <p>{note.text}</p>
              {note.install && (
                <button type="button" onClick={onShowInstall} className="mt-1 font-bold text-primary underline-offset-2 hover:underline">{t("reminders.howToInstall")}</button>
              )}
            </div>
          )}
          {canInstall && !isNative && (
            <button type="button" onClick={() => void promptInstall().then(() => setCanInstall(canPromptInstall()))} className="cs-btn cs-btn-outline cs-btn-sm mt-3">
              <Download size={16} aria-hidden />{t("reminders.installApp")}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ToggleRow({ id, label, hint, checked, busy, disabled, onChange }: { id: string; label: string; hint: string; checked: boolean; busy: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="t-body-strong text-ink block">{label}</span>
        <span className="t-caption block">{hint}</span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-60 ${checked ? "bg-primary" : "bg-line-strong"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform flex items-center justify-center ${checked ? "translate-x-5" : ""}`}>
          {busy && <Loader2 size={14} className="animate-spin text-ink-3" aria-hidden />}
        </span>
      </button>
    </div>
  );
}
