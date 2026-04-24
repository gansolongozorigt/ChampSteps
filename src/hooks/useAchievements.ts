// =============================================================================
// useAchievements — React hook that owns a child's achievements.
//
//   • Firebase mode  → subscribes to Firestore via onSnapshot.
//   • Offline mode   → reads/writes localStorage so entries persist on reload.
//
// Returned actions:
//   addLocal(item)  — persist a new achievement in offline mode.
//
// In Firebase mode, callers write via lib/firebase.createAchievement; the
// snapshot updates this hook automatically.
// =============================================================================

import { useEffect, useState } from "react";
import { isFirebaseConfigured, subscribeAchievements } from "../lib/firebase";
import { loadLocalAchievements, saveLocalAchievements } from "../lib/localStore";
import type { Achievement } from "../types";

export interface UseAchievementsResult {
  achievements: Achievement[];
  loading: boolean;
  error: string | null;
  /** Offline-only: insert a new achievement and persist to localStorage. */
  addLocal: (item: Achievement) => void;
}

export function useAchievements(
  childId: string,
  /** Seed used only on first offline render when localStorage is empty. */
  fallback: Achievement[] = []
): UseAchievementsResult {
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    if (isFirebaseConfigured) return [];
    return loadLocalAchievements(fallback);
  });
  const [loading, setLoading] = useState<boolean>(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAchievements(loadLocalAchievements(fallback));
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeAchievements(
      childId,
      (items) => {
        setAchievements(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load achievements");
        setLoading(false);
      }
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  function addLocal(item: Achievement) {
    setAchievements((prev) => {
      const next = [item, ...prev];
      saveLocalAchievements(next);
      return next;
    });
  }

  return { achievements, loading, error, addLocal };
}
