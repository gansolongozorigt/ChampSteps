// =============================================================================
// format.ts — Date formatting, grouping, category/award style maps.
// =============================================================================
// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------
export function formatDate(iso, locale = "mn") {
    if (!iso)
        return "";
    const d = new Date(iso);
    if (isNaN(d.getTime()))
        return iso;
    return d.toLocaleDateString(locale === "mn" ? "mn-MN" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
export function formatMonthHeading(monthKey, locale = "mn") {
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
export function groupByMonth(achievements) {
    const map = new Map();
    for (const a of achievements) {
        const key = a.date.slice(0, 7); // "2026-04"
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
}
// -----------------------------------------------------------------------------
// Category styles
// -----------------------------------------------------------------------------
export const categoryStyles = {
    Sports: {
        chip: "bg-blue-50 text-blue-700 ring-blue-200",
        dot: "bg-blue-400",
        border: "border-blue-100",
    },
    Arts: {
        chip: "bg-purple-50 text-purple-700 ring-purple-200",
        dot: "bg-purple-400",
        border: "border-purple-100",
    },
    Academic: {
        chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        dot: "bg-emerald-400",
        border: "border-emerald-100",
    },
};
// -----------------------------------------------------------------------------
// Award styles
// -----------------------------------------------------------------------------
export const awardStyles = {
    Gold: {
        emoji: "🥇",
        bg: "bg-amber-50",
        text: "text-amber-800",
        ring: "ring-amber-300",
    },
    Silver: {
        emoji: "🥈",
        bg: "bg-slate-50",
        text: "text-slate-700",
        ring: "ring-slate-300",
    },
    Bronze: {
        emoji: "🥉",
        bg: "bg-orange-50",
        text: "text-orange-800",
        ring: "ring-orange-300",
    },
    Participant: {
        emoji: "🎖️",
        bg: "bg-stone-50",
        text: "text-stone-600",
        ring: "ring-stone-200",
    },
};
