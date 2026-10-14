// =============================================================================
// InviteCode — Багш шавиа нэмэх систем
// TeacherInvitePanel: багш код үүсгэнэ
// ParentLinkPanel: эцэг эх код оруулна
// Харагдац: docs/BRAND.md (invite card = --bg-soft, код = .t-stat, lucide icon)
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleCheck, Copy, GraduationCap, Link } from "lucide-react";
import { InviteCodeError } from "../lib/firebase";

// -----------------------------------------------------------------------------
// Багшийн тал — код үүсгэх
// -----------------------------------------------------------------------------

export interface TeacherInvitePanelProps {
  teacherId: string;
  teacherName: string;
  onCreateCode: (teacherId: string, teacherName: string) => Promise<string>;
}

export function TeacherInvitePanel({ teacherId, teacherName, onCreateCode }: TeacherInvitePanelProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      const newCode = await onCreateCode(teacherId, teacherName);
      setCode(newCode);
    } catch (e) {
      console.error("invite code create failed:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="cs-card-soft p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="cs-badge cs-badge-primary"><GraduationCap size={18} strokeWidth={2} /></span>
        <div className="min-w-0">
          <h3 className="t-h2">{t("invite.teacher.heading")}</h3>
          <p className="t-caption mt-0.5">{t("invite.teacher.subtitle")}</p>
        </div>
      </div>

      {!code ? (
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="cs-btn cs-btn-primary w-full"
        >
          {loading ? t("invite.teacher.creating") : t("invite.teacher.createButton")}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="cs-card p-4 text-center">
            <p className="t-label">{t("invite.teacher.codeLabel")}</p>
            <p className="t-stat text-primary tracking-[0.2em] mt-2" style={{ fontSize: 32 }}>{code}</p>
            <p className="t-caption mt-2">{t("invite.teacher.codeExpiry")}</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`cs-btn w-full ${copied ? "cs-btn-primary" : "cs-btn-outline"}`}
          >
            {copied ? <Check size={18} strokeWidth={2.5} /> : <Copy size={18} strokeWidth={2} />}
            {copied ? t("invite.teacher.copied") : t("invite.teacher.copyButton")}
          </button>
          <button
            type="button"
            onClick={() => setCode(null)}
            className="cs-btn cs-btn-ghost cs-btn-sm w-full"
          >
            {t("invite.teacher.newCode")}
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Эцэг эхийн тал — код оруулах
// -----------------------------------------------------------------------------

export interface ParentLinkPanelProps {
  childId: string;
  childName: string;
  onUseCode: (code: string, childId: string) => Promise<unknown>;
}

export function ParentLinkPanel({ childId, childName, onUseCode }: ParentLinkPanelProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    if (code.trim().length !== 6) {
      setError(t("invite.parent.errors.length"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onUseCode(code.trim().toUpperCase(), childId);
      setSuccess(t("invite.parent.success"));
      setCode("");
    } catch (e) {
      const code = e instanceof InviteCodeError ? e.code : "unknown";
      if (code === "used") setError(t("invite.parent.errors.used"));
      else if (code === "expired") setError(t("invite.parent.errors.expired"));
      else if (code === "child_not_found") setError(t("invite.parent.errors.notFound"));
      else setError(t("invite.parent.errors.invalid")); // not_found / permission / network
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cs-card-soft p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="cs-badge cs-badge-primary"><Link size={18} strokeWidth={2} /></span>
        <div className="min-w-0">
          <h3 className="t-h2">{t("invite.parent.heading")}</h3>
          <p className="t-caption mt-0.5">{t("invite.parent.subtitle", { name: childName })}</p>
        </div>
      </div>

      {success ? (
        <div className="cs-card p-4 text-center">
          <span className="cs-badge cs-badge-primary mx-auto mb-2"><CircleCheck size={20} strokeWidth={2.2} /></span>
          <p className="t-body-strong text-primary-soft-ink">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="cs-btn cs-btn-ghost cs-btn-sm mt-2"
          >
            {t("invite.parent.reconnect")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().slice(0, 6));
              setError(null);
            }}
            placeholder={t("invite.parent.placeholder")}
            maxLength={6}
            aria-invalid={error ? "true" : undefined}
            className="cs-input text-center text-[20px] font-extrabold tracking-[0.2em] uppercase tabular-nums"
          />
          {error && <p className="t-caption text-error text-center" role="alert">{error}</p>}
          <button
            type="button"
            onClick={handleLink}
            disabled={loading || code.trim().length !== 6}
            className="cs-btn cs-btn-primary w-full"
          >
            {loading ? t("invite.parent.connecting") : t("invite.parent.connectButton")}
          </button>
        </div>
      )}
    </div>
  );
}
