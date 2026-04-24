// =============================================================================
// SubscriptionModal — Paywall with a QPay-style flow.
// This is a UI skeleton: in production, `createOrder()` should hit a Cloud
// Function that creates a real QPay invoice, and the webhook flips the user
// doc to `subscriptionStatus: premium`. Here we simulate with a 2s timer and
// call `activateSubscription()` directly so the app can be demoed.
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../lib/auth";

type Step = "compare" | "pay" | "success";

export default function SubscriptionModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { subscription, activateSubscription } = useAuth();

  const [step, setStep] = useState<Step>(subscription === "premium" ? "success" : "compare");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    setProcessing(true);
    try {
      // Simulate QPay scan + bank processing.
      await new Promise((r) => setTimeout(r, 1800));
      await activateSubscription();
      setStep("success");
    } catch (e) {
      console.error("[champstep] activateSubscription failed:", e);
      setError(t("subscription.errors.activate"));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-2 backdrop-blur-sm sm:items-center sm:p-4 print:hidden"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <h2 className="font-serif text-lg font-bold text-stone-900">
            {t("subscription.heading")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700"
            aria-label={t("subscription.close")}
          >
            ✕
          </button>
        </header>

        {step === "compare" && <CompareStep onContinue={() => setStep("pay")} />}
        {step === "pay" && (
          <PayStep processing={processing} error={error} onPay={handlePay} onBack={() => setStep("compare")} />
        )}
        {step === "success" && <SuccessStep onClose={onClose} />}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------

function CompareStep({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const { subscription } = useAuth();
  const isPremium = subscription === "premium";

  return (
    <div className="px-5 py-5">
      <p className="text-sm text-stone-500">{t("subscription.subtitle")}</p>

      <div className="mt-4 rounded-xl bg-stone-50 p-4">
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-2xl font-bold text-stone-900">
            10,000<span className="text-sm font-medium text-stone-500">₮</span>
          </div>
          <span className="text-xs text-stone-500">{t("subscription.perMonth")}</span>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
          <li>✓ {t("subscription.features.pdf")}</li>
          <li>✓ {t("subscription.features.unlimited")}</li>
          <li>✓ {t("subscription.features.multiChild")}</li>
          <li>✓ {t("subscription.features.priority")}</li>
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-600">
        <span>{t("subscription.current")}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isPremium ? "bg-amber-100 text-amber-800" : "bg-stone-200 text-stone-700"}`}>
          {isPremium ? t("subscription.premium") : t("subscription.free")}
        </span>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={isPremium}
        className="mt-4 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {isPremium ? t("subscription.alreadyPremium") : t("subscription.continueToPay")}
      </button>
    </div>
  );
}

function PayStep({
  processing,
  error,
  onPay,
  onBack,
}: {
  processing: boolean;
  error: string | null;
  onPay: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="px-5 py-5">
      <p className="text-sm text-stone-500">{t("subscription.qpayIntro")}</p>

      {/* Fake QR placeholder — in production, render the PNG returned by QPay API. */}
      <div className="mx-auto mt-4 flex h-52 w-52 items-center justify-center rounded-xl border border-stone-200 bg-stone-50">
        <svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="160" height="160" fill="white" />
          {/* Stylized QR pattern — decorative only */}
          {Array.from({ length: 12 }).map((_, r) =>
            Array.from({ length: 12 }).map((__, c) => {
              const seed = (r * 13 + c * 7 + r * c) % 5;
              return seed < 2 ? (
                <rect
                  key={`${r}-${c}`}
                  x={8 + c * 12}
                  y={8 + r * 12}
                  width="10"
                  height="10"
                  fill="#1c1917"
                />
              ) : null;
            })
          )}
          {/* Finder markers */}
          <rect x="4" y="4" width="32" height="32" fill="none" stroke="#1c1917" strokeWidth="4" />
          <rect x="124" y="4" width="32" height="32" fill="none" stroke="#1c1917" strokeWidth="4" />
          <rect x="4" y="124" width="32" height="32" fill="none" stroke="#1c1917" strokeWidth="4" />
        </svg>
      </div>

      <p className="mt-3 text-center text-xs text-stone-500">{t("subscription.qpayScanHint")}</p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed"
        >
          {t("subscription.back")}
        </button>
        <button
          type="button"
          onClick={onPay}
          disabled={processing}
          className="flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {processing ? t("subscription.processing") : t("subscription.simulatePayment")}
        </button>
      </div>

      <p className="mt-3 text-center text-[10px] text-stone-400">
        {t("subscription.demoNote")}
      </p>
    </div>
  );
}

function SuccessStep({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="px-5 py-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
        ✅
      </div>
      <h3 className="mt-3 font-serif text-xl font-bold text-stone-900">
        {t("subscription.successTitle")}
      </h3>
      <p className="mt-2 text-sm text-stone-500">{t("subscription.successBody")}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
      >
        {t("subscription.done")}
      </button>
    </div>
  );
}
