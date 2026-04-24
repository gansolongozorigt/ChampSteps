// =============================================================================
// localStore — Browser-side persistence for offline / demo mode.
// When Firebase is not configured we still want:
//   • The child's name/bio/avatar to survive a page reload
//   • Added achievements to survive a reload
// Everything is namespaced by childId so multi-child works later.
// =============================================================================

import type { Achievement, Child } from "../types";

const KEY_CHILD = "champstep.child.v1";
const KEY_ACH = "champstep.achievements.v1";
const KEY_USER = "champstep.offlineUser.v1";
const KEY_SUB = "champstep.subscription.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Child
// ---------------------------------------------------------------------------

export function loadLocalChild(fallback: Child): Child {
  if (typeof window === "undefined") return fallback;
  return safeParse<Child>(window.localStorage.getItem(KEY_CHILD), fallback);
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
// Offline "user" (no real auth)
// ---------------------------------------------------------------------------

export interface OfflineUser {
  uid: string;
  email: string;
  displayName: string;
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
// Subscription (offline mock)
// ---------------------------------------------------------------------------

export interface LocalSubscription {
  status: "free" | "premium";
  activatedAt?: string;
  expiresAt?: string;
}

export function loadLocalSubscription(): LocalSubscription {
  if (typeof window === "undefined") return { status: "free" };
  return safeParse<LocalSubscription>(window.localStorage.getItem(KEY_SUB), {
    status: "free",
  });
}

export function saveLocalSubscription(sub: LocalSubscription): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_SUB, JSON.stringify(sub));
}
