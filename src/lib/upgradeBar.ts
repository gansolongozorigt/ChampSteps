// =============================================================================
// upgradeBar — when the mobile "upgrade" strip above the bottom nav is shown.
// Free tier only, and only once the achievement limit is close (25/30 for the
// current free plan); before that it never shows — the header star stays.
// The strip can be snoozed for 7 days, except at >=90 % of a limit.
// =============================================================================

/** Achievements left before the limit at which the strip appears (30 - 5 = 25). */
export const UPGRADE_BAR_LEFT = 5;

export interface UpgradeBarInput {
  isPremium: boolean;
  achCount: number;
  /** -1 = unlimited */
  maxAch: number;
  /** a reachable child limit is full (free = 1 child never counts) */
  childNear: boolean;
  dismissed: boolean;
}

/** >=90 % of the achievement limit: the strip can no longer be snoozed. */
export function achNearLimit({ isPremium, achCount, maxAch }: Pick<UpgradeBarInput, "isPremium" | "achCount" | "maxAch">): boolean {
  return !isPremium && maxAch > 0 && achCount >= Math.ceil(maxAch * 0.9);
}

export function showUpgradeBar(i: UpgradeBarInput): boolean {
  if (i.isPremium) return false;
  const approaching = (i.maxAch > 0 && i.achCount >= i.maxAch - UPGRADE_BAR_LEFT) || i.childNear;
  if (!approaching) return false;
  return !i.dismissed || achNearLimit(i) || i.childNear;
}
