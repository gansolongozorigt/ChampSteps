// =============================================================================
// useGoals — a child's goals (Firestore live, or localStorage in local mode).
// =============================================================================

import { useEffect, useState } from "react";
import { isFirebaseConfigured, subscribeGoals } from "../lib/firebase";
import { KEY_GOALS, loadLocalGoals, saveLocalGoals } from "../lib/localStore";
import type { Goal } from "../types";

/** @param local true -> localStorage only (Firebase not configured, or a guest / trial user). */
export function useGoals(childId: string, local: boolean = !isFirebaseConfigured) {
  const [goals, setGoals] = useState<Goal[]>(() => (local && childId ? loadLocalGoals(childId) : []));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    if (local) { setGoals(loadLocalGoals(childId)); return; }
    setError(null);
    return subscribeGoals(
      childId,
      (items) => { setGoals(items); setError(null); },
      (err) => setError(err instanceof Error ? err.message : "Failed to load goals")
    );
  }, [childId, local]);

  function upsertLocal(goal: Goal) {
    setGoals((prev) => {
      const next = prev.some((g) => g.id === goal.id) ? prev.map((g) => (g.id === goal.id ? goal : g)) : [...prev, goal];
      saveLocalGoals(childId, next);
      return next;
    });
  }
  function removeLocal(id: string) {
    setGoals((prev) => { const next = prev.filter((g) => g.id !== id); saveLocalGoals(childId, next); return next; });
  }

  return { goals, error, upsertLocal, removeLocal, storageKey: `${KEY_GOALS}.${childId}` };
}
