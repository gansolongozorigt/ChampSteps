// shared/plans.js — THE single source of truth for subscription plans.
// Imported by the client (src/types/index.ts, SubscriptionModal) AND the
// serverless API (api/_lib/plans.ts). Plain JS + plans.d.ts so Node, Vite and
// Vercel can all load it without a build step. Change prices/limits HERE only.

/** @typedef {"free" | "family" | "master" | "coach"} PlanId */

/** amount = MNT per 30 days; maxAchievements -1 = unlimited */
export const PLANS = Object.freeze({
  free:   Object.freeze({ amount: 0,     maxChildren: 1,  maxAchievements: 30, hasPdf: false, hasAI: false, label: { mn: "Үнэгүй",  en: "Free",   ru: "Бесплатно" } }),
  family: Object.freeze({ amount: 9900,  maxChildren: 3,  maxAchievements: -1, hasPdf: true,  hasAI: false, label: { mn: "Гэр бүл", en: "Family", ru: "Семья" } }),
  master: Object.freeze({ amount: 24900, maxChildren: 10, maxAchievements: -1, hasPdf: true,  hasAI: true,  label: { mn: "Мастер",  en: "Master", ru: "Мастер" } }),
  coach:  Object.freeze({ amount: 49900, maxChildren: 30, maxAchievements: -1, hasPdf: true,  hasAI: true,  label: { mn: "Багш",    en: "Coach",  ru: "Тренер" } }),
});

export const PLAN_IDS = /** @type {const} */ (["free", "family", "master", "coach"]);
export const PAID_PLAN_IDS = /** @type {const} */ (["family", "master", "coach"]);

/** Plan length (Part 1: fixed 30 days). */
export const PLAN_DURATION_DAYS = 30;
export const PLAN_DURATION_MS = PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000;

/** @param {unknown} v @returns {v is PlanId} */
export function isPlanId(v) {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PLANS, v);
}
/** @param {unknown} v @returns {v is "family" | "master" | "coach"} */
export function isPaidPlanId(v) {
  return isPlanId(v) && v !== "free";
}
/** "₮9,900" */
export function formatMnt(amount) {
  return "₮" + Number(amount).toLocaleString("en-US");
}
