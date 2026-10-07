// src/lib/subscription.ts — client-side view of the subscription (mirrors api/_lib/subscriptionMath.ts).
import { PLANS } from "../../shared/plans.js";
import type { SubscriptionTier } from "../types";

export interface SubscriptionInfo {
  /** Raw tier stored on users/{uid}. */
  tier: SubscriptionTier;
  /** null = legacy paid doc without expiry (treated as active) or free. */
  expiresAt: Date | null;
  expiredFrom: SubscriptionTier | null;
  expiredAt: Date | null;
}

export const FREE_INFO: SubscriptionInfo = { tier: "free", expiresAt: null, expiredFrom: null, expiredAt: null };
export const DAY_MS = 24 * 60 * 60 * 1000;

export function isTier(v: unknown): v is SubscriptionTier {
  return v === "free" || v === "family" || v === "master" || v === "coach";
}

/** Firestore Timestamp | Date | ISO | epoch → Date | null */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && "toDate" in (v as object) && typeof (v as { toDate: unknown }).toDate === "function") return (v as { toDate: () => Date }).toDate();
  if (typeof v === "object" && "seconds" in (v as object)) return new Date(Number((v as { seconds: number }).seconds) * 1000);
  if (typeof v === "string" || typeof v === "number") { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  return null;
}

export function infoFromDoc(data: Record<string, unknown> | null | undefined): SubscriptionInfo {
  const tier = isTier(data?.subscriptionTier) ? data!.subscriptionTier as SubscriptionTier : "free";
  return {
    tier,
    expiresAt: tier === "free" ? null : toDate(data?.subscriptionExpiresAt),
    expiredFrom: isTier(data?.expiredFrom) && data!.expiredFrom !== "free" ? (data!.expiredFrom as SubscriptionTier) : null,
    expiredAt: toDate(data?.expiredAt),
  };
}

export function isActive(info: SubscriptionInfo, now: Date = new Date()): boolean {
  return info.tier !== "free" && (info.expiresAt === null || info.expiresAt.getTime() > now.getTime());
}

/** The tier every limit/feature check must use: expired → free. */
export function effectiveTier(info: SubscriptionInfo, now: Date = new Date()): SubscriptionTier {
  return isActive(info, now) ? info.tier : "free";
}

/** Whole days until expiry (null = legacy/unknown or free). */
export function daysLeft(info: SubscriptionInfo, now: Date = new Date()): number | null {
  if (info.tier === "free" || !info.expiresAt) return null;
  return Math.max(0, Math.ceil((info.expiresAt.getTime() - now.getTime()) / DAY_MS));
}

/** True when buying `target` would be a downgrade from an active higher tier. */
export function isDowngrade(info: SubscriptionInfo, target: SubscriptionTier, now: Date = new Date()): boolean {
  if (!isActive(info, now)) return false;
  return PLANS[target].amount < PLANS[info.tier].amount;
}

/** Tiers a user may see/buy: teachers → free + coach; parents → free/family/master. */
export function visibleTiers(role: "parent" | "teacher" | undefined): SubscriptionTier[] {
  return role === "teacher" ? ["free", "coach"] : ["free", "family", "master"];
}
