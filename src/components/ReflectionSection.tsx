// =============================================================================
// ReflectionSection — Нууц сэтгэлзүйн тэмдэглэл
// Зөвхөн эцэг эх харна. Багш хандах эрхгүй.
// Brand: docs/BRAND.md — child note marked primary (left bar), parent note ink-3.
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Annoyed, Frown, Heart, Laugh, Lock, Meh, Smile, Trash2, type LucideIcon } from "lucide-react";
import type { Reflection } from "../types";

export interface ReflectionSectionProps {
  childId: string;
  reflections: Reflection[];
  onAdd: (r: Omit<Reflection, "id" | "childId" | "createdAt">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const MOOD_VALUES = [1, 2, 3, 4, 5] as const;
/** 1 = маш муу … 5 = маш сайн (lucide faces instead of emoji). */
const MOOD_ICONS: Record<number, LucideIcon> = {
  1: Frown, 2: Annoyed, 3: Meh, 4: Smile, 5: Laugh,
};

export default function ReflectionSection({
  reflections,
  onAdd,
  onDelete,
}: ReflectionSectionProps) {
  const { t, i18n } = useTranslation();

  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mood, setMood] = useState<Reflection["mood"]>(3);
  const [content, setContent] = useState("");
  const [parentNote, setParentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleAdd() {
    const childText = content.trim();
    const parentText = parentNote.trim();
    // Either section may be filled; an empty one stays empty. Never send
    // `undefined` to Firestore (addDoc rejects it) — omit the key instead.
    if (!childText && !parentText) return;
    setSaving(true);
    try {
      await onAdd({ date, mood, content: childText, ...(parentText ? { parentNote: parentText } : {}) });
      setContent("");
      setParentNote("");
      setMood(3);
      setDate(new Date().toISOString().slice(0, 10));
      setShowForm(false);
    } catch {
      // parent already showed the error toast; keep the form open with the text
    } finally {
      setSaving(false);
    }
  }

  const avgMood = reflections.length
    ? (reflections.reduce((s, r) => s + r.mood, 0) / reflections.length).toFixed(1)
    : null;

  const locale = i18n.language === "mn" ? "mn-MN" : "en-US";

  return (
    <div className="mt-8 mb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="cs-chip cs-chip-muted h-6 px-2 text-[10px] uppercase tracking-wide">
              <Lock size={12} strokeWidth={2.5} aria-hidden="true" />
              {t("reflection.private")}
            </span>
          </div>
          {avgMood && (
            <p className="t-caption mt-0.5">
              {t("reflection.avgMood", { avg: avgMood, count: reflections.length })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="cs-btn cs-btn-primary cs-btn-sm shrink-0"
        >
          {t("reflection.addButton")}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 cs-card p-4 sm:p-5 cs-item-in">
          <div className="flex flex-col gap-4 mb-4">
            <div>
              <label className="cs-field-label">
                {t("reflection.fields.date")}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <div className="cs-input flex items-center justify-center text-center pointer-events-none">
                  {new Date(date + "T12:00:00").toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
            </div>
            <div>
              <label className="cs-field-label">
                {t("reflection.fields.mood")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {MOOD_VALUES.map((v) => {
                  const Icon = MOOD_ICONS[v];
                  const active = mood === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMood(v)}
                      title={t(`reflection.moods.${v}`)}
                      aria-label={t(`reflection.moods.${v}`)}
                      aria-pressed={active}
                      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                        active
                          ? "bg-primary-soft border-primary text-primary-soft-ink"
                          : "bg-surface border-line text-ink-3 hover:bg-bg-soft"
                      }`}
                    >
                      <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* child note — primary left bar */}
          <div className="mb-4 border-l-[3px] border-primary pl-3">
            <label className="cs-field-label">
              {t("reflection.fields.childNote")}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder={t("reflection.fields.childNotePlaceholder")}
              className="cs-textarea"
            />
          </div>

          {/* parent note — ink-3 left bar */}
          <div className="mb-4 border-l-[3px] border-ink-3 pl-3">
            <label className="cs-field-label">
              {t("reflection.fields.parentNote")}{" "}
              <span className="text-ink-3 font-semibold">{t("reflection.fields.parentNoteOptional")}</span>
            </label>
            <textarea
              value={parentNote}
              onChange={(e) => setParentNote(e.target.value)}
              rows={2}
              placeholder={t("reflection.fields.parentNotePlaceholder")}
              className="cs-textarea min-h-[72px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="cs-btn cs-btn-ghost"
            >
              {t("reflection.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || (!content.trim() && !parentNote.trim())}
              className="cs-btn cs-btn-primary"
            >
              {saving ? t("reflection.actions.saving") : t("reflection.actions.save")}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {reflections.length === 0 ? (
        <div className="cs-card border-dashed p-8 text-center">
          <Heart size={40} strokeWidth={1.75} className="mx-auto text-ink-3" aria-hidden="true" />
          <p className="t-body-strong text-ink mt-3">{t("reflection.empty.title")}</p>
          <p className="t-caption mt-1">{t("reflection.empty.subtitle")}</p>
        </div>
      ) : (
        <ul className="cs-timeline space-y-3">
          {reflections.map((r) => {
            const moodLabel = t(`reflection.moods.${r.mood}`);
            const isExpanded = expandedId === r.id;
            const MoodIcon = MOOD_ICONS[r.mood];
            return (
              <li key={r.id} className="relative cs-card overflow-hidden cs-item-in">
                <span className="cs-timeline-dot" aria-hidden="true" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="cs-badge cs-badge-primary h-11 w-11" title={moodLabel}>
                        <MoodIcon size={22} strokeWidth={2.2} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="t-caption">
                          {new Date(r.date).toLocaleDateString(locale, {
                            year: "numeric", month: "long", day: "numeric"
                          })} · {moodLabel}
                        </p>
                        {r.content && (
                          <div className="mt-1.5 border-l-[3px] border-primary pl-3">
                            <p className={`t-body text-ink ${!isExpanded ? "line-clamp-2" : ""}`}>
                              {r.content}
                            </p>
                          </div>
                        )}
                        {r.content.length > 100 && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className="cs-btn cs-btn-ghost cs-btn-xs -ml-3 mt-1 text-primary"
                          >
                            {isExpanded ? t("reflection.actions.collapse") : t("reflection.actions.expand")}
                          </button>
                        )}
                        {(isExpanded || !r.content) && r.parentNote && (
                          <div className="mt-2 border-l-[3px] border-ink-3 pl-3">
                            <p className="t-label mb-0.5">
                              {t("reflection.parentNoteLabel")}
                            </p>
                            <p className="t-body text-ink-2">{r.parentNote}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {deleteId === r.id ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => { onDelete(r.id); setDeleteId(null); }}
                            className="cs-btn cs-btn-danger cs-btn-xs"
                          >
                            {t("reflection.actions.delete")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            className="cs-btn cs-btn-outline cs-btn-xs"
                          >
                            {t("reflection.actions.cancelDelete")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteId(r.id)}
                          aria-label={t("reflection.actions.delete")}
                          title={t("reflection.actions.delete")}
                          className="cs-icon-btn text-ink-3 hover:text-error"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
