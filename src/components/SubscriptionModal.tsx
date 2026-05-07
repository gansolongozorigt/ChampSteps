// =============================================================================
// SubscriptionModal v2 — 4 tier: free, family, master, coach
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import type { SubscriptionTier } from "../types";
import { TIER_LIMITS } from "../types";

type Step = "compare" | "pay" | "success";

const TIERS: {
  id: SubscriptionTier;
  name: string;
  price: string;
  children: string;
  achievements: string;
  pdf: boolean;
  ai: boolean;
  color: string;
  badge?: string;
}[] = [
  {
    id: "free",
    name: "Үнэгүй",
    price: "₮0",
    children: "1 хүүхэд",
    achievements: "30 бүртгэл",
    pdf: false,
    ai: false,
    color: "border-stone-200",
  },
  {
    id: "family",
    name: "Гэр бүл",
    price: "₮9,900",
    children: "3 хүүхэд",
    achievements: "Хязгааргүй",
    pdf: true,
    ai: false,
    color: "border-blue-200",
    badge: "Алдартай",
  },
  {
    id: "master",
    name: "Мастер",
    price: "₮24,900",
    children: "10 хүүхэд",
    achievements: "Хязгааргүй",
    pdf: true,
    ai: true,
    color: "border-amber-300",
  },
  {
    id: "coach",
    name: "Багш/Клуб",
    price: "₮49,900",
    children: "30 хүүхэд",
    achievements: "Хязгааргүй",
    pdf: true,
    ai: true,
    color: "border-purple-300",
  },
];

export default function SubscriptionModal({ onClose }: { onClose: () => void }) {
  const { subscription, activateSubscription } = useAuth();
  const [step, setStep] = useState<Step>("compare");
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("family");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 1800));
      await activateSubscription(selectedTier);
      setStep("success");
    } catch (e) {
      console.error("[champstep] activateSubscription failed:", e);
      setError("Төлбөр хийхэд алдаа гарлаа. Дахин оролдоно уу.");
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
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <h2 className="font-serif text-lg font-bold text-stone-900">ChampStep гишүүнчлэл</h2>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </header>

        {step === "compare" && (
          <CompareStep
            current={subscription as SubscriptionTier}
            selected={selectedTier}
            onSelect={setSelectedTier}
            onContinue={() => setStep("pay")}
          />
        )}
        {step === "pay" && (
          <PayStep
            tier={selectedTier}
            processing={processing}
            error={error}
            onPay={handlePay}
            onBack={() => setStep("compare")}
          />
        )}
        {step === "success" && <SuccessStep tier={selectedTier} onClose={onClose} />}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Compare step
// -----------------------------------------------------------------------------

function CompareStep({
  current,
  selected,
  onSelect,
  onContinue,
}: {
  current: SubscriptionTier;
  selected: SubscriptionTier;
  onSelect: (t: SubscriptionTier) => void;
  onContinue: () => void;
}) {
  return (
    <div className="px-5 py-5 max-h-[80vh] overflow-y-auto">
      <p className="text-sm text-stone-500 mb-4">Өөртөө тохирох эрхийг сонгоорой.</p>

      <div className="space-y-3">
        {TIERS.map((tier) => {
          const isCurrent = current === tier.id;
          const isSelected = selected === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => !isCurrent && onSelect(tier.id)}
              disabled={isCurrent}
              className={`w-full rounded-xl border-2 p-4 text-left transition ${
                isSelected && !isCurrent
                  ? `${tier.color} bg-stone-50 ring-2 ring-stone-900`
                  : isCurrent
                  ? "border-emerald-300 bg-emerald-50 cursor-default"
                  : `${tier.color} hover:bg-stone-50`
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900">{tier.name}</span>
                    {tier.badge && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {tier.badge}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Одоогийн
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500">
                    <span>👤 {tier.children}</span>
                    <span>🏆 {tier.achievements}</span>
                    {tier.pdf && <span>📄 PDF</span>}
                    {tier.ai && <span>🤖 AI</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-bold text-stone-900">{tier.price}</span>
                  {tier.id !== "free" && <span className="block text-[10px] text-stone-400">/сар</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={selected === current || selected === "free"}
        className="mt-5 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {selected === current ? "Одоогийн эрх" : selected === "free" ? "Үнэгүй эрх сонгосон" : "Төлбөр хийх →"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Pay step
// -----------------------------------------------------------------------------

function PayStep({
  tier,
  processing,
  error,
  onPay,
  onBack,
}: {
  tier: SubscriptionTier;
  processing: boolean;
  error: string | null;
  onPay: () => void;
  onBack: () => void;
}) {
  const tierInfo = TIERS.find((t) => t.id === tier);
  return (
    <div className="px-5 py-5">
      <div className="mb-4 rounded-xl bg-stone-50 p-3 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">{tierInfo?.name} эрх</span>
        <span className="font-bold text-stone-900">{tierInfo?.price}/сар</span>
      </div>

      <p className="text-sm text-stone-500 mb-3">QPay-р төлөх:</p>

      <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl border border-stone-200 bg-stone-50">
        <svg width="140" height="140" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect width="160" height="160" fill="white" />
          {Array.from({ length: 12 }).map((_, r) =>
            Array.from({ length: 12 }).map((__, c) => {
              const seed = (r * 13 + c * 7 + r * c) % 5;
              return seed < 2 ? (
                <rect key={`${r}-${c}`} x={8 + c * 12} y={8 + r * 12} width="10" height="10" fill="#1c1917" />
              ) : null;
            })
          )}
          <rect x="4" y="4" width="32" height="32" fill="none" stroke="#1c1917" strokeWidth="4" />
          <rect x="124" y="4" width="32" height="32" fill="none" stroke="#1c1917" strokeWidth="4" />
          <rect x="4" y="124" width="32" height="32" fill="none" stroke="#1c1917" strokeWidth="4" />
        </svg>
      </div>

      <p className="mt-2 text-center text-xs text-stone-400">QPay апп-аар скан хийнэ үү</p>

      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed"
        >
          Буцах
        </button>
        <button
          type="button"
          onClick={onPay}
          disabled={processing}
          className="flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {processing ? "Боловсруулж байна..." : "Төлбөрийг баталгаажуулах"}
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-stone-400">Demo горим — бодит төлбөр хийгдэхгүй</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Success step
// -----------------------------------------------------------------------------

function SuccessStep({ tier, onClose }: { tier: SubscriptionTier; onClose: () => void }) {
  const tierInfo = TIERS.find((t) => t.id === tier);
  return (
    <div className="px-5 py-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">✅</div>
      <h3 className="mt-3 font-serif text-xl font-bold text-stone-900">Амжилттай!</h3>
      <p className="mt-2 text-sm text-stone-500">
        <strong>{tierInfo?.name}</strong> эрх идэвхжлээ. Бүх боломжоо ашиглаарай!
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
      >
        Хаах
      </button>
    </div>
  );
}
