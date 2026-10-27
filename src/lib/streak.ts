// =============================================================================
// streak — pure date helpers for the "Today" screen (no React, no Firebase).
// Dates are local calendar days as YYYY-MM-DD, the same format practiceLogs.date uses.
// Unit tests: tests/streak.test.mjs (node --import tsx --test).
// =============================================================================

/** Local calendar day of a Date as YYYY-MM-DD (never toISOString: that is UTC). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD shifted by `days` (negative = past). Safe across month/DST boundaries. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  return localDateKey(dt);
}

/** The `n` days ending on `end` (inclusive), oldest first. */
export function lastNDays(end: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/** Distinct days that have at least one log. Several logs on one day count once. */
export function loggedDays(logs: Array<{ date: string }>): Set<string> {
  const s = new Set<string>();
  for (const l of logs) if (typeof l.date === "string" && l.date.length === 10) s.add(l.date);
  return s;
}

/**
 * Consecutive logged days ending today, or ending yesterday when today has no log
 * yet (the streak is still alive until midnight). 0 when neither day is logged.
 */
export function currentStreak(days: Set<string>, today: string): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) return 0;
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

// -----------------------------------------------------------------------------
// Labels. Browsers ship patchy "mn" Intl data (desktop Chrome prints "M10 14, Wed"),
// so Mongolian names are spelled out here; en/ru use Intl.
// -----------------------------------------------------------------------------

const MN_WEEKDAYS_SHORT = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"]; // Sunday first
const MN_WEEKDAYS_LONG = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

function toDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Two-letter weekday for the 7-day strip. */
export function weekdayShort(key: string, lang: string): string {
  const d = toDate(key);
  if (lang.startsWith("mn")) return MN_WEEKDAYS_SHORT[d.getDay()];
  return d.toLocaleDateString(lang.startsWith("ru") ? "ru-RU" : "en-US", { weekday: "short" }).replace(".", "").slice(0, 2);
}

/** "10-р сарын 14, Лхагва" / "Wednesday, October 14" / "среда, 14 октября" (weekday optional). */
export function dayLabel(key: string, lang: string, withWeekday = true): string {
  const d = toDate(key);
  if (lang.startsWith("mn")) {
    const base = `${d.getMonth() + 1}-р сарын ${d.getDate()}`;
    return withWeekday ? `${base}, ${MN_WEEKDAYS_LONG[d.getDay()]}` : base;
  }
  const locale = lang.startsWith("ru") ? "ru-RU" : "en-US";
  return d.toLocaleDateString(locale, withWeekday ? { weekday: "long", month: "long", day: "numeric" } : { month: "long", day: "numeric" });
}
