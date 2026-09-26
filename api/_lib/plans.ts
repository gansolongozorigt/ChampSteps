// api/_lib/plans.ts — Багц → дүнгийн серверийн хүснэгт.
// Түлхүүрүүд src/types/index.ts дахь SubscriptionTier-тэй яг таарна
// ("free" төлбөргүй тул энд байхгүй). Дүнг client-ээс хэзээ ч авахгүй.

export const PLANS = {
  family: { amount: 9900, label: "Гэр бүл" },
  master: { amount: 24900, label: "Мастер" },
  coach: { amount: 49900, label: "Багш" },
} as const;

export type PaidPlan = keyof typeof PLANS;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PLANS, value);
}

/** Сарын багцын хугацаа (Part 1: тогтмол 30 хоног). */
export const PLAN_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
