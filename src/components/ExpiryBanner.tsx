// ExpiryBanner — "plan ends in N days → renew" (7/3/1 days, dismissable once per day)
// and "plan expired → switched to Free, data kept" (dismissable once).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { daysLeft, isActive } from "../lib/subscription";
import type { SubscriptionTier } from "../types";

const REMIND_AT = [7, 3, 1];

function readFlag(key: string): boolean { try { return localStorage.getItem(key) === "1"; } catch { return false; } }
function writeFlag(key: string) { try { localStorage.setItem(key, "1"); } catch { /* private mode */ } }

export default function ExpiryBanner({ onRenew }: { onRenew: (tier: SubscriptionTier) => void }) {
  const { t } = useTranslation();
  const { user, subscriptionInfo } = useAuth();
  const [, force] = useState(0);
  if (!user || user.isOffline) return null;

  const today = new Date().toISOString().slice(0, 10);
  const tierName = (tier: SubscriptionTier) => t(`sub.tierNames.${tier}`);

  // expired → free (server set expiredFrom); show once per expiry
  if (!isActive(subscriptionInfo) && subscriptionInfo.expiredFrom) {
    const key = `champstep.expiredBanner.${user.uid}.${subscriptionInfo.expiredAt?.getTime() ?? "x"}`;
    if (readFlag(key)) return null;
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        <span>{t("sub.expiredBanner", { plan: tierName(subscriptionInfo.expiredFrom) })}</span>
        <span className="flex gap-2">
          <button type="button" onClick={() => onRenew(subscriptionInfo.expiredFrom as SubscriptionTier)} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">{t("sub.renew")}</button>
          <button type="button" onClick={() => { writeFlag(key); force((n) => n + 1); }} className="rounded-md px-2 py-1 text-xs text-amber-800 hover:bg-amber-100" aria-label={t("app.dismiss")}>✕</button>
        </span>
      </div>
    );
  }

  const left = daysLeft(subscriptionInfo);
  if (left === null || !REMIND_AT.some((d) => left <= d)) return null;
  const key = `champstep.expiryBanner.${user.uid}.${today}`;
  if (readFlag(key)) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-stone-900 px-4 py-2 text-sm text-stone-100">
      <span>{left === 0 ? t("sub.expiringToday", { plan: tierName(subscriptionInfo.tier) }) : t("sub.expiringBanner", { plan: tierName(subscriptionInfo.tier), days: left })}</span>
      <span className="flex gap-2">
        <button type="button" onClick={() => onRenew(subscriptionInfo.tier)} className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-stone-950 hover:bg-amber-400">{t("sub.renew")}</button>
        <button type="button" onClick={() => { writeFlag(key); force((n) => n + 1); }} className="rounded-md px-2 py-1 text-xs text-stone-300 hover:bg-stone-800" aria-label={t("app.dismiss")}>✕</button>
      </span>
    </div>
  );
}
