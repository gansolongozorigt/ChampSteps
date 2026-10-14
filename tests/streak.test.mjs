// node --import tsx --test tests/streak.test.mjs — src/lib/streak.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, currentStreak, lastNDays, localDateKey, loggedDays } from "../src/lib/streak.ts";

test("localDateKey uses the local calendar day, not UTC", () => {
  const d = new Date(2026, 9, 14, 23, 30); // 2026-10-14 23:30 local
  assert.equal(localDateKey(d), "2026-10-14");
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-10-14", -14), "2026-09-30");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("lastNDays returns n days ending on the given day, oldest first", () => {
  assert.deepEqual(lastNDays("2026-10-14", 7), ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]);
});

test("loggedDays: several logs on one day count once", () => {
  const days = loggedDays([{ date: "2026-10-14" }, { date: "2026-10-14" }, { date: "2026-10-13" }, { date: "bad" }]);
  assert.deepEqual([...days].sort(), ["2026-10-13", "2026-10-14"]);
});

test("currentStreak counts consecutive days ending today", () => {
  const days = new Set(["2026-10-12", "2026-10-13", "2026-10-14"]);
  assert.equal(currentStreak(days, "2026-10-14"), 3);
});

test("currentStreak stays alive when today is not logged yet (ends yesterday)", () => {
  const days = new Set(["2026-10-12", "2026-10-13"]);
  assert.equal(currentStreak(days, "2026-10-14"), 2);
});

test("currentStreak is 0 when neither today nor yesterday is logged", () => {
  assert.equal(currentStreak(new Set(["2026-10-10"]), "2026-10-14"), 0);
  assert.equal(currentStreak(new Set(), "2026-10-14"), 0);
});

test("currentStreak breaks on a gap", () => {
  const days = new Set(["2026-10-10", "2026-10-11", "2026-10-13", "2026-10-14"]);
  assert.equal(currentStreak(days, "2026-10-14"), 2);
});

test("labels: Mongolian names are spelled out, en/ru via Intl", async () => {
  const { dayLabel, weekdayShort } = await import("../src/lib/streak.ts");
  assert.equal(dayLabel("2026-10-14", "mn"), "10-р сарын 14, Лхагва");
  assert.equal(weekdayShort("2026-10-14", "mn"), "Лх");
  assert.equal(weekdayShort("2026-10-18", "mn"), "Ня");
  assert.equal(dayLabel("2026-10-14", "en"), "Wednesday, October 14");
  assert.equal(dayLabel("2026-10-14", "mn", false), "10-р сарын 14");
  assert.equal(dayLabel("2026-10-14", "en", false), "October 14");
  assert.equal(weekdayShort("2026-10-14", "en"), "We");
  assert.match(dayLabel("2026-10-14", "ru"), /14 октября/);
});
