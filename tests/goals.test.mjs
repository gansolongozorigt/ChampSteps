// node --import tsx --test tests/goals.test.mjs — src/lib/goals.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeGoals, diffDays, goalStats, goalStartDay, goalsToday, longestStreak, nextGoal, overdueGoals, prepFromStats, weekStart } from "../src/lib/goals.ts";

const TODAY = "2026-10-14"; // Wednesday
const goal = { id: "g1", childId: "k", parentId: "p", title: "Cup", date: "2026-12-13", category: "Sports", status: "active", createdAt: "2026-10-14T03:00:00.000Z" };
const log = (date, duration = 30, goalId = "g1") => ({ id: date + duration, childId: "k", date, duration, content: "x", goalId });

test("diffDays: signed whole days across month boundaries", () => {
  assert.equal(diffDays("2026-10-14", "2026-12-13"), 60);
  assert.equal(diffDays("2026-12-13", "2026-10-14"), -60);
  assert.equal(diffDays("2026-10-14", "2026-10-14"), 0);
});

test("weekStart is Monday", () => {
  assert.equal(weekStart("2026-10-14"), "2026-10-12");
  assert.equal(weekStart("2026-10-12"), "2026-10-12");
  assert.equal(weekStart("2026-10-18"), "2026-10-12"); // Sunday belongs to the week that started Monday
});

test("longestStreak finds the longest consecutive run", () => {
  assert.equal(longestStreak(new Set(["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05", "2026-10-06"])), 3);
  assert.equal(longestStreak(new Set()), 0);
});

test("goalStartDay: createdAt (string or Timestamp-like) → local day; pending write → today", () => {
  assert.equal(goalStartDay({ createdAt: "2026-10-01T20:00:00.000Z" }, TODAY).length, 10);
  assert.equal(goalStartDay({ createdAt: { toDate: () => new Date(2026, 9, 3, 9) } }, TODAY), "2026-10-03");
  assert.equal(goalStartDay({ createdAt: undefined }, TODAY), TODAY);
  assert.equal(goalStartDay({ createdAt: null }, TODAY), TODAY);
});

test("goalStats: only this goal's logs count; days are distinct; week window is Mon–Sun", () => {
  const logs = [
    log("2026-10-12", 30), log("2026-10-12", 45),   // same day, 2 sessions
    log("2026-10-13", 60),
    log("2026-10-14", 15),
    log("2026-10-11", 30),                           // Sunday of the previous week
    log("2026-10-13", 60, "other"),                  // another goal
    { id: "old", childId: "k", date: "2026-10-13", duration: 60, content: "untagged" }, // no goalId
  ];
  const s = goalStats(goal, logs, TODAY);
  assert.equal(s.sessions, 5);
  assert.equal(s.days, 4);
  assert.equal(s.minutes, 180);
  assert.equal(s.longestStreak, 4); // 11,12,13,14
  assert.equal(s.daysTotal, 61);     // 2026-10-14 .. 2026-12-13 inclusive
  assert.equal(s.daysLeft, 60);
  assert.equal(s.weekSessions, 4);   // 12,12,13,14
  assert.equal(s.weekMinutes, 150);
});

test("goalStats: daysTotal is at least 1 and daysLeft goes negative after the date", () => {
  const s = goalStats({ ...goal, date: "2026-10-10", createdAt: "2026-10-10T01:00:00Z" }, [], "2026-10-14");
  assert.equal(s.daysTotal >= 1, true);
  assert.equal(s.daysLeft, -4);
  const same = goalStats({ ...goal, date: TODAY }, [log(TODAY)], TODAY);
  assert.equal(same.daysTotal, 1);
  assert.equal(same.daysLeft, 0);
});

test("prepFromStats copies the four numbers", () => {
  const s = goalStats(goal, [log("2026-10-14", 30)], TODAY);
  assert.deepEqual(prepFromStats("g1", s), { goalId: "g1", days: 1, sessions: 1, minutes: 30, daysTotal: 61 });
});

test("activeGoals / nextGoal / goalsToday / overdueGoals", () => {
  const goals = [
    { ...goal, id: "a", date: "2026-11-01" },
    { ...goal, id: "b", date: "2026-10-20" },
    { ...goal, id: "c", date: "2026-10-01" },                 // past, still active → overdue
    { ...goal, id: "d", date: "2026-10-14" },                 // today
    { ...goal, id: "e", date: "2026-10-15", status: "done" },
    { ...goal, id: "f", date: "2026-10-16", status: "cancelled" },
  ];
  assert.deepEqual(activeGoals(goals).map((g) => g.id), ["c", "d", "b", "a"]);
  assert.equal(nextGoal(goals, TODAY).id, "d");
  assert.deepEqual(goalsToday(goals, TODAY).map((g) => g.id), ["d"]);
  assert.deepEqual(overdueGoals(goals, TODAY).map((g) => g.id), ["c"]);
  assert.equal(nextGoal([], TODAY), null);
});
