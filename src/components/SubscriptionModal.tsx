// =============================================================================
// SubscriptionModal v4 — QPay төлбөр (QR + банкны deeplink), i18n бүрэн дэмжсэн
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { redeemPromoCode } from "../lib/firebase";
import {
  QPAY_SANDBOX,
  createQPayInvoice,
  getQPayStatus,
  simulateQPayPaid,
  type CreateInvoiceResponse,
} from "../lib/qpayClient";
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
  const [invoice, setInvoice] = useState<CreateInvoiceResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const pollRef = useRef<number | null>(null);

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

  function stopPolling() {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Модал хаагдахад poll-ийг заавал зогсооно
  useEffect(() => stopPolling, []);

  async function onPaid() {
    stopPolling();
    await refreshSubscription();
    setStep("success");
  }

  function startPolling(orderId: string) {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const st = await getQPayStatus(orderId);
        if (st.status === "paid") await onPaid();
      } catch (e) {
        console.warn("[champstep] qpay status poll failed:", e);
      }
    }, 3000);
  }

  /** Багц сонгоод "Төлөх" дарахад: нэхэмжлэх үүсгэж төлбөрийн алхам руу орно. */
  async function handleStartPayment() {
    setError(null);
    if (!user) return;

    // Firebase байхгүй (offline) үед хуучин локал идэвхжүүлэлт хэвээр
    if (user.isOffline) {
      setProcessing(true);
      try {
        await activateSubscription(selectedTier);
        setStep("success");
      } catch (e) {
        console.error("[champstep] activateSubscription failed:", e);
        setError(t("sub.error"));
      } finally {
        setProcessing(false);
      }
      return;
    }

    setProcessing(true);
    try {
      const inv = await createQPayInvoice(selectedTier);
      setInvoice(inv);
      setStep("pay");
      startPolling(inv.orderId);
    } catch (e) {
      console.error("[champstep] createQPayInvoice failed:", e);
      setError(t("pay.error"));
    } finally {
      setProcessing(false);
    }
  }

  function handleBackFromPay() {
    stopPolling();
    setInvoice(null);
    setStep("compare");
  }

  async function handleSimulatePaid() {
    if (!invoice) return;
    setSimulating(true);
    try {
      await simulateQPayPaid(invoice.orderId);
      await onPaid();
    } catch (e) {
      console.error("[champstep] simulateQPayPaid failed:", e);
      setError(t("sub.error"));
    } finally {
      setSimulating(false);
    }
  }

  const tierInfo = TIERS.find((t) => t.id === selectedTier);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-2 backdrop-blur-sm sm:items-center sm:p-4 print:hidden cs-backdrop-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl cs-panel-in"
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

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <button
              type="button"
              onClick={handleStartPayment}
              disabled={processing || selectedTier === subscription || selectedTier === "free"}
              className="mt-3 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {processing
                ? t("sub.processing")
                : selectedTier === subscription
                ? t("sub.currentPlan")
                : selectedTier === "free"
                ? t("sub.freePlan")
                : t("sub.pay")}
            </button>
          </div>
        )}

        {step === "pay" && invoice && (
          <div className="px-5 py-5 max-h-[80vh] overflow-y-auto">
            <div className="mb-4 rounded-xl bg-stone-50 p-3 flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-stone-700">{tierInfo?.name}</span>
                <span className="block text-[10px] text-stone-400">
                  {t("pay.orderId")}: {invoice.orderId}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-stone-400">{t("pay.amount")}</span>
                <span className="font-bold text-stone-900">{tierInfo?.price}{t("sub.perMonth")}</span>
              </div>
            </div>

            {/* Desktop: том QR */}
            <div className="hidden md:block">
              <div className="mx-auto flex h-64 w-64 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white p-2">
                {invoice.qrImage ? (
                  <img
                    src={`data:image/png;base64,${invoice.qrImage}`}
                    alt="QPay QR"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-stone-400">{invoice.qrText}</span>
                )}
              </div>
              <p className="mt-2 text-center text-xs text-stone-500">{t("pay.scanQr")}</p>
            </div>

            {/* Мобайл: жижиг QR + банкны deeplink жагсаалт */}
            <div className="md:hidden">
              {invoice.qrImage && (
                <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white p-1">
                  <img
                    src={`data:image/png;base64,${invoice.qrImage}`}
                    alt="QPay QR"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
              <p className="mt-3 mb-2 text-xs font-medium text-stone-500">{t("pay.chooseBank")}</p>
              <ul className="grid grid-cols-2 gap-2">
                {invoice.urls.map((bank) => (
                  <li key={bank.name}>
                    <a
                      href={bank.link}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-left text-xs text-stone-700 hover:bg-stone-50 active:scale-95 transition"
                    >
                      {bank.logo && (
                        <img src={bank.logo} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" loading="lazy" />
                      )}
                      <span className="truncate">{bank.description || bank.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Төлбөр шалгаж байна… */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-stone-500">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" aria-hidden />
              <span>{t("pay.checking")}</span>
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleBackFromPay}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                {t("sub.back")}
              </button>
              {QPAY_SANDBOX && (
                <button
                  type="button"
                  onClick={handleSimulatePaid}
                  disabled={simulating}
                  className="flex-1 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {simulating ? "…" : t("pay.simulate")}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="px-5 py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">✅</div>
            <h3 className="mt-3 font-serif text-xl font-bold text-stone-900">{t("sub.success")}</h3>
            <p className="mt-2 text-sm text-stone-500">
              {t("sub.successMsg", { name: tierInfo?.name })}
            </p>
            {invoice && <p className="mt-1 text-xs text-emerald-600">{t("pay.success")}</p>}
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