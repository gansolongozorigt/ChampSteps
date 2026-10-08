// SubscriptionPage — current plan, expiry, renew / change / check, payment history.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { getPaymentsForUser, type PaymentRecord } from "../lib/firebase";
import { daysLeft, isActive } from "../lib/subscription";
import { PLANS, formatMnt } from "../../shared/plans.js";
import { getQPayConfig } from "../lib/qpayClient";
import type { SubscriptionTier } from "../types";

export default function SubscriptionPage({ onOpenModal, onToast }: { onOpenModal: (tier?: SubscriptionTier) => void; onToast: (kind: "success" | "error" | "info", message: string) => void }) {
  const { t, i18n } = useTranslation();
  const { user, subscription, subscriptionInfo, refreshSubscription } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  useEffect(() => { let alive = true; getQPayConfig().then((c) => { if (alive) setPaymentsEnabled(c.enabled); }); return () => { alive = false; }; }, []);
  const locale = i18n.language?.startsWith("en") ? "en-US" : i18n.language?.startsWith("ru") ? "ru-RU" : "mn-MN";

  useEffect(() => {
    if (!user || user.isOffline) { setPayments([]); return; }
    let alive = true;
    getPaymentsForUser(user.uid).then((p) => alive && setPayments(p)).catch((e) => { console.error("[champstep] payments failed:", e); if (alive) setPayments([]); });
    return () => { alive = false; };
  }, [user]);

  async function check() {
    setChecking(true);
    try { await refreshSubscription(); onToast("success", t("sub.statusUpToDate")); }
    catch (e) { console.error("[champstep] status check failed:", e); onToast("error", t("sub.error")); }
    finally { setChecking(false); }
  }

  const active = isActive(subscriptionInfo);
  const left = daysLeft(subscriptionInfo);
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }) : "—");

  return (
    <div className="space-y-6">
      <section className="cs-card p-5" data-testid="subscription-page">
        <p className="t-label">{t("sub.currentPlan")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h3 className="t-display">{t(`sub.tierNames.${subscription}`)}</h3>
          <span className={`cs-badge-tier ${subscription === "free" ? "cs-badge-tier-free" : "cs-badge-tier-paid"}`}>{t(`sub.tierNames.${subscription}`)}</span>
        </div>
        {subscription !== "free" && (
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="cs-card-soft p-3"><dt className="t-label">{t("sub.expiresOn")}</dt><dd className="mt-1 t-body-strong">{subscriptionInfo.expiresAt ? fmt(subscriptionInfo.expiresAt) : t("sub.noExpiry")}</dd></div>
            <div className="cs-card-soft p-3"><dt className="t-label">{t("sub.daysLeftLabel")}</dt><dd className="mt-1 t-body-strong tabular-nums">{left === null ? t("sub.noExpiry") : t("sub.daysLeft", { days: left })}</dd></div>
          </dl>
        )}
        {!active && subscriptionInfo.expiredFrom && (
          <p className="mt-3 rounded-input bg-warn-soft px-3 py-2 t-body text-warn">{t("sub.expiredBanner", { plan: t(`sub.tierNames.${subscriptionInfo.expiredFrom}`) })}</p>
        )}
        {paymentsEnabled === false && (
          <p className="mt-3 cs-card-soft px-4 py-3 t-body text-ink-2" role="status" data-testid="payments-disabled">{t("pay.disabledInfo")}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {active && paymentsEnabled !== false && (
            <button type="button" onClick={() => onOpenModal(subscriptionInfo.tier)} className="cs-btn cs-btn-primary">{t("sub.renew")}</button>
          )}
          <button type="button" onClick={() => onOpenModal()} className="cs-btn cs-btn-outline">{t("sub.changePlan")}</button>
          <button type="button" onClick={check} disabled={checking} className="cs-btn cs-btn-outline">{checking ? t("sub.processing") : t("sub.checkStatus")}</button>
        </div>
      </section>

      <section className="cs-card p-5">
        <h4 className="t-h2">{t("sub.paymentsTitle")}</h4>
        {payments === null ? (
          <p className="mt-2 t-body text-ink-3">…</p>
        ) : payments.length === 0 ? (
          <p className="mt-2 t-body text-ink-3">{t("sub.paymentsEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {payments.map((p) => (
              <li key={p.orderId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="t-body-strong truncate">{t(`sub.tierNames.${p.plan}`)} · {formatMnt(p.amount ?? PLANS[p.plan].amount)}</p>
                  <p className="t-caption truncate">{fmt(p.createdAt)} · {p.orderId}</p>
                </div>
                <span className={`cs-chip shrink-0 ${p.status === "paid" ? "" : "cs-chip-muted"}`}>
                  {p.status === "paid" ? t("sub.paymentPaid") : t("sub.paymentPending")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
