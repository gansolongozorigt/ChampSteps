// SubscriptionPage — current plan, expiry, renew / change / check, payment history.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { getPaymentsForUser, type PaymentRecord } from "../lib/firebase";
import { daysLeft, isActive } from "../lib/subscription";
import { PLANS, formatMnt } from "../../shared/plans.js";
import type { SubscriptionTier } from "../types";

export default function SubscriptionPage({ onOpenModal, onToast }: { onOpenModal: (tier?: SubscriptionTier) => void; onToast: (kind: "success" | "error" | "info", message: string) => void }) {
  const { t, i18n } = useTranslation();
  const { user, subscription, subscriptionInfo, refreshSubscription } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [checking, setChecking] = useState(false);
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
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" data-testid="subscription-page">
        <p className="text-xs uppercase tracking-widest text-stone-500">{t("sub.currentPlan")}</p>
        <h3 className="mt-1 text-2xl font-semibold text-stone-900">{t(`sub.tierNames.${subscription}`)}</h3>
        {subscription !== "free" && (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-stone-500">{t("sub.expiresOn")}</dt><dd className="font-medium text-stone-800">{subscriptionInfo.expiresAt ? fmt(subscriptionInfo.expiresAt) : t("sub.noExpiry")}</dd></div>
            <div><dt className="text-stone-500">{t("sub.daysLeftLabel")}</dt><dd className="font-medium text-stone-800">{left === null ? t("sub.noExpiry") : t("sub.daysLeft", { days: left })}</dd></div>
          </dl>
        )}
        {!active && subscriptionInfo.expiredFrom && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("sub.expiredBanner", { plan: t(`sub.tierNames.${subscriptionInfo.expiredFrom}`) })}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {active && (
            <button type="button" onClick={() => onOpenModal(subscriptionInfo.tier)} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">{t("sub.renew")}</button>
          )}
          <button type="button" onClick={() => onOpenModal()} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50">{t("sub.changePlan")}</button>
          <button type="button" onClick={check} disabled={checking} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50">{checking ? t("sub.processing") : t("sub.checkStatus")}</button>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-stone-900">{t("sub.paymentsTitle")}</h4>
        {payments === null ? (
          <p className="mt-2 text-sm text-stone-500">…</p>
        ) : payments.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{t("sub.paymentsEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {payments.map((p) => (
              <li key={p.orderId} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-medium text-stone-800">{t(`sub.tierNames.${p.plan}`)} · {formatMnt(p.amount ?? PLANS[p.plan].amount)}</p>
                  <p className="text-xs text-stone-500">{fmt(p.createdAt)} · {p.orderId}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
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
