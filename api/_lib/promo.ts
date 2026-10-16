// api/_lib/promo.ts — promoCodes коллекцын серверийн загвар (client хандах эрхгүй)

import { Timestamp } from "firebase-admin/firestore";
import { isPaidPlanId, type PaidPlanId } from "../../shared/plans.js";

export interface PromoCodeDoc {
  code: string;
  /** Plan to grant (family | master | coach). Absent/invalid → legacy family. */
  plan?: unknown;
  /** Duration in days. Absent/invalid → discountMonths × 30 (legacy). */
  days?: unknown;
  discountMonths?: number;
  months?: number;
  usedBy: string[];
  usedCount?: number;
  maxUses: number;
  expiresAt?: Timestamp | string | null;
  active: boolean;
  createdAt?: Timestamp;
}

export interface PromoCodeView {
  code: string;
  plan: PaidPlanId;
  days: number;
  discountMonths: number;
  usedBy: string[];
  maxUses: number;
  expiresAt: string | null;
  active: boolean;
}

/** Legacy default plan: a code without a valid `plan` field grants family. */
export const PROMO_PLAN = "family" as const;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MONTH_MS = 30 * DAY_MS;

export function promoMonths(doc: PromoCodeDoc): number {
  const m = Number(doc.discountMonths ?? doc.months ?? 1);
  return Number.isFinite(m) && m > 0 ? Math.floor(m) : 1;
}

/** Plan the code grants: `plan` when it is a paid plan id (family/master/coach), else family. */
export function promoPlan(doc: PromoCodeDoc): PaidPlanId {
  return isPaidPlanId(doc.plan) ? doc.plan : PROMO_PLAN;
}

/** Duration: a positive `days` wins; otherwise discountMonths (or months) × 30 days. */
export function promoDurationMs(doc: PromoCodeDoc): number {
  const d = Number(doc.days);
  if (Number.isFinite(d) && d >= 1) return Math.floor(d) * DAY_MS;
  return promoMonths(doc) * MONTH_MS;
}

export function promoDays(doc: PromoCodeDoc): number {
  return Math.round(promoDurationMs(doc) / DAY_MS);
}

export function promoExpiresAt(doc: PromoCodeDoc): Date | null {
  const v = doc.expiresAt;
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toView(doc: PromoCodeDoc): PromoCodeView {
  return {
    code: doc.code,
    plan: promoPlan(doc),
    days: promoDays(doc),
    discountMonths: promoMonths(doc),
    usedBy: Array.isArray(doc.usedBy) ? doc.usedBy : [],
    maxUses: Number(doc.maxUses) || 0,
    expiresAt: promoExpiresAt(doc)?.toISOString() ?? null,
    active: doc.active !== false,
  };
}

export type PromoRejectReason = "not_found" | "inactive" | "expired" | "used" | "exhausted";

/**
 * Why a code can NOT be redeemed by `uid` right now, or null when it can.
 * Order matches /api/promo/apply: not_found → inactive → expired → used → exhausted.
 * `maxUses` 0 / absent = unlimited. Pure: the handler's transaction calls this and
 * tests/promo.test.mjs covers it without Firestore.
 */
export function promoRejectReason(doc: PromoCodeDoc | null | undefined, uid: string, now: Date = new Date()): PromoRejectReason | null {
  if (!doc) return "not_found";
  if (doc.active === false) return "inactive";
  const exp = promoExpiresAt(doc);
  if (exp && exp.getTime() < now.getTime()) return "expired";
  const usedBy = Array.isArray(doc.usedBy) ? doc.usedBy : [];
  if (usedBy.includes(uid)) return "used";
  const max = Number(doc.maxUses) || 0;
  if (max > 0 && usedBy.length >= max) return "exhausted";
  return null;
}

export function normalizeCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(c) ? c : null;
}
