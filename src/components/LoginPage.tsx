// =============================================================================
// LoginPage — Shown when no user is signed in.
// Supports: email/password sign-in, sign-up, Google sign-in, offline mode.
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";

import LanguageToggle from "./LanguageToggle";
import { useAuth } from "../lib/auth";
import { isFirebaseConfigured } from "../lib/firebase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { t } = useTranslation();
  const { signIn, signUp, signInWithGoogle, signInOffline } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
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
        await signUp(email.trim(), password, displayName.trim() || undefined);
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
      await signInWithGoogle();
    } catch (err) {
      setError(mapAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  function handleOffline() {
    signInOffline(displayName.trim() || undefined);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-stone-50 to-amber-50 font-sans">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-stone-900">
            <span className="text-sm font-bold text-white">C</span>
          </div>
          <span className="font-bold tracking-tight text-stone-900">ChampStep</span>
        </div>
        <LanguageToggle />
      </header>

      <main className="flex flex-grow items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-2xl font-bold text-stone-900 sm:text-3xl">
              {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
            </h1>
            <p className="mt-2 text-sm text-stone-500">{t("auth.subtitle")}</p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <Field
                  id="displayName"
                  label={t("auth.name")}
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder={t("auth.namePlaceholder") as string}
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

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !isFirebaseConfigured}
                className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {submitting
                  ? t("auth.submitting")
                  : mode === "signin"
                  ? t("auth.signIn")
                  : t("auth.signUp")}
              </button>
            </form>

            <div className="my-4 flex items-center gap-2">
              <div className="h-px flex-grow bg-stone-200" />
              <span className="text-xs text-stone-400">{t("auth.or")}</span>
              <div className="h-px flex-grow bg-stone-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting || !isFirebaseConfigured}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
            >
              <GoogleIcon />
              {t("auth.signInGoogle")}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-4 w-full text-center text-xs text-stone-500 hover:text-stone-800"
            >
              {mode === "signin" ? t("auth.toggleToSignup") : t("auth.toggleToSignin")}
            </button>
          </div>

          {/* Offline mode — shown only when Firebase is not configured OR user wants to try the app first. */}
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white/70 p-4 text-center">
            <p className="text-xs text-stone-500">
              {isFirebaseConfigured ? t("auth.offlineHint") : t("auth.firebaseNotConfigured")}
            </p>
            <button
              type="button"
              onClick={handleOffline}
              className="mt-2 text-sm font-medium text-stone-800 underline underline-offset-2 hover:text-amber-700"
            >
              {t("auth.continueOffline")}
            </button>
          </div>
        </div>
      </main>

      <footer className="pb-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} ChampStep
      </footer>
    </div>
  );
}

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

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  autoComplete,
  minLength,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-stone-600">
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
        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 transition focus:border-stone-900 focus:bg-white focus:outline-none"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2a10.34 10.34 0 0 0-.15-1.77H9v3.34h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.55z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.87-3.06.87-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.71V4.96H.9A9 9 0 0 0 0 9c0 1.45.35 2.82.9 4.04l3.05-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .9 4.96l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Map Firebase errors to user-friendly i18n keys.
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
  return t("auth.errors.generic");
}
