// =============================================================================
// Small formatting helpers used by the dashboard and PDF builder.
// =============================================================================

import type { AchievementCategory, AwardType } from "../types";

/** Pretty date — e.g. "Apr 23, 2026". Locale aware. */
export function formatDate(iso: string, locale = "en-US"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Group achievements by ISO month (YYYY-MM) for the timeline view. */
export function groupByMonth<T extends { date: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const month = item.date.slice(0, 7); // YYYY-MM
    const bucket = groups.get(month) ?? [];
    bucket.push(item);
    groups.set(month, bucket);
  }
  // Sort months descending (newest first)
  return [...groups.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
}

/** Tailwind classes per category — keeps the journal-style palette consistent. */
export const categoryStyles: Record<
  AchievementCategory,
  { dot: string; chip: string; border: string }
> = {
  Sports: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    border: "border-emerald-200",
  },
  Arts: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    border: "border-rose-200",
  },
  Academic: {
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    border: "border-indigo-200",
  },
};

/** Award medal palette — used for badges & PDF icons. */
export const awardStyles: Record<AwardType, { ring: string; text: string; bg: string; emoji: string }> = {
  Gold:        { ring: "ring-amber-300",  text: "text-amber-800",  bg: "bg-amber-50",  emoji: "🥇" },
  Silver:      { ring: "ring-slate-300",  text: "text-slate-700",  bg: "bg-slate-50",  emoji: "🥈" },
  Bronze:      { ring: "ring-orange-300", text: "text-orange-800", bg: "bg-orange-50", emoji: "🥉" },
  Participant: { ring: "ring-sky-200",    text: "text-sky-700",    bg: "bg-sky-50",    emoji: "🎗️" },
};

/** "April 2026" header label from a YYYY-MM key. */
export function formatMonthHeading(yyyyMm: string, locale = "en-US"): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(y, m - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}
