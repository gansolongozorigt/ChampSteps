// =============================================================================
// format.ts — Date formatting, grouping, category/award style maps.
// =============================================================================

import type { Achievement, AchievementCategory, AwardType } from "../types";

// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------

export function formatDate(iso: string, locale = "mn"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === "mn" ? "mn-MN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMonthHeading(monthKey: string, locale = "mn"): string {
  // monthKey format: "2026-04"
  const [year, month] = monthKey.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(locale === "mn" ? "mn-MN" : "en-US", {
    year: "numeric",
    month: "long",
  });
}

// -----------------------------------------------------------------------------
// Grouping
// -----------------------------------------------------------------------------

export function groupByMonth(
  achievements: Achievement[]
): [string, Achievement[]][] {
  const map = new Map<string, Achievement[]>();
  for (const a of achievements) {
    const key = a.date.slice(0, 7); // "2026-04"
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
}

// -----------------------------------------------------------------------------
// Category styles — BRAND.md: categories share one colour (primary-soft); the
// lucide icon (Dumbbell / Palette / BookOpen) tells them apart. `icon` is the
// lucide icon name for consumers that render icons.
// -----------------------------------------------------------------------------

export const categoryStyles: Record<
  AchievementCategory,
  { chip: string; dot: string; border: string; icon: "dumbbell" | "palette" | "book-open" }
> = {
  Sports: {
    chip: "bg-primary-soft text-primary-soft-ink ring-primary-soft",
    dot: "bg-primary",
    border: "border-line",
    icon: "dumbbell",
  },
  Arts: {
    chip: "bg-primary-soft text-primary-soft-ink ring-primary-soft",
    dot: "bg-primary",
    border: "border-line",
    icon: "palette",
  },
  Academic: {
    chip: "bg-primary-soft text-primary-soft-ink ring-primary-soft",
    dot: "bg-primary",
    border: "border-line",
    icon: "book-open",
  },
};

// -----------------------------------------------------------------------------
// Award styles — medal tokens (gold / silver / bronze / participant).
// `chip` / `badge` are the index.css component classes; bg/text/ring are kept
// for callers that compose their own element. The legacy `emoji` field is gone; the UI uses lucide icons.
// -----------------------------------------------------------------------------

export const awardStyles: Record<
  AwardType,
  { bg: string; text: string; ring: string; chip: string; badge: string }
> = {
  Gold: {
    bg: "bg-gold-soft",
    text: "text-ink",
    ring: "ring-gold",
    chip: "cs-chip-gold",
    badge: "cs-badge-gold",
  },
  Silver: {
    bg: "bg-silver-soft",
    text: "text-ink-2",
    ring: "ring-silver",
    chip: "cs-chip-silver",
    badge: "cs-badge-silver",
  },
  Bronze: {
    bg: "bg-bronze-soft",
    text: "text-bronze",
    ring: "ring-bronze",
    chip: "cs-chip-bronze",
    badge: "cs-badge-bronze",
  },
  Participant: {
    bg: "bg-surface-muted",
    text: "text-ink-2",
    ring: "ring-line",
    chip: "cs-chip-participant",
    badge: "cs-badge-participant",
  },
};
