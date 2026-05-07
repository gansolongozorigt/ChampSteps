// =============================================================================
// TimelineDashboard v2 — edit/delete товчтой
// =============================================================================

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Achievement, AchievementCategory, Child } from "../types";
import {
  awardStyles,
  categoryStyles,
  formatDate,
  formatMonthHeading,
  groupByMonth,
} from "../utils/format";
import EmptyState from "./EmptyState";
import LanguageToggle from "./LanguageToggle";

type CategoryFilter = AchievementCategory | "All";
type SortOrder = "newest" | "oldest";

export interface TimelineDashboardProps {
  child: Child;
  achievements: Achievement[];
  onAddClick?: () => void;
  onEditProfile?: () => void;
  onEditAchievement?: (a: Achievement) => void;
  onDeleteAchievement?: (id: string) => void;
}

export default function TimelineDashboard({
  child,
  achievements,
  onAddClick,
  onEditProfile,
  onEditAchievement,
  onDeleteAchievement,
}: TimelineDashboardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [filter, setFilter] = useState<CategoryFilter>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...achievements].sort((a, b) => (a.date < b.date ? 1 : -1));
    return sort === "newest" ? arr : arr.reverse();
  }, [achievements, sort]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    return sorted.filter((a) => {
      if (filter !== "All" && a.category !== filter) return false;
      if (!q) return true;
      const haystack = `${a.title} ${a.location} ${a.description}`.toLocaleLowerCase(locale);
      return haystack.includes(q);
    });
  }, [sorted, filter, query, locale]);

  const grouped = useMemo(() => groupByMonth(visible), [visible]);

  const stats = useMemo(() => {
    const total = achievements.length;
    const golds = achievements.filter((a) => a.awardType === "Gold").length;
    const byCat: Record<AchievementCategory, number> = { Sports: 0, Arts: 0, Academic: 0 };
    for (const a of achievements) byCat[a.category] += 1;
    const topCategory = (Object.entries(byCat) as [AchievementCategory, number][])
      .sort(([, x], [, y]) => y - x)[0];
    return { total, golds, topCategory };
  }, [achievements]);

  const filtersActive = filter !== "All" || query.trim().length > 0;

  function resetFilters() {
    setFilter("All");
    setQuery("");
  }

  function handleDeleteConfirm(id: string) {
    setDeleteConfirmId(id);
  }

  function handleDeleteCancel() {
    setDeleteConfirmId(null);
  }

  function handleDeleteExecute(id: string) {
    onDeleteAchievement?.(id);
    setDeleteConfirmId(null);
  }

  return (
    <div className="min-h-screen bg-stone-100/70">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Profile header */}
        <header className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={onEditProfile}
            className="group flex items-center gap-4 rounded-xl p-1 text-left transition hover:bg-stone-200/50"
            aria-label={t("app.editProfile")}
          >
            {child.avatarUrl ? (
              <img
                src={child.avatarUrl}
                alt={child.name}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-200 text-lg font-semibold text-stone-600">
                {child.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-stone-500">{t("app.journal")}</p>
              <h1 className="font-serif text-2xl text-stone-900 sm:text-3xl">
                {t("app.achievementsTitle", { name: child.name })}
              </h1>
              {child.bio && <p className="mt-0.5 text-sm text-stone-500">{child.bio}</p>}
              <span className="mt-1 inline-block text-[11px] text-stone-400 opacity-0 transition group-hover:opacity-100">
                ✎ {t("app.editProfile")}
              </span>
            </div>
          </button>

          <div className="flex flex-col items-end gap-2">
            <LanguageToggle />
            <button
              type="button"
              onClick={onAddClick}
              className="hidden rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 hover:bg-stone-800 sm:inline-flex"
            >
              + {t("app.addAchievement")}
            </button>
          </div>
        </header>

        {/* Summary cards */}
        <section className="mt-6 grid grid-cols-3 gap-3">
          <SummaryCard label={t("summary.total")} value={stats.total} hint={t("summary.entries")} />
          <SummaryCard label={t("summary.gold")} value={stats.golds} hint="🥇" />
          <SummaryCard
            label={t("summary.topCategory")}
            value={stats.topCategory?.[1] ?? 0}
            hint={stats.topCategory && stats.topCategory[1] > 0
              ? t(`categories.${stats.topCategory[0]}`)
              : "—"}
          />
        </section>

        {/* Controls */}
        {achievements.length > 0 && (
          <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                🔍
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search.placeholder")}
                className="w-full rounded-full border border-stone-200 bg-white py-2 pl-9 pr-4 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-stone-500">
              <span className="whitespace-nowrap">{t("search.sort")}:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-200"
              >
                <option value="newest">{t("search.newestFirst")}</option>
                <option value="oldest">{t("search.oldestFirst")}</option>
              </select>
            </label>
          </section>
        )}

        {/* Category filter chips */}
        {achievements.length > 0 && (
          <nav className="mt-4 flex flex-wrap gap-2">
            {(["All", "Sports", "Arts", "Academic"] as CategoryFilter[]).map((c) => {
              const selected = filter === c;
              const stylesForChip =
                c !== "All" ? categoryStyles[c].chip : "bg-stone-900 text-white ring-stone-900";
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={`rounded-full px-3.5 py-1 text-xs font-medium ring-1 transition ${
                    selected
                      ? `${stylesForChip} ring-2`
                      : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50"
                  }`}
                >
                  {t(`categories.${c}`)}
                </button>
              );
            })}
          </nav>
        )}

        {/* Timeline */}
        <section className="relative mt-8">
          {achievements.length === 0 ? (
            <EmptyState variant="journal" onPrimary={onAddClick} />
          ) : grouped.length === 0 ? (
            <EmptyState variant="filtered" onPrimary={resetFilters} />
          ) : (
            <ol className="relative space-y-10 pl-6 sm:pl-8">
              <span
                aria-hidden
                className="absolute bottom-0 left-2 top-0 w-px bg-gradient-to-b from-stone-300 via-stone-200 to-transparent sm:left-3"
              />
              {grouped.map(([month, items]) => (
                <li key={month}>
                  <h2 className="mb-3 font-serif text-sm uppercase tracking-widest text-stone-500">
                    {formatMonthHeading(month, locale)}
                  </h2>
                  <ul className="space-y-4">
                    {items.map((a) => (
                      <TimelineCard
                        key={a.id}
                        achievement={a}
                        locale={locale}
                        deleteConfirm={deleteConfirmId === a.id}
                        onEdit={() => onEditAchievement?.(a)}
                        onDeleteRequest={() => handleDeleteConfirm(a.id)}
                        onDeleteConfirm={() => handleDeleteExecute(a.id)}
                        onDeleteCancel={handleDeleteCancel}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Mobile FAB */}
        <button
          type="button"
          onClick={onAddClick}
          aria-label={t("app.addAchievement")}
          className="fixed bottom-6 right-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-2xl text-white shadow-lg shadow-stone-900/20 hover:bg-stone-800 sm:hidden"
        >
          +
        </button>

        {filtersActive && grouped.length === 0 && achievements.length > 0 && (
          <p className="mt-4 text-center text-xs text-stone-400">{t("search.noResults")}</p>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------

function SummaryCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-widest text-stone-500">{label}</p>
      <p className="mt-1 font-serif text-2xl text-stone-900">{value}</p>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function TimelineCard({
  achievement,
  locale,
  deleteConfirm,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  achievement: Achievement;
  locale: string;
  deleteConfirm: boolean;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const { t } = useTranslation();
  const cat = categoryStyles[achievement.category];
  const award = awardStyles[achievement.awardType];
  const photoCount = achievement.imageURLs.length;

  return (
    <li className="relative">
      <span
        aria-hidden
        className={`absolute -left-[26px] top-4 h-3 w-3 rounded-full ring-4 ring-stone-100 sm:-left-[30px] ${cat.dot}`}
      />
      <div className={`group rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${cat.border}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-stone-500">
                {formatDate(achievement.date, locale)} · {achievement.location}
              </p>
              <h3 className="mt-1 font-serif text-lg text-stone-900">
                {achievement.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${award.bg} ${award.text} ${award.ring}`}>
                {award.emoji} {t(`awards.${achievement.awardType}`)}
              </span>
              {/* Edit/Delete товчлуурууд */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                  title="Засах"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={onDeleteRequest}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                  title="Устгах"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cat.chip}`}>
              {t(`categories.${achievement.category}`)}
            </span>
            {photoCount > 0 && (
              <span className="text-[11px] text-stone-500">
                {t("card.photos", { count: photoCount })}
              </span>
            )}
          </div>

          {achievement.description && (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-stone-600">
              {achievement.description}
            </p>
          )}

          {photoCount > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {achievement.imageURLs.slice(0, 4).map((url, i) => (
                <li key={url + i} className="aspect-square overflow-hidden rounded-md border border-stone-200">
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Устгах баталгаажуулалт */}
        {deleteConfirm && (
          <div className="border-t border-rose-100 bg-rose-50 px-4 py-3 rounded-b-2xl">
            <p className="text-sm text-rose-700 font-medium">Энэ бичлэгийг устгах уу?</p>
            <p className="text-xs text-rose-500 mt-0.5">Устгасны дараа буцаах боломжгүй.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onDeleteConfirm}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
              >
                Тийм, устга
              </button>
              <button
                type="button"
                onClick={onDeleteCancel}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Болих
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
