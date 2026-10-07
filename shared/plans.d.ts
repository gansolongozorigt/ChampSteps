export type PlanId = "free" | "family" | "master" | "coach";
export type PaidPlanId = Exclude<PlanId, "free">;
export interface PlanDef {
  readonly amount: number;
  readonly maxChildren: number;
  readonly maxAchievements: number;
  readonly hasPdf: boolean;
  readonly hasAI: boolean;
  readonly label: { readonly mn: string; readonly en: string; readonly ru: string };
}
export declare const PLANS: Readonly<Record<PlanId, PlanDef>>;
export declare const PLAN_IDS: readonly ["free", "family", "master", "coach"];
export declare const PAID_PLAN_IDS: readonly ["family", "master", "coach"];
export declare const PLAN_DURATION_DAYS: number;
export declare const PLAN_DURATION_MS: number;
export declare function isPlanId(v: unknown): v is PlanId;
export declare function isPaidPlanId(v: unknown): v is PaidPlanId;
export declare function formatMnt(amount: number): string;
