// =============================================================================
// SubscriptionModal v4 — QPay төлбөр (QR + банкны deeplink), i18n бүрэн дэмжсэн
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, FileText, Loader2, Sparkles, Trophy, Users, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { PromoError, applyPromoCode } from "../lib/promoClient";
import { PLANS, formatMnt } from "../../shared/plans.js";
import {
  PAYMENTS_DISABLED,
  QPAY_SANDBOX,
  createQPayInvoice,
  getQPayConfig,
  getQPayStatus,
  simulateQPayPaid,
  type CreateInvoiceResponse,
} from "../lib/qpayClient";
import type { SubscriptionTier } from "../types";
import { isDowngrade, visibleTiers } from "../lib/subscription";

type Step = "compare" | "pay" | "success";

export default function SubscriptionModal({ onClose, initialTier }: { onClose: () => void; initialTier?: SubscriptionTier }) {
  const { t, i18n } = useTranslation();
  const { user, subscription, subscriptionInfo, activateSubscription, refreshSubscription } = useAuth();
  const [step, setStep] = useState<Step>("compare");
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(
    initialTier && initialTier !== "free" ? initialTier : subscription !== "free" ? subscription : user?.role === "teacher" ? "coach" : "family"
  );
  const untilText = subscriptionInfo.expiresAt
    ? subscriptionInfo.expiresAt.toLocaleDateString(i18n.language?.startsWith("en") ? "en-US" : i18n.language?.startsWith("ru") ? "ru-RU" : "mn-MN", { year: "numeric", month: "long", day: "numeric" })
    : t("sub.noExpiry");
  const downgradeMsg = () => t("sub.downgradeBlocked", { until: untilText });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoResult, setPromoResult] = useState<{ success: boolean; message: string } | null>(null);
  const [invoice, setInvoice] = useState<CreateInvoiceResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  // null = not known yet; false = QPay not configured on the server (shown as an info box, promo still works)
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    if (!user || user.isOffline) { setPaymentsEnabled(true); return; }
    getQPayConfig().then((c) => { if (alive) setPaymentsEnabled(c.enabled); });
    return () => { alive = false; };
  }, [user]);
  const pollRef = useRef<number | null>(null);

  async function handleApplyPromo() {
    if (!promoCode.trim() || !user) return;
    setPromoApplying(true);
    setPromoResult(null);
    try {
      const { months } = await applyPromoCode(promoCode.trim());
      await refreshSubscription();
      setPromoResult({ success: true, message: t("promo.success", { months }) });
    } catch (err) {
      const reason = err instanceof PromoError ? err.reason : "unknown";
      if (reason === "used") setPromoResult({ success: false, message: t("promo.used") });
      else if (reason === "exhausted") setPromoResult({ success: false, message: t("promo.exhausted") });
      else if (reason === "expired" || reason === "inactive") setPromoResult({ success: false, message: t("promo.expired") });
      else if (reason === "downgrade") setPromoResult({ success: false, message: downgradeMsg() });
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
    badge?: string;
  }[] = [
    {
      id: "free",
      name: t("sub.tierNames.free"),
      price: formatMnt(PLANS.free.amount),
      children: t("sub.children", { n: PLANS.free.maxChildren }),
      achievements: t("sub.entries", { n: PLANS.free.maxAchievements }),
      pdf: false,
      ai: false,
    },
    {
      id: "family",
      name: t("sub.tierNames.family"),
      price: formatMnt(PLANS.family.amount),
      children: t("sub.children", { n: PLANS.family.maxChildren }),
      achievements: t("sub.unlimited"),
      pdf: true,
      ai: false,
      badge: t("sub.popular"),
    },
    {
      id: "master",
      name: t("sub.tierNames.master"),
      price: formatMnt(PLANS.master.amount),
      children: t("sub.children", { n: PLANS.master.maxChildren }),
      achievements: t("sub.unlimited"),
      pdf: true,
      ai: true,
    },
    {
      id: "coach",
      name: t("sub.tierNames.coach"),
      price: formatMnt(PLANS.coach.amount),
      children: t("sub.children", { n: PLANS.coach.maxChildren }),
      achievements: t("sub.unlimited"),
      pdf: true,
      ai: true,
    },
  ];
  // Parents see free/family/master, teachers see free/coach.
  const TIERS_VISIBLE = TIERS.filter((tier) => visibleTiers(user?.role).includes(tier.id));

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
      const msg = (e as Error).message;
      if (msg === PAYMENTS_DISABLED) { setPaymentsEnabled(false); return; }
      setError(msg === "downgrade" ? downgradeMsg() : t("pay.error"));
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
    <div className="cs-modal-backdrop cs-backdrop-in print:hidden" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-lg">
        <div className="cs-handle" />
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="t-h1">{t("sub.title")}</h2>
          <button type="button" onClick={onClose} className="cs-icon-btn -mr-2" aria-label={t("sub.close")}>
            <X size={20} />
          </button>
        </header>

        {step === "compare" && (
          <div className="px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <p className="t-body text-ink-2 mb-4">{t("sub.subtitle")}</p>
            <div className="space-y-3">
              {TIERS_VISIBLE.map((tier) => {
                const isCurrent = subscription === tier.id;
                const isSelected = selectedTier === tier.id;
                const blocked = isDowngrade(subscriptionInfo, tier.id) || tier.id === "free";
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => !blocked && setSelectedTier(tier.id)}
                    disabled={blocked}
                    aria-disabled={blocked}
                    title={isDowngrade(subscriptionInfo, tier.id) ? downgradeMsg() : undefined}
                    aria-pressed={isSelected && !isCurrent}
                    className={`cs-card w-full p-4 text-left transition-colors min-h-[44px] ${
                      isSelected && !isCurrent
                        ? "!border-primary bg-primary-soft"
                        : isCurrent
                        ? "bg-bg-soft cursor-default"
                        : "hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="t-h2">{tier.name}</span>
                          {tier.badge && (
                            <span className={`cs-badge-tier ${tier.id === "free" ? "cs-badge-tier-free" : "cs-badge-tier-paid"}`}>{tier.badge}</span>
                          )}
                          {isCurrent && (
                            <span className="cs-badge-tier cs-badge-tier-paid">{t("sub.current")}</span>
                          )}
                          {isDowngrade(subscriptionInfo, tier.id) && (
                            <span className="cs-chip cs-chip-muted h-auto whitespace-normal py-1 text-left">{downgradeMsg()}</span>
                          )}
                        </div>
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 t-caption text-ink-2">
                          <li className="inline-flex items-center gap-1.5"><Users size={14} strokeWidth={2} className="text-ink-3" />{tier.children}</li>
                          <li className="inline-flex items-center gap-1.5"><Trophy size={14} strokeWidth={2} className="text-ink-3" />{tier.achievements}</li>
                          {tier.pdf && <li className="inline-flex items-center gap-1.5"><FileText size={14} strokeWidth={2} className="text-ink-3" />PDF</li>}
                          {tier.ai && <li className="inline-flex items-center gap-1.5"><Sparkles size={14} strokeWidth={2} className="text-ink-3" />AI</li>}
                        </ul>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="t-stat text-[22px]">{tier.price}</span>
                        {tier.id !== "free" && (
                          <span className="block t-caption mt-1">{t("sub.perMonth")}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Promo code */}
            <div className="mt-5 cs-card-soft p-4">
              <p className="cs-field-label">{t("promo.label")}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder={t("promo.placeholder")}
                  className="cs-input flex-1 bg-surface"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={promoApplying || !promoCode.trim()}
                  className="cs-btn cs-btn-outline shrink-0"
                >
                  {promoApplying ? t("promo.applying") : t("promo.apply")}
                </button>
              </div>
              {promoResult && (
                <p className={`mt-2 t-caption ${promoResult.success ? "text-primary" : "text-error"}`}>
                  {promoResult.message}
                </p>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-input bg-error-soft px-3 py-2 t-body text-error">{error}</div>
            )}
            {paymentsEnabled === false && (
              <div className="mt-3 cs-card-soft px-4 py-3 t-body text-ink-2" role="status" data-testid="payments-disabled">
                {t("pay.disabledInfo")}
              </div>
            )}
            {paymentsEnabled !== false && (
            <button
              type="button"
              onClick={handleStartPayment}
              disabled={processing || selectedTier === "free" || isDowngrade(subscriptionInfo, selectedTier)}
              className="cs-btn cs-btn-primary mt-4 w-full"
            >
              {processing
                ? t("sub.processing")
                : selectedTier === subscription
                ? t("sub.renew")
                : selectedTier === "free"
                ? t("sub.freePlan")
                : t("sub.pay")}
            </button>
            )}
          </div>
        )}

        {step === "pay" && invoice && (
          <div className="px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 cs-card-soft p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="block t-body-strong">{tierInfo?.name}</span>
                <span className="block t-caption truncate">
                  {t("pay.orderId")}: {invoice.orderId}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="block t-label">{t("pay.amount")}</span>
                <span className="t-body-strong">{tierInfo?.price}{t("sub.perMonth")}</span>
              </div>
            </div>

            {/* Desktop: том QR */}
            <div className="hidden md:block">
              <div className="mx-auto flex h-64 w-64 items-center justify-center overflow-hidden rounded-card border border-line bg-surface p-2">
                {invoice.qrImage ? (
                  <img
                    src={`data:image/png;base64,${invoice.qrImage}`}
                    alt={t("pay.qrAlt")}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="t-caption break-all">{invoice.qrText}</span>
                )}
              </div>
              <p className="mt-2 text-center t-caption">{t("pay.scanQr")}</p>
            </div>

            {/* Мобайл: жижиг QR + банкны deeplink жагсаалт */}
            <div className="md:hidden">
              {invoice.qrImage && (
                <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-card border border-line bg-surface p-1">
                  <img
                    src={`data:image/png;base64,${invoice.qrImage}`}
                    alt={t("pay.qrAlt")}
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
              <p className="mt-3 mb-2 cs-field-label">{t("pay.chooseBank")}</p>
              <ul className="grid grid-cols-2 gap-2">
                {invoice.urls.map((bank) => (
                  <li key={bank.name}>
                    <a
                      href={bank.link}
                      className="flex min-h-[44px] items-center gap-2 rounded-input border border-line bg-surface px-2.5 py-2 text-left text-[13px] font-semibold text-ink hover:bg-bg-soft active:scale-[0.98] transition-colors"
                    >
                      {bank.logo && (
                        <img src={bank.logo} alt="" className="h-7 w-7 shrink-0 rounded-image object-contain" loading="lazy" />
                      )}
                      <span className="truncate">{bank.description || bank.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Төлбөр шалгаж байна… */}
            <div className="mt-4 flex items-center justify-center gap-2 t-caption">
              <Loader2 size={14} className="animate-spin text-primary" aria-hidden />
              <span>{t("pay.checking")}</span>
            </div>

            {error && (
              <div className="mt-3 rounded-input bg-error-soft px-3 py-2 t-body text-error">{error}</div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleBackFromPay}
                className="cs-btn cs-btn-outline flex-1"
              >
                {t("sub.back")}
              </button>
              {QPAY_SANDBOX && (
                <button
                  type="button"
                  onClick={handleSimulatePaid}
                  disabled={simulating}
                  className="cs-btn cs-btn-soft flex-1 border border-dashed border-primary"
                >
                  {simulating ? "…" : t("pay.simulate")}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
            <div className="cs-badge cs-badge-primary mx-auto !h-16 !w-16"><CircleCheck size={32} strokeWidth={2} /></div>
            <h3 className="mt-4 t-h1">{t("sub.success")}</h3>
            <p className="mt-2 t-body text-ink-2">
              {t("sub.successMsg", { name: tierInfo?.name })}
            </p>
            {invoice && <p className="mt-1 t-caption text-primary">{t("pay.success")}</p>}
            <button
              type="button"
              onClick={onClose}
              className="cs-btn cs-btn-primary mt-6 w-full"
            >
              {t("sub.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}