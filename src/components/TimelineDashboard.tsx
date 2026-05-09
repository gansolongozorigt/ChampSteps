// =============================================================================
// TimelineDashboard v3 — Slate + Gold design system
// ⚠️  Logic хэвээр — зөвхөн Tailwind class-ууд шинэчлэгдсэн
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
import AIInsightCard from "./AIInsightCard";

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
    const awards = achievements.filter((a) => a.awardType && a.awardType !== "None").length;
    const byCat: Record<AchievementCategory, number> = { Sports: 0, Arts: 0, Academic: 0 };
    for (const a of achievements) byCat[a.category] += 1;
    const topCategory = (Object.entries(byCat) as [AchievementCategory, number][])
      .sort(([, x], [, y]) => y - x)[0];
    const practiceDays = 0; // practice logs are managed in App.tsx
    return { total, awards, topCategory, practiceDays };
  }, [achievements]);

  function handleDeleteConfirm(id: string) { setDeleteConfirmId(id); }
  function handleDeleteCancel() { setDeleteConfirmId(null); }
  function handleDeleteExecute(id: string) {
    onDeleteAchievement?.(id);
    setDeleteConfirmId(null);
  }
  function resetFilters() { setFilter("All"); setQuery(""); }

  const filtersActive = filter !== "All" || query.trim().length > 0;

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">

        {/* ── Profile header ─────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-3 mb-5">
          <button
            type="button"
            onClick={onEditProfile}
            className="flex items-center gap-3 rounded-xl p-1 text-left hover:bg-stone-200/60 transition-colors group"
          >
            {child.avatarUrl ? (
              <img
                src={child.avatarUrl}
                alt={child.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-lg font-semibold text-amber-800 ring-2 ring-white shadow-sm">
                {child.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
                {t("app.journal")}
              </p>
              <h1 className="text-xl font-semibold text-stone-900 leading-tight">
                {t("app.achievementsTitle", { name: child.name })}
              </h1>
              {child.bio && (
                <p className="text-[12px] text-stone-500 mt-0.5 leading-snug">{child.bio}</p>
              )}
              <span className="text-[10px] text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity">
                ✎ {t("app.editProfile")}
              </span>
            </div>
          </button>
        </header>

        {/* ── Stat cards — В хувилбар ────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-2.5 mb-5">
          {/* Main: Нийт амжилт */}
          <div className="bg-stone-950 rounded-2xl p-4 row-span-2 flex flex-col justify-end min-h-[100px]">
            <span className="text-[34px] font-semibold text-white leading-none">
              {stats.total}
            </span>
            <span className="text-[11px] text-amber-500 mt-2 font-medium">
              {t("summary.total") || "Нийт амжилт"}
            </span>
            <span className="text-[10px] text-stone-600 mt-0.5">
              {t("summary.entries") || "Бүх ангилалаар"}
            </span>
          </div>

          {/* Нийт шагнал */}
          <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-100">
            <span className="text-[24px] font-semibold text-amber-900 leading-none">
              {stats.awards}
            </span>
            <p className="text-[10px] text-amber-700 mt-1.5 font-medium">
              Нийт шагнал
            </p>
            <p className="text-[9px] text-amber-500 mt-0.5">Медаль болон тэмдэглэл</p>
          </div>

          {/* Тэргүүн ангилал */}
          <div className="bg-white rounded-2xl p-3.5 border border-stone-200">
            <span className="text-[24px] font-semibold text-stone-900 leading-none">
              {stats.topCategory?.[1] ?? 0}
            </span>
            <p className="text-[10px] text-stone-500 mt-1.5 font-medium">
              {t("summary.topCategory") || "Тэргүүн ангилал"}
            </p>
            <p className="text-[9px] text-stone-400 mt-0.5">
              {stats.topCategory && stats.topCategory[1] > 0
                ? t(`categories.${stats.topCategory[0]}`)
                : "—"}
            </p>
          </div>
        </section>

        {/* ── AI Insight ─────────────────────────────────────────────── */}
        {achievements.length > 0 && (
          <AIInsightCard child={child} achievements={achievements} />
        )}

        {/* ── Search & sort ──────────────────────────────────────────── */}
        {achievements.length > 0 && (
          <section className="mt-5 flex flex-col gap-2.5">
            <div className="relative">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search.placeholder")}
                className="w-full pl-10 pr-4 py-2.5 text-[13px] bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 transition-colors"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              {/* Category chips */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
                {(["All", "Sports", "Arts", "Academic"] as CategoryFilter[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-full whitespace-nowrap border transition-all shrink-0 ${
                      filter === c
                        ? "bg-stone-950 text-white border-stone-950"
                        : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    {t(`categories.${c}`)}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
                className="text-[11px] border border-stone-200 bg-white rounded-lg px-2.5 py-1.5 text-stone-600 focus:outline-none shrink-0"
              >
                <option value="newest">{t("search.newestFirst")}</option>
                <option value="oldest">{t("search.oldestFirst")}</option>
              </select>
            </div>
          </section>
        )}

        {/* ── Timeline ───────────────────────────────────────────────── */}
        <section className="relative mt-6">
          {achievements.length === 0 ? (
            <EmptyState variant="journal" onPrimary={onAddClick} />
          ) : grouped.length === 0 ? (
            <EmptyState variant="filtered" onPrimary={resetFilters} />
          ) : (
            <ol className="relative space-y-8 pl-5">
              {/* Vertical line */}
              <span
                aria-hidden
                className="absolute left-1.5 top-1 bottom-0 w-px bg-gradient-to-b from-stone-300 via-stone-200 to-transparent"
              />
              {grouped.map(([month, items]) => (
                <li key={month}>
                  <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400 ml-1">
                    {formatMonthHeading(month, locale)}
                  </h2>
                  <ul className="space-y-3">
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

        {filtersActive && grouped.length === 0 && achievements.length > 0 && (
          <p className="mt-4 text-center text-[11px] text-stone-400">{t("search.noResults")}</p>
        )}
      </div>
    </div>
  );
}

// ─── TimelineCard ─────────────────────────────────────────────────────────────

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
      {/* Timeline dot */}
      <span
        aria-hidden
        className={`absolute -left-[18px] top-4 w-2.5 h-2.5 rounded-full ring-[3px] ring-stone-100 ${cat.dot}`}
      />

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:border-stone-300 transition-colors group">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-stone-400 mb-1">
                {formatDate(achievement.date, locale)} · {achievement.location}
              </p>
              <h3 className="text-[14px] font-semibold text-stone-900 leading-snug">
                {achievement.title}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Award badge */}
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${award.bg} ${award.text} ${award.ring}`}>
                {award.emoji} {t(`awards.${achievement.awardType}`)}
              </span>
              {/* Edit/Delete — hover-д гарна */}
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={onEdit}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                  title={t("form.actions.save")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
                <button
                  onClick={onDeleteRequest}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title={t("form.actions.remove")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cat.chip}`}>
              {t(`categories.${achievement.category}`)}
            </span>
            {photoCount > 0 && (
              <span className="text-[10px] text-stone-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 3h16.5c.414 0 .75.336.75.75v13.5a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75V3.75A.75.75 0 013.75 3z" />
                </svg>
                {t("card.photos", { count: photoCount })}
              </span>
            )}
          </div>

          {/* Description */}
          {achievement.description && (
            <p className="text-[12px] text-stone-500 leading-relaxed line-clamp-2">
              {achievement.description}
            </p>
          )}

          {/* Photos */}
          {photoCount > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {achievement.imageURLs.slice(0, 3).map((url, i) => (
                <div key={url + i} className="aspect-square rounded-lg overflow-hidden border border-stone-100">
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-3">
            <p className="text-[13px] font-medium text-red-700">{t("delete.confirmTitle")}</p>
            <p className="text-[11px] text-red-500 mt-0.5">{t("delete.confirmSubtitle")}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onDeleteConfirm}
                className="px-3 py-1.5 text-[11px] font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-95 transition-all"
              >
                {t("delete.confirm")}
              </button>
              <button
                onClick={onDeleteCancel}
                className="px-3 py-1.5 text-[11px] font-medium border border-stone-200 bg-white text-stone-600 rounded-lg hover:bg-stone-50 active:scale-95 transition-all"
              >
                {t("delete.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
