// api/_lib/subscriptionMath.ts — pure subscription arithmetic (no Firebase).
// Used by activate.ts (QPay), promo/apply.ts and subscription/status.ts.
import { PLANS, PLAN_DURATION_MS, type PlanId, type PaidPlanId } from "../../shared/plans.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface CurrentSubscription {
  tier: PlanId;
  /** null = legacy paid doc without an expiry (treated as active, no remaining-day credit). */
  expiresAt: Date | null;
}

export type NextSubscription =
  | { ok: true; kind: "new" | "renew" | "upgrade"; expiresAt: Date; creditDays: number }
  | { ok: false; reason: "downgrade"; activeTier: PaidPlanId; activeUntil: Date | null };

/** Active = paid tier whose expiry is in the future (or unknown/legacy). */
export function isActive(cur: CurrentSubscription, now: Date): boolean {
  return cur.tier !== "free" && (cur.expiresAt === null || cur.expiresAt.getTime() > now.getTime());
}

export function effectiveTier(cur: CurrentSubscription, now: Date): PlanId {
  return isActive(cur, now) ? cur.tier : "free";
}

/**
 * What buying/applying `target` for `durationMs` does to the current subscription:
 *  - no active plan            → new:     now + duration
 *  - same tier                 → renew:   max(now, expiresAt) + duration
 *  - higher tier (upgrade)     → upgrade: now + duration + credit, where credit =
 *                                floor(remainingDays × oldPrice / newPrice) days (legacy: 0)
 *  - lower tier (downgrade)    → refused (ok: false)
 */
export function planNextSubscription(
  cur: CurrentSubscription,
  target: PaidPlanId,
  now: Date,
  durationMs: number = PLAN_DURATION_MS
): NextSubscription {
  if (!isActive(cur, now)) {
    return { ok: true, kind: "new", expiresAt: new Date(now.getTime() + durationMs), creditDays: 0 };
  }
  const curTier = cur.tier as PaidPlanId;
  const curPrice = PLANS[curTier].amount;
  const newPrice = PLANS[target].amount;
  if (newPrice < curPrice) {
    return { ok: false, reason: "downgrade", activeTier: curTier, activeUntil: cur.expiresAt };
  }
  if (target === curTier) {
    const base = Math.max(now.getTime(), cur.expiresAt?.getTime() ?? now.getTime());
    return { ok: true, kind: "renew", expiresAt: new Date(base + durationMs), creditDays: 0 };
  }
  const remainingDays = cur.expiresAt ? Math.max(0, Math.floor((cur.expiresAt.getTime() - now.getTime()) / DAY_MS)) : 0;
  const creditDays = Math.floor((remainingDays * curPrice) / newPrice);
  return { ok: true, kind: "upgrade", expiresAt: new Date(now.getTime() + durationMs + creditDays * DAY_MS), creditDays };
}

/** Firestore Timestamp | Date | ISO | epoch → Date | null */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") return (v as { toDate: () => Date }).toDate();
  if (typeof v === "object" && v !== null && "seconds" in v) return new Date(Number((v as { seconds: number }).seconds) * 1000);
  if (typeof v === "string" || typeof v === "number") { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  return null;
}

/** Read the current subscription out of a users/{uid} document. */
export function currentFromUserDoc(doc: Record<string, unknown> | undefined | null): CurrentSubscription {
  const tierRaw = doc?.subscriptionTier;
  const tier: PlanId = tierRaw === "family" || tierRaw === "master" || tierRaw === "coach" ? tierRaw : "free";
  return { tier, expiresAt: tier === "free" ? null : toDate(doc?.subscriptionExpiresAt) };
}
