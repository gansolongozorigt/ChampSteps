// Plan limits/prices live in shared/plans.js (shared with api/).
import { PLANS, PLAN_IDS } from "../../shared/plans.js";

// =============================================================================
// ChampStep — Core Data Schema v2
// Шинэчлэлт: role-based auth, multi-child, invite code, reflection нууцлал
// =============================================================================

/** Subscription тиер */
export type SubscriptionTier = "free" | "family" | "master" | "coach";

/** Хуучин нэртэй нийцтэй байлгах */
export type SubscriptionStatus = SubscriptionTier;

/** Хэрэглэгчийн үүрэг */
export type UserRole = "parent" | "teacher";

/** Тэмцээний ангилал */
export type AchievementCategory = "Sports" | "Arts" | "Academic";

/** Медалийн төрөл */
export type AwardType = "Gold" | "Silver" | "Bronze" | "Participant";

// -----------------------------------------------------------------------------
// Хэрэглэгч
// -----------------------------------------------------------------------------

/**
 * /users/{uid}
 * Багш болон эцэг эх хоёул энэ collection-д байна.
 */
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  createdAt?: string;
}

// Subscription-н хязгаар
export interface TierLimits {
  maxChildren: number;
  maxAchievements: number; // -1 = хязгааргүй
  maxActiveGoals: number;  // хүүхэд бүрт идэвхтэй зорилго; -1 = хязгааргүй
  hasPdf: boolean;
  hasAI: boolean;
}
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = Object.fromEntries(
  PLAN_IDS.map((id) => [id, {
    maxChildren: PLANS[id].maxChildren,
    maxAchievements: PLANS[id].maxAchievements,
    maxActiveGoals: PLANS[id].maxActiveGoals,
    hasPdf: PLANS[id].hasPdf,
    hasAI: PLANS[id].hasAI,
  }])
) as Record<SubscriptionTier, TierLimits>;

// -----------------------------------------------------------------------------
// Хүүхэд
// -----------------------------------------------------------------------------

/**
 * /children/{childId}
 * parentId + teacherIds-р хандах эрх тодорхойлно.
 */
export interface Child {
  childId: string;
  parentId: string;          // эцэг эхийн uid
  teacherIds: string[];      // багш нарын uid жагсаалт
  name: string;
  birthDate: string;         // YYYY-MM-DD
  bio?: string;
  avatarUrl?: string;
  createdAt?: string;
}

// -----------------------------------------------------------------------------
// Урилгын код
// -----------------------------------------------------------------------------

/**
 * /inviteCodes/{code}
 * Багш шавиа нэмэхдээ 6 оронтой код үүсгэнэ.
 * Эцэг эх тэр кодыг оруулснаар хүүхэд багштай холбогдно.
 */
export interface InviteCode {
  code: string;              // 6 оронтой: "ABC123"
  teacherId: string;
  teacherName: string;
  childId?: string;          // холбогдсоны дараа бөглөгдөнө
  used: boolean;
  expiresAt: string;         // ISO date — 7 хоногийн дараа дуусна
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Тэмцээний бүртгэл
// -----------------------------------------------------------------------------

/**
 * /achievements/{id}
 * Багш болон эцэг эх хоёул харна.
 */
export interface Achievement {
  id: string;
  childId: string;
  title: string;
  date: string;              // YYYY-MM-DD
  location: string;
  category: AchievementCategory;
  description: string;
  awardType: AwardType;
  imageURLs: string[];
  /** Practice statistics copied from the goal when the result was recorded. */
  prep?: AchievementPrep;
  createdAt?: string;
  updatedAt?: string;
}

/** achievements.prep */
export interface AchievementPrep {
  goalId: string;
  /** distinct days with a practice log */
  days: number;
  sessions: number;
  minutes: number;
  /** days from the goal's creation to the competition, inclusive */
  daysTotal: number;
}

/** Form draft */
export type AchievementDraft = Omit<
  Achievement,
  "id" | "childId" | "imageURLs" | "createdAt" | "updatedAt"
> & {
  /** New photos to upload. */
  images: File[];
  /** Edit mode: already-uploaded photos the user kept (others are removed). */
  keptImageURLs?: string[];
};

// -----------------------------------------------------------------------------
// Бэлтгэлийн тэмдэглэл
// -----------------------------------------------------------------------------

/**
 * /practiceLogs/{id}
 * Багш болон эцэг эх хоёул харна.
 */
export interface PracticeLog {
  id: string;
  childId: string;
  date: string;              // YYYY-MM-DD
  duration: number;          // минутаар
  content: string;
  /** goals/{id} this session prepares for (optional; old logs have none) */
  goalId?: string;
  createdAt?: string;
}

// -----------------------------------------------------------------------------
// Goals — a competition / target the child prepares for
// -----------------------------------------------------------------------------

export type GoalStatus = "active" | "done" | "cancelled";

/**
 * /goals/{id}
 * A child may have several active goals at once (plan limit: TIER_LIMITS.maxActiveGoals).
 */
export interface Goal {
  id: string;
  childId: string;
  parentId: string;
  title: string;
  date: string;              // YYYY-MM-DD, the competition day
  category: AchievementCategory;
  targetSessionsPerWeek?: number;
  targetMinutes?: number;
  status: GoalStatus;
  linkedAchievementId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type GoalDraft = Pick<Goal, "title" | "date" | "category" | "targetSessionsPerWeek" | "targetMinutes">;

// -----------------------------------------------------------------------------
// Reflection (сэтгэлзүйн тэмдэглэл) — НУУЦ
// -----------------------------------------------------------------------------

/**
 * /reflections/{id}
 * Зөвхөн эцэг эх харна. Багш хандах эрхгүй.
 */
export interface Reflection {
  id: string;
  childId: string;
  date: string;              // YYYY-MM-DD
  mood: 1 | 2 | 3 | 4 | 5;  // 1=маш муу, 5=маш сайн
  content: string;           // хүүхдийн өөрийн тэмдэглэл
  parentNote?: string;       // эцэг эхийн нэмэлт тэмдэглэл
  createdAt?: string;
}
