// node --test tests/onboarding.test.mjs — "Эхлэх алхмууд" step logic (src/lib/onboarding.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { allStepsDone, firstSteps, preferTodayTab, showFirstSteps } from "../src/lib/onboarding.ts";

const base = { hasChild: true, goals: 0, practiceLogs: 0, achievements: 0, remindersOn: false, guest: false };
const done = (steps) => Object.fromEntries(steps.map((s) => [s.id, s.done]));

test("new parent with one child: only the child step is done, in the fixed order", () => {
  const steps = firstSteps(base);
  assert.deepEqual(steps.map((s) => s.id), ["child", "goal", "practice", "achievement", "reminder"]);
  assert.deepEqual(done(steps), { child: true, goal: false, practice: false, achievement: false, reminder: false });
  assert.equal(allStepsDone(steps), false);
});

test("existing account: steps come from its data (any goal status counts, reminder from users doc)", () => {
  const steps = firstSteps({ ...base, goals: 1, practiceLogs: 4, achievements: 9, remindersOn: true });
  assert.equal(allStepsDone(steps), true);
  assert.equal(showFirstSteps({ role: "parent", dismissed: false, steps, remindersKnown: true }), false, "done → hidden");
});

test("guest: no reminder step (push needs an account), so 4 steps can finish the card", () => {
  const steps = firstSteps({ ...base, guest: true, goals: 1, practiceLogs: 1, achievements: 1, remindersOn: null });
  assert.deepEqual(steps.map((s) => s.id), ["child", "goal", "practice", "achievement"]);
  assert.equal(allStepsDone(steps), true);
});

test("visibility: parents only, hidden when dismissed, waits for the reminder state", () => {
  const steps = firstSteps(base);
  assert.equal(showFirstSteps({ role: "parent", dismissed: false, steps, remindersKnown: true }), true);
  assert.equal(showFirstSteps({ role: "teacher", dismissed: false, steps, remindersKnown: true }), false);
  assert.equal(showFirstSteps({ role: undefined, dismissed: false, steps, remindersKnown: true }), false);
  assert.equal(showFirstSteps({ role: "parent", dismissed: true, steps, remindersKnown: true }), false);
  assert.equal(showFirstSteps({ role: "parent", dismissed: false, steps, remindersKnown: false }), false);
});

test("reminder unknown (null) is not done", () => {
  assert.equal(done(firstSteps({ ...base, remindersOn: null })).reminder, false);
});

test("default tab: Today for a parent with no practice log, unless the app was deep-linked", () => {
  assert.equal(preferTodayTab({ role: "parent", practiceLogs: 0, deepLinked: false }), true);
  assert.equal(preferTodayTab({ role: "parent", practiceLogs: 1, deepLinked: false }), false);
  assert.equal(preferTodayTab({ role: "parent", practiceLogs: 0, deepLinked: true }), false);
  assert.equal(preferTodayTab({ role: "teacher", practiceLogs: 0, deepLinked: false }), false);
});
