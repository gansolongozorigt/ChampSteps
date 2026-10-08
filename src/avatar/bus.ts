// src/avatar/bus.ts — tiny window-level event bus so App.tsx can notify the
// (lazily mounted) avatar without threading props through production
// components. Side-effect free: when the flag is off nothing imports it and
// Rollup drops it. Events fired before a subscriber exists are kept for a
// few seconds and replayed on subscribe (app:open fires before the lazy slot mounts).
import type { AvatarEvent } from "./types";

const NAME = "champstep:avatar";
const REPLAY_MS = 10_000;
type Msg = { type: "event"; event: AvatarEvent; at: number } | { type: "energy"; pct: number; at: number };

let pending: Msg[] = [];
let subscribers = 0;
let lastEnergy = 0;

function dispatch(msg: Msg) {
  if (typeof window === "undefined") return;
  if (subscribers === 0) { pending = [...pending.filter((m) => msg.at - m.at < REPLAY_MS), msg]; return; }
  window.dispatchEvent(new CustomEvent<Msg>(NAME, { detail: msg }));
}

export function emitAvatarEvent(event: AvatarEvent) {
  dispatch({ type: "event", event, at: Date.now() });
}

/** 0–100; remembered so a slot mounting later starts with the right ring. */
export function emitAvatarEnergy(pct: number) {
  lastEnergy = Math.max(0, Math.min(100, Math.round(pct)));
  dispatch({ type: "energy", pct: lastEnergy, at: Date.now() });
}

export function getLastEnergy(): number {
  return lastEnergy;
}

export function subscribeAvatar(cb: (msg: Msg) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<Msg>).detail);
  window.addEventListener(NAME, handler);
  subscribers++;
  const now = Date.now();
  const replay = pending.filter((m) => now - m.at < REPLAY_MS);
  pending = [];
  queueMicrotask(() => replay.forEach(cb));
  return () => { window.removeEventListener(NAME, handler); subscribers--; };
}
