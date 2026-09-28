// api/_lib/promo.ts — promoCodes коллекцын серверийн загвар (client хандах эрхгүй)

import { Timestamp } from "firebase-admin/firestore";

export interface PromoCodeDoc {
  code: string;
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
  discountMonths: number;
  usedBy: string[];
  maxUses: number;
  expiresAt: string | null;
  active: boolean;
}

/** Promo код ямар багц өгөх (Part 1: үргэлж family). */
export const PROMO_PLAN = "family" as const;
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function promoMonths(doc: PromoCodeDoc): number {
  const m = Number(doc.discountMonths ?? doc.months ?? 1);
  return Number.isFinite(m) && m > 0 ? Math.floor(m) : 1;
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
    discountMonths: promoMonths(doc),
    usedBy: Array.isArray(doc.usedBy) ? doc.usedBy : [],
    maxUses: Number(doc.maxUses) || 0,
    expiresAt: promoExpiresAt(doc)?.toISOString() ?? null,
    active: doc.active !== false,
  };
}

export function normalizeCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(c) ? c : null;
}
