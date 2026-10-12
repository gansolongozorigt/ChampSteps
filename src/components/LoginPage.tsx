// =============================================================================
// LoginPage v3 — багш / эцэг эх role сонголттой (brand tokens, docs/BRAND.md)
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, Users, type LucideIcon } from "lucide-react";
import Logo from "./Logo";
import LanguageToggle from "./LanguageToggle";
import { useAuth } from "../lib/auth";
import { isFirebaseConfigured, sendPasswordReset } from "../lib/firebase";
import type { UserRole } from "../types";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { signIn, signUp, signInWithGoogle, signInOffline } = useAuth();
  const [info, setInfo] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<UserRole>("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, displayName.trim() || t("auth.defaultName"), role);
      }
    } catch (err) {
      setError(mapAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle(role);
    } catch (err) {
      setError(mapAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot() {
    setError(null);
    setInfo(null);
    if (!email.trim()) { setError(t("auth.resetEnterEmail")); return; }
    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim(), i18n.language ?? "mn");
      setInfo(t("auth.resetSent"));
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      // Never reveal whether the e-mail exists.
      if (code.includes("user-not-found")) setInfo(t("auth.resetSent"));
      else setError(mapAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }
  function handleOffline() {
    signInOffline(displayName.trim() || undefined, role);
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg font-sans text-ink">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6">
        <Logo size={40} />
        <LanguageToggle />
      </header>

      <main className="flex flex-grow items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md">
          {/* Title */}
          <div className="mb-6 text-center">
            <h1 className="t-h1 sm:text-[26px]">
              {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
            </h1>
            <p className="mt-2 t-body text-ink-2">{t("auth.subtitle")}</p>
          </div>

          <div className="cs-card p-6">

            {/* Role сонголт — зөвхөн signup-д */}
            {(
              <div className="mb-5">
                <p className="t-label mb-2">
                  {t("login.whoAreYou")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <RoleButton
                    selected={role === "parent"}
                    onClick={() => setRole("parent")}
                    Icon={Users}
                    label={t("login.parent")}
                    desc={t("login.parentDesc")}
                  />
                  <RoleButton
                    selected={role === "teacher"}
                    onClick={() => setRole("teacher")}
                    Icon={GraduationCap}
                    label={t("login.teacher")}
                    desc={t("login.teacherDesc")}
                  />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <Field
                  id="displayName"
                  label={t("auth.name")}
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder={role === "teacher" ? t("auth.teacherNamePlaceholder") : t("auth.namePlaceholder")}
                />
              )}

              <Field
                id="email"
                type="email"
                label={t("auth.email")}
                value={email}
                onChange={setEmail}
                placeholder="name@email.com"
                required
                autoComplete="email"
              />

              <Field
                id="password"
                type="password"
                label={t("auth.password")}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
              />

              {mode === "signin" && (
                <button type="button" onClick={handleForgot} disabled={submitting || !isFirebaseConfigured} className="-mt-1 min-h-[44px] px-1 text-[13px] font-bold text-primary hover:text-primary-hover hover:underline underline-offset-2 disabled:opacity-50">
                  {t("auth.forgotPassword")}
                </button>
              )}
              {info && (
                <div className="rounded-input bg-primary-soft px-3 py-2.5 text-[13px] font-semibold text-primary-soft-ink" role="status">{info}</div>
              )}
              {error && (
                <div className="rounded-input bg-error-soft px-3 py-2.5 text-[13px] font-semibold text-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !isFirebaseConfigured}
                className="cs-btn cs-btn-primary w-full"
              >
                {submitting
                  ? t("auth.submitting")
                  : mode === "signin"
                  ? t("auth.signIn")
                  : t("auth.signUp")}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-grow bg-line" />
              <span className="t-caption">{t("auth.or")}</span>
              <div className="h-px flex-grow bg-line" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting || !isFirebaseConfigured}
              className="cs-btn cs-btn-outline w-full"
            >
              <GoogleIcon />
              {t("auth.signInGoogle")}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-3 w-full min-h-[44px] text-center text-[13px] font-bold text-ink-2 hover:text-primary"
            >
              {mode === "signin" ? t("auth.toggleToSignup") : t("auth.toggleToSignin")}
            </button>
          </div>

          {/* Offline */}
          <div className="mt-6 rounded-card border border-dashed border-line-strong bg-bg-soft p-4 text-center">
            <p className="t-caption">
              {isFirebaseConfigured ? t("auth.offlineHint") : t("auth.firebaseNotConfigured")}
            </p>
            <button
              type="button"
              onClick={handleOffline}
              className="mt-1 min-h-[44px] text-[13px] font-bold text-ink underline underline-offset-2 hover:text-primary"
            >
              {t("auth.continueOffline")}
            </button>
          </div>
        </div>
      </main>

      <footer className="pb-[calc(1rem+env(safe-area-inset-bottom))] text-center t-caption">
        © {new Date().getFullYear()} ChampStep
      </footer>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Role button
// -----------------------------------------------------------------------------

function RoleButton({
  selected,
  onClick,
  Icon,
  label,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  Icon: LucideIcon;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`cs-card flex min-h-[44px] flex-col items-start gap-1.5 p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary-soft"
          : "hover:bg-bg-soft"
      }`}
    >
      <span className={`cs-badge ${selected ? "bg-primary text-white" : "cs-badge-primary"}`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className={`text-[14px] font-extrabold ${selected ? "text-primary-soft-ink" : "text-ink"}`}>
        {label}
      </span>
      <span className="text-[11px] font-semibold leading-snug text-ink-3">{desc}</span>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Field
// -----------------------------------------------------------------------------

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}

function Field({ id, label, value, onChange, placeholder, type = "text", required, autoComplete, minLength }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="cs-field-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="cs-input"
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Google icon
// -----------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2a10.34 10.34 0 0 0-.15-1.77H9v3.34h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.55z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.87-3.06.87-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.95 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.71V4.96H.9A9 9 0 0 0 0 9c0 1.45.35 2.82.9 4.04l3.05-2.33z" fill="#FBBC05"/>
      <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .9 4.96l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Auth error mapping
// -----------------------------------------------------------------------------

function mapAuthError(err: unknown, t: (k: string) => string): string {
  const code = (err as { code?: string })?.code ?? "";
  const msg = (err as { message?: string })?.message ?? "";
  if (msg === "auth.errors.notConfigured") return t("auth.errors.notConfigured");
  if (code.includes("invalid-email")) return t("auth.errors.invalidEmail");
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential"))
    return t("auth.errors.invalidCredentials");
  if (code.includes("email-already-in-use")) return t("auth.errors.emailInUse");
  if (code.includes("weak-password")) return t("auth.errors.weakPassword");
  if (code.includes("network")) return t("auth.errors.network");
  if (code.includes("popup-closed")) return t("auth.errors.popupClosed");
  return `${t("auth.errors.generic")} [${code}]`;
}