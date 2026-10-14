// =============================================================================
// pendingWrites — how many local Firestore writes are still waiting for the server.
// Each live subscription reports its own count (docs with metadata.hasPendingWrites);
// the offline banner shows the total. No Firebase import: plain external store.
// =============================================================================

import { useSyncExternalStore } from "react";

const counts = new Map<string, number>();
const listeners = new Set<() => void>();
let total = 0;

function recompute() {
  let n = 0;
  for (const v of counts.values()) n += v;
  if (n === total) return;
  total = n;
  for (const l of listeners) l();
}

/** Report the pending-write count of one subscription (key = collection + childId). */
export function reportPending(key: string, n: number) {
  if (counts.get(key) === n) return;
  if (n === 0) counts.delete(key); else counts.set(key, n);
  recompute();
}

export function pendingWriteCount(): number {
  return total;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Total number of queued (not yet acknowledged) writes across live subscriptions. */
export function usePendingWrites(): number {
  return useSyncExternalStore(subscribe, pendingWriteCount, () => 0);
}
