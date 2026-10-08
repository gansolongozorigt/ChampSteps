// =============================================================================
// TimelineDashboard v4 — forest green / graphite / white (docs/BRAND.md)
// Logic unchanged — only markup classes and icons.
// =============================================================================

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Dumbbell, Medal, Award, Palette, Pencil, Search, Trash2, type LucideIcon } from "lucide-react";
import type { Achievement, AchievementCategory, Child } from "../types";
import {
  awardStyles,
  formatDate,
  formatMonthHeading,
  groupByMonth,
} from "../utils/format";
import EmptyState from "./EmptyState";
import AIInsightCard from "./AIInsightCard";
import type { ToastKind } from "./Toast";
import AchievementSummary from "./AchievementSummary";

type CategoryFilter = AchievementCategory | "All";
type SortOrder = "newest" | "oldest";

/** Categories share one colour; the icon tells them apart (BRAND.md). */
const CATEGORY_ICON: Record<AchievementCategory, LucideIcon> = { Sports: Dumbbell, Arts: Palette, Academic: BookOpen };

export interface TimelineDashboardProps {
  child: Child;
  achievements: Achievement[];
  onAddClick?: () => void;
  onEditProfile?: () => void;
  onEditAchievement?: (a: Achievement) => void;
  onDeleteAchievement?: (id: string) => void;
  /** Багшийн горим: засах/устгах/нэмэх, профайл засах нуугдана */
  readOnly?: boolean;
  champMood?: "idle" | "happy" | "excited" | "streak" | "sleeping";
  loading?: boolean;
  /** AI картын мэдэгдэл (жишээ: "Шинэ өгөгдөл байхгүй") */
  onToast?: (kind: ToastKind, message: string) => void;
}

export default function TimelineDashboard({
  child,
  achievements,
  onAddClick,
  onEditProfile,
  onEditAchievement,
  onDeleteAchievement,
  readOnly = false,
  loading = false,
  onToast,
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
    const awards = achievements.filter((a) => a.awardType && (a.awardType as string) !== "None").length;
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
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">

        {/* ── Profile header ─────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-3 mb-5">
          <button
            type="button"
            onClick={readOnly ? undefined : onEditProfile}
            disabled={readOnly}
            className="flex items-center gap-3 rounded-card p-1 -m-1 text-left transition-colors hover:bg-bg-soft group disabled:cursor-default disabled:hover:bg-transparent"
          >
            {child.avatarUrl ? (
              <img
                src={child.avatarUrl}
                alt={child.name}
                className="w-[52px] h-[52px] rounded-full object-cover border border-line shrink-0"
              />
            ) : (
              <div className="w-[52px] h-[52px] rounded-full bg-primary-soft text-primary-soft-ink flex items-center justify-center text-[20px] font-extrabold border border-line shrink-0">
                {child.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="t-label">{t("app.journal")}</p>
              <h1 className="t-display truncate">
                {t("app.achievementsTitle", { name: child.name })}
              </h1>
              {child.bio && (
                <p className="t-caption mt-0.5 leading-snug">{child.bio}</p>
              )}
              {!readOnly && (
                <span className="inline-flex items-center gap-1 t-caption text-primary mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  <Pencil size={12} strokeWidth={2.2} aria-hidden />
                  {t("app.editProfile")}
                </span>
              )}
            </div>
          </button>
        </header>

        {/* ── Achievement summary (medals) ── */}
        <AchievementSummary achievements={achievements} />

        {/* ── AI Insight ─────────────────────────────────────────────── */}
        {achievements.length > 0 && (
          <AIInsightCard key={child.childId} child={child} achievements={achievements} onToast={onToast} />
        )}

        {/* ── Search & sort ──────────────────────────────────────────── */}
        {achievements.length > 0 && (
          <section className="mt-5 flex flex-col gap-3">
            <div className="relative">
              <Search size={20} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search.placeholder")}
                className="cs-input pl-11"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              {/* Category chips */}
              <div className="flex gap-1.5 flex-wrap flex-1">
                {(["All", "Sports", "Arts", "Academic"] as CategoryFilter[]).map((c) => {
                  const Icon = c === "All" ? null : CATEGORY_ICON[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFilter(c)}
                      aria-pressed={filter === c}
                      className="cs-chip cs-chip-outline h-9 px-3"
                    >
                      {Icon && <Icon size={14} strokeWidth={2.2} aria-hidden />}
                      {t(`categories.${c}`)}
                    </button>
                  );
                })}
              </div>
              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
                className="cs-select w-auto min-h-[36px] py-1.5 text-[13px] font-bold shrink-0"
              >
                <option value="newest">{t("search.newestFirst")}</option>
                <option value="oldest">{t("search.oldestFirst")}</option>
              </select>
            </div>
          </section>
        )}

        {/* ── Timeline ───────────────────────────────────────────────── */}
        <section className="relative mt-6">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="cs-skeleton rounded-card h-28" />
              ))}
            </div>
          ) : achievements.length === 0 ? (
            <EmptyState variant="journal" onPrimary={readOnly ? undefined : onAddClick} />
          ) : grouped.length === 0 ? (
            <EmptyState variant="filtered" onPrimary={resetFilters} />
          ) : (
            <ol className="cs-timeline space-y-8">
              {grouped.map(([month, items]) => (
                <li key={month}>
                  <h2 className="t-label mb-3">
                    {formatMonthHeading(month, locale)}
                  </h2>
                  <ul className="space-y-3">
                    {items.map((a, idx) => (
                      <TimelineCard
                        key={a.id}
                        index={idx}
                        achievement={a}
                        locale={locale}
                        deleteConfirm={deleteConfirmId === a.id}
                        readOnly={readOnly}
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
          <p className="mt-4 text-center t-caption">{t("search.noResults")}</p>
        )}
      </div>
    </div>
  );
}

// ─── TimelineCard ─────────────────────────────────────────────────────────────

function TimelineCard({
  achievement,
  index,
  locale,
  deleteConfirm,
  readOnly = false,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  achievement: Achievement;
  index: number;
  locale: string;
  deleteConfirm: boolean;
  readOnly?: boolean;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const { t } = useTranslation();
  const award = awardStyles[achievement.awardType];
  const CategoryIcon = CATEGORY_ICON[achievement.category];
  const AwardIcon = achievement.awardType === "Participant" ? Award : Medal;
  const photoCount = achievement.imageURLs.length;

  return (
    <li className="relative cs-item-in" style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}>
      {/* Timeline dot */}
      <span aria-hidden className="cs-timeline-dot" />

      <div className="cs-card overflow-hidden transition-colors hover:border-line-strong group">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="t-caption mb-1">
                {formatDate(achievement.date, locale)}{achievement.location ? ` · ${achievement.location}` : ""}
              </p>
              <h3 className="t-h2">
                {achievement.title}
              </h3>
            </div>
            {/* Edit/Delete — hover-д гарна (багшийн горимд байхгүй) */}
            {!readOnly && (
              <div className="flex gap-0.5 shrink-0 -mr-2 -mt-1 opacity-60 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={onEdit}
                  className="cs-icon-btn cs-icon-btn-sm text-ink-3 hover:text-ink"
                  title={t("form.editHeading")}
                  aria-label={t("form.editHeading")}
                >
                  <Pencil size={18} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={onDeleteRequest}
                  className="cs-icon-btn cs-icon-btn-sm text-ink-3 hover:text-error hover:bg-error-soft"
                  title={t("form.actions.remove")}
                  aria-label={t("form.actions.remove")}
                >
                  <Trash2 size={18} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>

          {/* Medal + category + photos */}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className={`cs-chip ${award.chip}`}>
              <AwardIcon size={14} strokeWidth={2.2} aria-hidden />
              {t(`awards.${achievement.awardType}`)}
            </span>
            <span className="cs-chip">
              <CategoryIcon size={14} strokeWidth={2.2} aria-hidden />
              {t(`categories.${achievement.category}`)}
            </span>
            {photoCount > 0 && (
              <span className="t-caption">{t("card.photos", { count: photoCount })}</span>
            )}
          </div>

          {/* Description */}
          {achievement.description && (
            <p className="t-body text-ink-2 mt-2 line-clamp-2">
              {achievement.description}
            </p>
          )}

          {/* Photos */}
          {photoCount > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
              {achievement.imageURLs.slice(0, 6).map((url, i) => (
                <div key={url + i} className="w-[54px] h-[54px] rounded-image overflow-hidden border border-line shrink-0">
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="border-t border-line bg-error-soft px-4 py-3">
            <p className="t-body-strong text-error">{t("delete.confirmTitle")}</p>
            <p className="t-caption text-error mt-0.5">{t("delete.confirmSubtitle")}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onDeleteConfirm} className="cs-btn cs-btn-danger cs-btn-sm">
                {t("delete.confirm")}
              </button>
              <button type="button" onClick={onDeleteCancel} className="cs-btn cs-btn-outline cs-btn-sm">
                {t("delete.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
