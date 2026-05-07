// =============================================================================
// useReflections — Firebase болон offline горим
// =============================================================================

import { useEffect, useState } from "react";
import { isFirebaseConfigured, subscribeReflections } from "../lib/firebase";
import type { Reflection } from "../types";

const KEY = "champstep.reflections.v1";

function loadLocal(childId: string): Reflection[] {
  try {
    const raw = localStorage.getItem(`${KEY}.${childId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(childId: string, items: Reflection[]) {
  localStorage.setItem(`${KEY}.${childId}`, JSON.stringify(items));
}

export function useReflections(childId: string) {
  const [reflections, setReflections] = useState<Reflection[]>(() =>
    isFirebaseConfigured ? [] : loadLocal(childId)
  );
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!childId) return;
    if (!isFirebaseConfigured) {
      setReflections(loadLocal(childId));
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeReflections(childId, (items) => {
      setReflections(items);
      setLoading(false);
    });
    return unsub;
  }, [childId]);

  function addLocal(r: Reflection) {
    setReflections((prev) => {
      const next = [r, ...prev];
      saveLocal(childId, next);
      return next;
    });
  }

  function removeLocal(id: string) {
    setReflections((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveLocal(childId, next);
      return next;
    });
  }

  return { reflections, loading, addLocal, removeLocal };
}
