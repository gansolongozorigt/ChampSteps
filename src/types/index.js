// =============================================================================
// ChampStep — Core Data Schema v2
// Шинэчлэлт: role-based auth, multi-child, invite code, reflection нууцлал
// =============================================================================
// Subscription-н хязгаар
export const TIER_LIMITS = {
    free: { maxChildren: 1, maxAchievements: 30, hasPdf: false, hasAI: false },
    family: { maxChildren: 3, maxAchievements: -1, hasPdf: true, hasAI: false },
    master: { maxChildren: 10, maxAchievements: -1, hasPdf: true, hasAI: true },
    coach: { maxChildren: 3, maxAchievements: -1, hasPdf: true, hasAI: true },
};
