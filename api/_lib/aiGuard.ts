// api/_lib/aiGuard.ts — pure helpers that protect /api/ai-insight.
// No Firebase / Node imports here so the file can be unit-tested with
// `node --test` (Node strips the types natively): CORS allow-list, effective
// subscription tier (expiry-aware) and the rolling-window rate limiter.

import { PLANS, isPlanId, type PlanId } from "../../shared/plans.js";

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------

export const STATIC_ALLOWED_ORIGINS = [
  "https://www.champstep.mn",
  "https://champstep.mn",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
] as const;

/** APP_URL (if set) + the static list; falsy entries dropped, trailing "/" trimmed. */
export function buildAllowList(appUrl: string | undefined): string[] {
  return [appUrl, ...STATIC_ALLOWED_ORIGINS]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim().replace(/\/+$/, ""));
}

/**
 * A request with no Origin header (same-origin fetch, curl, server-to-server)
 * is allowed — it carries no browser credentials to protect. A present Origin
 * must match the allow-list exactly (scheme + host + port).
 */
export function isAllowedOrigin(origin: string | undefined | null, allowList: readonly string[]): boolean {
  if (origin === undefined || origin === null || origin === "") return true;
  return allowList.includes(origin);
}

// -----------------------------------------------------------------------------
// Subscription tier
// -----------------------------------------------------------------------------

/** Firestore Timestamp / Date / ISO string / epoch ms → epoch ms, or null if absent/unparseable. */
export function toMillis(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "object") {
    const o = v as { toMillis?: () => number; toDate?: () => Date; seconds?: unknown; _seconds?: unknown };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.toDate === "function") return o.toDate().getTime();
    const secs = typeof o.seconds === "number" ? o.seconds : typeof o._seconds === "number" ? o._seconds : null;
    if (secs !== null) return secs * 1000;
  }
  return null;
}

export interface UserDocLike {
  subscriptionTier?: unknown;
  subscriptionExpiresAt?: unknown;
}

/**
 * Effective plan of a users/{uid} document: `subscriptionTier` (default "free");
 * downgraded to "free" when `subscriptionExpiresAt` is set and already passed.
 * An expiry value that is present but unparseable fails closed ("free").
 */
export function effectiveTier(userDoc: UserDocLike | undefined | null, now: number | Date = Date.now()): PlanId {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const raw = userDoc?.subscriptionTier;
  const tier: PlanId = isPlanId(raw) ? raw : "free";
  if (tier === "free") return "free";
  const exp = userDoc?.subscriptionExpiresAt;
  if (exp === undefined || exp === null || exp === "") return tier;
  const expMs = toMillis(exp);
  if (expMs === null || expMs <= nowMs) return "free";
  return tier;
}

export function tierHasAI(tier: PlanId): boolean {
  return PLANS[tier].hasAI === true;
}

// -----------------------------------------------------------------------------
// Rate limit (rolling window, stored as aiUsage/{uid} { windowStart, count })
// -----------------------------------------------------------------------------

export const AI_RATE_LIMIT = 10;
export const AI_RATE_WINDOW_MS = 60 * 60 * 1000;

export interface RateWindowState {
  windowStart: number | null;
  count: number;
}

export interface RateDecision {
  windowStart: number;
  count: number;
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Pure state transition for one request. Returns the window to persist and
 * whether the request may proceed. The window resets once it is older than
 * `windowMs`; a denied request does not change the stored state.
 */
export function nextRateWindow(
  current: Partial<RateWindowState> | undefined | null,
  nowMs: number,
  limit: number = AI_RATE_LIMIT,
  windowMs: number = AI_RATE_WINDOW_MS
): RateDecision {
  const start =
    typeof current?.windowStart === "number" && Number.isFinite(current.windowStart) ? current.windowStart : null;
  const count =
    typeof current?.count === "number" && Number.isFinite(current.count) && current.count > 0
      ? Math.floor(current.count)
      : 0;

  if (start === null || nowMs - start >= windowMs) {
    return { windowStart: nowMs, count: 1, allowed: true, retryAfterSec: 0 };
  }
  if (count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((start + windowMs - nowMs) / 1000));
    return { windowStart: start, count, allowed: false, retryAfterSec };
  }
  return { windowStart: start, count: count + 1, allowed: true, retryAfterSec: 0 };
}

/** "Bearer <token>" → token, else null. */
export function bearerToken(header: string | string[] | undefined): string | null {
  const h = Array.isArray(header) ? header[0] : header;
  if (typeof h !== "string") return null;
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : null;
}
