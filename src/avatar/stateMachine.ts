// src/avatar/stateMachine.ts — pure transition table for the avatar.
// No runtime imports: unit-tested with `node --test` (types are erased).
//
//   (current, event) → { next, holdMs }
//   holdMs: how long `next` is shown before falling back to idle (null = stays:
//   idle stays idle, sleep stays asleep until the next event — app:open wakes it).
import type { AvatarEvent, AvatarState } from "./types";

export interface Transition {
  next: AvatarState;
  /** ms until the state auto-returns to idle; null = no timer. */
  holdMs: number | null;
}

/** Hold time per timed state (ms). */
export const HOLD_MS: Readonly<Record<AvatarState, number | null>> = {
  idle: null,
  wave: 1800,
  happy: 2200,
  celebrate: 3000,
  grow: 3000,
  sleep: null,
};

const TARGET: Readonly<Record<AvatarEvent, AvatarState>> = {
  "app:open": "wave",
  "practice:added": "happy",
  "achievement:added": "celebrate",
  "streak:milestone": "celebrate",
  "tier:grow": "grow",
  "inactive:3d": "sleep",
};

/**
 * Every event wins over the current state (a new event restarts the hold).
 * Sleep is left by ANY event (app:open → wave, practice:added → happy, …);
 * timed states fall back to idle via afterHold(), never back to sleep.
 */
export function transition(current: AvatarState, event: AvatarEvent): Transition {
  void current; // kept in the signature so future rules (e.g. ignore inactive:3d while celebrating) stay pure
  const next = TARGET[event];
  return { next, holdMs: HOLD_MS[next] };
}

/** State after a hold timer fires. */
export function afterHold(state: AvatarState): AvatarState {
  return HOLD_MS[state] === null ? state : "idle";
}

export const INITIAL_STATE: AvatarState = "idle";

// -----------------------------------------------------------------------------
// Motion (pure): every duration collapses to 0 under reduced motion.
// -----------------------------------------------------------------------------
export interface Motion {
  crossfadeMs: number;
  breatheMs: number;
  blinkPeriodMs: number;
  blinkMs: number;
  sparkMs: number;
}

export const FULL_MOTION: Readonly<Motion> = { crossfadeMs: 250, breatheMs: 3000, blinkPeriodMs: 5000, blinkMs: 120, sparkMs: 900 };
export const NO_MOTION: Readonly<Motion> = { crossfadeMs: 0, breatheMs: 0, blinkPeriodMs: 0, blinkMs: 0, sparkMs: 0 };

/** override (dev toggle) wins over the system preference. */
export function resolveReducedMotion(systemPrefersReduced: boolean, override?: boolean | null): boolean {
  return typeof override === "boolean" ? override : systemPrefersReduced;
}

export function motionFor(reduced: boolean): Readonly<Motion> {
  return reduced ? NO_MOTION : FULL_MOTION;
}
