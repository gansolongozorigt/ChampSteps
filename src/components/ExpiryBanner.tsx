// ExpiryBanner — "plan ends in N days → renew" (7/3/1 days, dismissable once per day)
// and "plan expired → switched to Free, data kept" (dismissable once).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
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
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-warn-soft border-b border-line px-4 py-2 text-[13px] font-semibold text-warn">
        <span>{t("sub.expiredBanner", { plan: tierName(subscriptionInfo.expiredFrom) })}</span>
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => onRenew(subscriptionInfo.expiredFrom as SubscriptionTier)} className="cs-btn cs-btn-primary cs-btn-xs">{t("sub.renew")}</button>
          <button type="button" onClick={() => { writeFlag(key); force((n) => n + 1); }} className="cs-icon-btn cs-icon-btn-sm text-warn" aria-label={t("app.dismiss")}><X size={16} /></button>
        </span>
      </div>
    );
  }

  const left = daysLeft(subscriptionInfo);
  if (left === null || !REMIND_AT.some((d) => left <= d)) return null;
  const key = `champstep.expiryBanner.${user.uid}.${today}`;
  if (readFlag(key)) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-bg-soft border-b border-line px-4 py-2 text-[13px] font-semibold text-primary-soft-ink">
      <span>{left === 0 ? t("sub.expiringToday", { plan: tierName(subscriptionInfo.tier) }) : t("sub.expiringBanner", { plan: tierName(subscriptionInfo.tier), days: left })}</span>
      <span className="flex items-center gap-1">
        <button type="button" onClick={() => onRenew(subscriptionInfo.tier)} className="cs-btn cs-btn-primary cs-btn-xs">{t("sub.renew")}</button>
        <button type="button" onClick={() => { writeFlag(key); force((n) => n + 1); }} className="cs-icon-btn cs-icon-btn-sm text-ink-3" aria-label={t("app.dismiss")}><X size={16} /></button>
      </span>
    </div>
  );
}
