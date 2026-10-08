// Unit tests for the avatar state machine + reduced-motion helpers (src/avatar/stateMachine.ts).
// node --test tests/avatar-state-machine.test.mjs  (Node strips the types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FULL_MOTION, HOLD_MS, INITIAL_STATE, NO_MOTION, afterHold, motionFor, resolveReducedMotion, transition,
} from "../src/avatar/stateMachine.ts";

const STATES = ["idle", "wave", "happy", "celebrate", "sleep", "grow"];
const EVENTS = ["app:open", "practice:added", "achievement:added", "streak:milestone", "tier:grow", "inactive:3d"];

test("initial state is idle; holds match the spec", () => {
  assert.equal(INITIAL_STATE, "idle");
  assert.deepEqual(HOLD_MS, { idle: null, wave: 1800, happy: 2200, celebrate: 3000, grow: 3000, sleep: null });
});

test("every event maps to its target state with the right hold, from every current state", () => {
  const expect = {
    "app:open": ["wave", 1800],
    "practice:added": ["happy", 2200],
    "achievement:added": ["celebrate", 3000],
    "streak:milestone": ["celebrate", 3000],
    "tier:grow": ["grow", 3000],
    "inactive:3d": ["sleep", null],
  };
  for (const from of STATES) for (const ev of EVENTS) {
    const t = transition(from, ev);
    assert.deepEqual([t.next, t.holdMs], expect[ev], `${from} --${ev}--> ${t.next}`);
    assert.ok(STATES.includes(t.next));
  }
});

test("timed states fall back to idle after the hold; idle and sleep stay", () => {
  assert.equal(afterHold("wave"), "idle");
  assert.equal(afterHold("happy"), "idle");
  assert.equal(afterHold("celebrate"), "idle");
  assert.equal(afterHold("grow"), "idle");
  assert.equal(afterHold("idle"), "idle");
  assert.equal(afterHold("sleep"), "sleep", "sleep has no timer");
});

test("sleep → app:open wakes with a wave; any other event also leaves sleep; never returns to sleep by timer", () => {
  const t = transition("sleep", "app:open");
  assert.deepEqual(t, { next: "wave", holdMs: 1800 });
  assert.equal(afterHold(t.next), "idle");
  assert.equal(transition("sleep", "practice:added").next, "happy");
  assert.equal(afterHold("happy"), "idle");
});

test("a new event during a hold replaces the state and restarts the hold", () => {
  const a = transition("idle", "practice:added");      // happy 2200
  const b = transition(a.next, "achievement:added");   // celebrate 3000 (fresh hold)
  assert.deepEqual(b, { next: "celebrate", holdMs: 3000 });
  const c = transition(b.next, "achievement:added");   // same event again → same state, hold restarts
  assert.deepEqual(c, { next: "celebrate", holdMs: 3000 });
});

test("reduced motion: dev override wins over the OS preference; durations collapse to 0", () => {
  assert.equal(resolveReducedMotion(false), false);
  assert.equal(resolveReducedMotion(true), true);
  assert.equal(resolveReducedMotion(true, false), false, "override off");
  assert.equal(resolveReducedMotion(false, true), true, "override on");
  assert.equal(resolveReducedMotion(true, null), true, "null = follow OS");
  assert.equal(resolveReducedMotion(true, undefined), true);
  assert.deepEqual(motionFor(true), NO_MOTION);
  assert.deepEqual(motionFor(false), FULL_MOTION);
  for (const v of Object.values(NO_MOTION)) assert.equal(v, 0);
  assert.equal(FULL_MOTION.crossfadeMs, 250);
  assert.equal(FULL_MOTION.breatheMs, 3000);
  assert.equal(FULL_MOTION.blinkMs, 120);
  assert.ok(FULL_MOTION.blinkPeriodMs >= 4000 && FULL_MOTION.blinkPeriodMs <= 6000, "blink every 4–6 s");
});
