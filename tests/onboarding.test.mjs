// node --test tests/onboarding.test.mjs — "Эхлэх алхмууд" step logic (src/lib/onboarding.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountStepCounts, allStepsDone, defaultParentTab, dismissFirstSteps, firstSteps, firstStepsDismissed, markFirstStepsComplete, showFirstSteps,
} from "../src/lib/onboarding.ts";

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

test("default tab: parent with an active goal → Practice, without → Goals; deep link and teacher keep theirs", () => {
  assert.equal(defaultParentTab({ role: "parent", hasActiveGoal: true, deepLinked: false }), "practice");
  assert.equal(defaultParentTab({ role: "parent", hasActiveGoal: false, deepLinked: false }), "goals");
  assert.equal(defaultParentTab({ role: "parent", hasActiveGoal: true, deepLinked: true }), null);
  assert.equal(defaultParentTab({ role: "teacher", hasActiveGoal: true, deepLinked: false }), null);
  assert.equal(defaultParentTab({ role: undefined, hasActiveGoal: false, deepLinked: false }), null);
});

// Bug (3 children, master, desktop): every step had been done — but for different children — and the
// card was counted per child, so it stayed on (and "Хаах" on one child did not close it on the others).
test("account-wide: steps done on other children count for the open child", () => {
  const openChild = { goals: 0, practiceLogs: 0, achievements: 0 }; // 3rd child, nothing yet
  const counts = accountStepCounts(openChild, { goal: true, practice: true, achievement: true });
  const steps = firstSteps({ ...base, ...counts, remindersOn: true });
  assert.equal(allStepsDone(steps), true);
  assert.equal(showFirstSteps({ role: "parent", dismissed: false, steps, remindersKnown: true }), false, "all done → hidden on every child");
  // the open child's own data still counts on its own
  assert.deepEqual(accountStepCounts({ goals: 2, practiceLogs: 1, achievements: 0 }, null), { goals: 2, practiceLogs: 1, achievements: 0 });
  assert.equal(done(firstSteps({ ...base, ...accountStepCounts(openChild, { goal: true, practice: false, achievement: false }) })).practice, false);
});

function withLocalStorage(fn) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  try { fn(store); } finally { delete globalThis.localStorage; }
}

test("dismissal is per account: closing once hides it for every child; legacy per-child key still counts", () => {
  withLocalStorage((store) => {
    assert.equal(firstStepsDismissed("u1"), false);
    dismissFirstSteps("u1");
    assert.equal(firstStepsDismissed("u1"), true);
    assert.equal(firstStepsDismissed("u2"), false, "another account on the device is unaffected");
    store.set("champstep.firstSteps.dismissed.u3.child_u3_1", "1"); // closed before 2026-11 on one child
    assert.equal(firstStepsDismissed("u3"), true);
  });
});

test("once seen complete the card never comes back (data deleted later)", () => {
  withLocalStorage(() => {
    markFirstStepsComplete("u1");
    const steps = firstSteps(base); // e.g. achievements deleted afterwards
    assert.equal(showFirstSteps({ role: "parent", dismissed: firstStepsDismissed("u1"), steps, remindersKnown: true }), false);
  });
});
