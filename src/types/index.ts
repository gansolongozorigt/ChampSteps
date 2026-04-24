// =============================================================================
// ChampStep — Core Data Schema (TypeScript)
// =============================================================================
// All entities used across the application (Firestore documents, props, forms)
// are typed here so the dashboard, form, and PDF generator share one source
// of truth.
// =============================================================================

/** Subscription tiers controlled by Firebase Auth custom claims / Firestore. */
export type SubscriptionStatus = "free" | "premium";

/** Top-level competition categories used for filtering & color coding. */
export type AchievementCategory = "Sports" | "Arts" | "Academic";

/** Award medal types, used for badges and PDF iconography. */
export type AwardType = "Gold" | "Silver" | "Bronze" | "Participant";

/**
 * Authenticated parent / guardian.
 * `userId` matches the Firebase Auth uid.
 */
export interface User {
  userId: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  createdAt?: string; // ISO date
}

/**
 * A child profile owned by a parent (User).
 * Multiple children can belong to the same `parentId`.
 */
export interface Child {
  childId: string;
  parentId: string;
  name: string;
  birthDate: string; // ISO date (YYYY-MM-DD)
  bio?: string;
  avatarUrl?: string;
}

/**
 * A single competition achievement.
 * Stored in Firestore under: /children/{childId}/achievements/{id}
 */
export interface Achievement {
  id: string;
  childId: string;
  title: string; // Competition name
  date: string; // ISO date (YYYY-MM-DD)
  location: string;
  category: AchievementCategory;
  description: string;
  awardType: AwardType;
  imageURLs: string[]; // Firebase Storage download URLs
  createdAt?: string;
  updatedAt?: string;
}

/** Form draft type — `id`, `childId`, and `imageURLs` are filled later. */
export type AchievementDraft = Omit<
  Achievement,
  "id" | "childId" | "imageURLs" | "createdAt" | "updatedAt"
> & {
  /** Local File objects before they are uploaded to Storage. */
  images: File[];
};
