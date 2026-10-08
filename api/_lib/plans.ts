// api/_lib/plans.ts — server view of the plan table. Values come from
// shared/plans.js (single source of truth, shared with the client).
// Amounts are NEVER taken from the client.
import { PLANS as ALL_PLANS, PLAN_DURATION_MS, isPaidPlanId, type PaidPlanId } from "../../shared/plans.js";

export type PaidPlan = PaidPlanId;

export const PLANS: Record<PaidPlan, { amount: number; label: string }> = {
  family: { amount: ALL_PLANS.family.amount, label: ALL_PLANS.family.label.mn },
  master: { amount: ALL_PLANS.master.amount, label: ALL_PLANS.master.label.mn },
  coach: { amount: ALL_PLANS.coach.amount, label: ALL_PLANS.coach.label.mn },
};

export function isPaidPlan(value: unknown): value is PaidPlan {
  return isPaidPlanId(value);
}

export { PLAN_DURATION_MS, ALL_PLANS };
