// =============================================================================
// usePracticeLogs — Firebase болон offline горим дэмжинэ
// =============================================================================

import { useEffect, useState } from "react";
import { isFirebaseConfigured, subscribePracticeLogs } from "../lib/firebase";
import { KEY_PRACTICE as KEY } from "../lib/localStore";
import type { PracticeLog } from "../types";

function loadLocal(childId: string): PracticeLog[] {
  try {
    const raw = localStorage.getItem(`${KEY}.${childId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(childId: string, logs: PracticeLog[]) {
  localStorage.setItem(`${KEY}.${childId}`, JSON.stringify(logs));
}

/** @param local true -> localStorage only (Firebase not configured, or a guest / trial user). */
export function usePracticeLogs(childId: string, local: boolean = !isFirebaseConfigured) {
  const [logs, setLogs] = useState<PracticeLog[]>(() =>
    local ? loadLocal(childId) : []
  );
  const [loading, setLoading] = useState(!local);
  const [error, setError] = useState<string | null>(null);
  /** childId whose logs are in `logs` (they lag one render behind a child switch). */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    if (local) {
      setLogs(loadLocal(childId));
      setLoadedFor(childId);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribePracticeLogs(
      childId,
      (items) => { setLogs(items); setLoadedFor(childId); setLoading(false); setError(null); },
      (err) => { setError(err instanceof Error ? err.message : "Failed to load practice logs"); setLoading(false); }
    );
    return unsub;
  }, [childId, local]);

  function addLocal(log: PracticeLog) {
    setLogs((prev) => {
      const next = [log, ...prev];
      saveLocal(childId, next);
      return next;
    });
  }

  function removeLocal(id: string) {
    setLogs((prev) => {
      const next = prev.filter((l) => l.id !== id);
      saveLocal(childId, next);
      return next;
    });
  }

  return { logs, loading, loadedFor, error, addLocal, removeLocal };
}
