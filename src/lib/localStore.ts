// =============================================================================
// localStore — offline/demo mode persistence
// =============================================================================

import type { Achievement, Child, PracticeLog, Reflection, SubscriptionTier, UserRole } from "../types";

const KEY_CHILD = "champstep.child.v1";
const KEY_ACH = "champstep.achievements.v1";
const KEY_USER = "champstep.offlineUser.v1";
const KEY_SUB = "champstep.subscription.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Child
// ---------------------------------------------------------------------------

/** The one offline child, or null when none was added yet (no default child is ever created). */
export function loadLocalChild(): Child | null {
  if (typeof window === "undefined") return null;
  return safeParse<Child | null>(window.localStorage.getItem(KEY_CHILD), null);
}

export function clearLocalChild(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_CHILD);
}

export function saveLocalChild(child: Child): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_CHILD, JSON.stringify(child));
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export function loadLocalAchievements(fallback: Achievement[]): Achievement[] {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(KEY_ACH);
  if (raw === null) return fallback;
  return safeParse<Achievement[]>(raw, fallback);
}

export function saveLocalAchievements(items: Achievement[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_ACH, JSON.stringify(items));
}

// ---------------------------------------------------------------------------
// Offline user
// ---------------------------------------------------------------------------

export interface OfflineUser {
  uid: string;
  email: string;
  displayName: string;
  role?: UserRole;
  createdAt: string;
}

export function loadOfflineUser(): OfflineUser | null {
  if (typeof window === "undefined") return null;
  return safeParse<OfflineUser | null>(window.localStorage.getItem(KEY_USER), null);
}

export function saveOfflineUser(user: OfflineUser | null): void {
  if (typeof window === "undefined") return;
  if (user === null) {
    window.localStorage.removeItem(KEY_USER);
  } else {
    window.localStorage.setItem(KEY_USER, JSON.stringify(user));
  }
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export interface LocalSubscription {
  status: SubscriptionTier;
  activatedAt?: string;
  expiresAt?: string;
}

export function loadLocalSubscription(): LocalSubscription {
  if (typeof window === "undefined") return { status: "free" };
  return safeParse<LocalSubscription>(
    window.localStorage.getItem(KEY_SUB),
    { status: "free" }
  );
}

export function saveLocalSubscription(sub: LocalSubscription): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_SUB, JSON.stringify(sub));
}

// ---------------------------------------------------------------------------
// Practice logs / reflections (per child) — keys shared with the hooks
// ---------------------------------------------------------------------------

export const KEY_PRACTICE = "champstep.practiceLogs.v1";
export const KEY_REFLECTIONS = "champstep.reflections.v1";

function loadList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  return safeParse<T[]>(window.localStorage.getItem(key), []);
}
export function loadLocalPracticeLogs(childId: string): PracticeLog[] {
  return loadList<PracticeLog>(`${KEY_PRACTICE}.${childId}`);
}
export function loadLocalReflections(childId: string): Reflection[] {
  return loadList<Reflection>(`${KEY_REFLECTIONS}.${childId}`);
}

// ---------------------------------------------------------------------------
// Guest (trial) data as a whole — used by the sign-up migration prompt
// ---------------------------------------------------------------------------

export interface LocalData {
  child: Child;
  achievements: Achievement[];
  practiceLogs: PracticeLog[];
  reflections: Reflection[];
}

/** Everything the guest mode stored on this device, or null when there is no child. */
export function loadLocalData(): LocalData | null {
  const child = loadLocalChild();
  if (!child) return null;
  return {
    child,
    achievements: loadLocalAchievements([]).filter((a) => a.childId === child.childId),
    practiceLogs: loadLocalPracticeLogs(child.childId),
    reflections: loadLocalReflections(child.childId),
  };
}

/** Remove the guest child and everything attached to it (after migration or child deletion). */
export function clearLocalData(): void {
  if (typeof window === "undefined") return;
  const child = loadLocalChild();
  if (child) {
    window.localStorage.removeItem(`${KEY_PRACTICE}.${child.childId}`);
    window.localStorage.removeItem(`${KEY_REFLECTIONS}.${child.childId}`);
  }
  window.localStorage.removeItem(KEY_ACH);
  window.localStorage.removeItem(KEY_CHILD);
}

/** sessionStorage flag: LoginPage opens in sign-up mode (set by the guest banner before signing the guest out). */
export const LOGIN_MODE_KEY = "champstep.loginMode";
