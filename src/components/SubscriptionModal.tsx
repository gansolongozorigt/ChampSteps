// =============================================================================
// SubscriptionModal v3 — i18n бүрэн дэмжсэн
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { redeemPromoCode } from "../lib/firebase";
import type { SubscriptionTier } from "../types";

type Step = "compare" | "pay" | "success";

export default function SubscriptionModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user, subscription, activateSubscription, refreshSubscription } = useAuth();
  const [step, setStep] = useState<Step>("compare");
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("family");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoResult, setPromoResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleApplyPromo() {
    if (!promoCode.trim() || !user) return;
    setPromoApplying(true);
    setPromoResult(null);
    try {
      const months = await redeemPromoCode(promoCode.trim(), user.uid);
      await refreshSubscription();
      setPromoResult({ success: true, message: t("promo.success", { months }) });
    } catch (err) {
      const code = (err as { message?: string })?.message ?? "";
      if (code === "used") setPromoResult({ success: false, message: t("promo.used") });
      else if (code === "exhausted") setPromoResult({ success: false, message: t("promo.exhausted") });
      else setPromoResult({ success: false, message: t("promo.invalid") });
    } finally {
      setPromoApplying(false);
    }
  }

  // Tier мэдээллийг i18n-тэй уялдуулан тодорхойлно
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
      name: t("sub.tierNames.free"),
      price: "₮0",
      children: t("sub.children", { n: 1 }),
      achievements: t("sub.entries", { n: 30 }),
      pdf: false,
      ai: false,
      color: "border-stone-200",
    },
    {
      id: "family",
      name: t("sub.tierNames.family"),
      price: "₮9,900",
      children: t("sub.children", { n: 3 }),
      achievements: t("sub.unlimited"),
      pdf: true,
      ai: false,
      color: "border-blue-200",
      badge: t("sub.popular"),
    },
    {
      id: "master",
      name: t("sub.tierNames.master"),
      price: "₮24,900",
      children: t("sub.children", { n: 10 }),
      achievements: t("sub.unlimited"),
      pdf: true,
      ai: true,
      color: "border-amber-300",
    },
    {
      id: "coach",
      name: t("sub.tierNames.coach"),
      price: "₮49,900",
      children: t("sub.children", { n: 30 }),
      achievements: t("sub.unlimited"),
      pdf: true,
      ai: true,
      color: "border-purple-300",
    },
  ];

  async function handlePay() {
    setError(null);
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 1800));
      await activateSubscription(selectedTier);
      setStep("success");
    } catch (e) {
      console.error("[champstep] activateSubscription failed:", e);
      setError(t("sub.error"));
    } finally {
      setProcessing(false);
    }
  }

  const tierInfo = TIERS.find((t) => t.id === selectedTier);

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
          <h2 className="font-serif text-lg font-bold text-stone-900">{t("sub.title")}</h2>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </header>

        {step === "compare" && (
          <div className="px-5 py-5 max-h-[80vh] overflow-y-auto">
            <p className="text-sm text-stone-500 mb-4">{t("sub.subtitle")}</p>
            <div className="space-y-3">
              {TIERS.map((tier) => {
                const isCurrent = subscription === tier.id;
                const isSelected = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => !isCurrent && setSelectedTier(tier.id)}
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
                              {t("sub.current")}
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
                        {tier.id !== "free" && (
                          <span className="block text-[10px] text-stone-400">{t("sub.perMonth")}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Promo code */}
            <div className="mt-5 rounded-xl border border-dashed border-stone-300 p-3">
              <p className="mb-2 text-xs font-medium text-stone-500">{t("promo.label")}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder={t("promo.placeholder")}
                  className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={promoApplying || !promoCode.trim()}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {promoApplying ? "..." : t("promo.apply")}
                </button>
              </div>
              {promoResult && (
                <p className={`mt-2 text-xs ${promoResult.success ? "text-emerald-600" : "text-red-600"}`}>
                  {promoResult.message}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep("pay")}
              disabled={selectedTier === subscription || selectedTier === "free"}
              className="mt-3 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {selectedTier === subscription
                ? t("sub.currentPlan")
                : selectedTier === "free"
                ? t("sub.freePlan")
                : t("sub.pay")}
            </button>
          </div>
        )}

        {step === "pay" && (
          <div className="px-5 py-5">
            <div className="mb-4 rounded-xl bg-stone-50 p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-stone-700">{tierInfo?.name}</span>
              <span className="font-bold text-stone-900">{tierInfo?.price}{t("sub.perMonth")}</span>
            </div>
            <p className="text-sm text-stone-500 mb-3">{t("sub.payWith")}</p>
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl border border-stone-200 bg-stone-50">
              <svg width="140" height="140" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <rect width="160" height="160" fill="white" />
                {Array.from({ length: 12 }).map((_, r) =>
                  Array.from({ length: 12 }).map((__,c) => {
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
            <p className="mt-2 text-center text-xs text-stone-400">{t("sub.scanQr")}</p>
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("compare")}
                disabled={processing}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed"
              >
                {t("sub.back")}
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={processing}
                className="flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {processing ? t("sub.processing") : t("sub.confirm")}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-stone-400">{t("sub.demo")}</p>
          </div>
        )}

        {step === "success" && (
          <div className="px-5 py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">✅</div>
            <h3 className="mt-3 font-serif text-xl font-bold text-stone-900">{t("sub.success")}</h3>
            <p className="mt-2 text-sm text-stone-500">
              {t("sub.successMsg", { name: tierInfo?.name })}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
            >
              {t("sub.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}