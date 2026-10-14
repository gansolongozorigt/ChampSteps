// =============================================================================
// goals — pure helpers for goals (no React, no Firebase).
// Statistics come from the practice logs that carry this goal's id.
// Unit tests: tests/goals.test.mjs (node --import tsx --test).
// =============================================================================

import type { Goal, PracticeLog, AchievementPrep } from "../types";
import { addDays, localDateKey, loggedDays } from "./streak";

/** Whole days from `from` to `to` (YYYY-MM-DD), negative when `to` is earlier. */
export function diffDays(from: string, to: string): number {
  const a = new Date(from + "T12:00:00");
  const b = new Date(to + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export interface GoalStats {
  /** distinct days with a session for this goal */
  days: number;
  sessions: number;
  minutes: number;
  /** longest run of consecutive logged days */
  longestStreak: number;
  /** days from the goal's start (createdAt day) to the competition, inclusive (>= 1) */
  daysTotal: number;
  /** days until the competition: 0 = today, negative = past */
  daysLeft: number;
  /** sessions in the current Monday-to-Sunday week */
  weekSessions: number;
  weekMinutes: number;
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const d = new Date(day + "T12:00:00");
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  return addDays(day, -dow);
}

export function longestStreak(days: Set<string>): number {
  let best = 0;
  for (const d of days) {
    if (days.has(addDays(d, -1))) continue; // not the start of a run
    let n = 1;
    let cur = d;
    while (days.has(addDays(cur, 1))) { n++; cur = addDays(cur, 1); }
    best = Math.max(best, n);
  }
  return best;
}

/** The goal's first day: its creation day, or today while the write is still pending. */
export function goalStartDay(goal: Pick<Goal, "createdAt">, today: string): string {
  const raw = goal.createdAt as unknown;
  if (!raw) return today;
  const d = typeof raw === "string" ? new Date(raw) : typeof (raw as { toDate?: () => Date }).toDate === "function" ? (raw as { toDate: () => Date }).toDate() : null;
  if (!d || isNaN(d.getTime())) return today;
  return localDateKey(d);
}

/** Logs that belong to the goal (goalId match only; older untagged logs are not counted). */
export function logsForGoal(goal: Pick<Goal, "id">, logs: PracticeLog[]): PracticeLog[] {
  return logs.filter((l) => l.goalId === goal.id);
}

export function goalStats(goal: Pick<Goal, "id" | "date" | "createdAt">, logs: PracticeLog[], today: string): GoalStats {
  const mine = logsForGoal(goal, logs);
  const days = loggedDays(mine);
  const start = goalStartDay(goal, today);
  const ws = weekStart(today);
  const we = addDays(ws, 6);
  const week = mine.filter((l) => l.date >= ws && l.date <= we);
  return {
    days: days.size,
    sessions: mine.length,
    minutes: mine.reduce((s, l) => s + (Number(l.duration) || 0), 0),
    longestStreak: longestStreak(days),
    daysTotal: Math.max(1, diffDays(start, goal.date) + 1),
    daysLeft: diffDays(today, goal.date),
    weekSessions: week.length,
    weekMinutes: week.reduce((s, l) => s + (Number(l.duration) || 0), 0),
  };
}

/** What gets copied onto the achievement when the result is recorded. */
export function prepFromStats(goalId: string, s: GoalStats): AchievementPrep {
  return { goalId, days: s.days, sessions: s.sessions, minutes: s.minutes, daysTotal: s.daysTotal };
}

export function activeGoals(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.status === "active").sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The soonest active goal with a date today or later (for "next competition" lines). */
export function nextGoal(goals: Goal[], today: string): Goal | null {
  return activeGoals(goals).find((g) => g.date >= today) ?? null;
}

/** Active goals whose date is today — the celebration screen. */
export function goalsToday(goals: Goal[], today: string): Goal[] {
  return activeGoals(goals).filter((g) => g.date === today);
}

/** Active goals whose date has passed without a result — "how did it go?" card. */
export function overdueGoals(goals: Goal[], today: string): Goal[] {
  return activeGoals(goals).filter((g) => g.date < today);
}

/** "31 цаг" style: whole hours, or minutes under one hour. */
export function hoursLabel(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
