// =============================================================================
// ReflectionSection — Нууц сэтгэлзүйн тэмдэглэл
// Зөвхөн эцэг эх харна. Багш хандах эрхгүй.
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Reflection } from "../types";

export interface ReflectionSectionProps {
  childId: string;
  reflections: Reflection[];
  onAdd: (r: Omit<Reflection, "id" | "childId" | "createdAt">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const MOOD_VALUES = [1, 2, 3, 4, 5] as const;
const MOOD_EMOJIS: Record<number, string> = {
  1: "😞", 2: "😔", 3: "😐", 4: "😊", 5: "😄",
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
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onAdd({ date, mood, content: content.trim(), parentNote: parentNote.trim() || undefined });
      setContent("");
      setParentNote("");
      setMood(3);
      setDate(new Date().toISOString().slice(0, 10));
      setShowForm(false);
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-xl text-stone-900">{t("reflection.heading")}</h2>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 uppercase tracking-wide">
              🔒 {t("reflection.private")}
            </span>
          </div>
          {avgMood && (
            <p className="text-xs text-stone-500 mt-0.5">
              {t("reflection.avgMood", { avg: avgMood, count: reflections.length })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-full bg-purple-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-800"
        >
          {t("reflection.addButton")}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 rounded-2xl border border-purple-100 bg-purple-50/50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                {t("reflection.fields.date")}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <div className="w-full rounded-lg bg-stone-100 px-3 py-1 text-sm text-center text-stone-600 pointer-events-none">
                  {new Date(date + "T12:00:00").toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                {t("reflection.fields.mood")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {MOOD_VALUES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMood(v)}
                    title={t(`reflection.moods.${v}`)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${
                      mood === v
                        ? "bg-purple-700 ring-2 ring-purple-300 scale-110"
                        : "bg-white border border-stone-200 hover:bg-purple-50"
                    }`}
                  >
                    {MOOD_EMOJIS[v]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              {t("reflection.fields.childNote")}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder={t("reflection.fields.childNotePlaceholder")}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              {t("reflection.fields.parentNote")}{" "}
              <span className="text-stone-400">{t("reflection.fields.parentNoteOptional")}</span>
            </label>
            <textarea
              value={parentNote}
              onChange={(e) => setParentNote(e.target.value)}
              rows={2}
              placeholder={t("reflection.fields.parentNotePlaceholder")}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
            >
              {t("reflection.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !content.trim()}
              className="rounded-lg bg-purple-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? t("reflection.actions.saving") : t("reflection.actions.save")}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {reflections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/30 p-8 text-center">
          <p className="text-3xl mb-2">💜</p>
          <p className="text-sm font-medium text-stone-700">{t("reflection.empty.title")}</p>
          <p className="text-xs text-stone-500 mt-1">{t("reflection.empty.subtitle")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reflections.map((r) => {
            const moodLabel = t(`reflection.moods.${r.mood}`);
            const isExpanded = expandedId === r.id;
            return (
              <li key={r.id} className="rounded-2xl border border-purple-100 bg-white shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-purple-50 text-xl shrink-0">
                        {MOOD_EMOJIS[r.mood]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-stone-500">
                          {new Date(r.date).toLocaleDateString(locale, {
                            year: "numeric", month: "long", day: "numeric"
                          })} · {moodLabel}
                        </p>
                        <p className={`text-sm text-stone-800 mt-0.5 leading-relaxed ${!isExpanded ? "line-clamp-2" : ""}`}>
                          {r.content}
                        </p>
                        {r.content.length > 100 && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className="text-xs text-purple-600 mt-1 hover:underline"
                          >
                            {isExpanded ? t("reflection.actions.collapse") : t("reflection.actions.expand")}
                          </button>
                        )}
                        {isExpanded && r.parentNote && (
                          <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2">
                            <p className="text-xs text-stone-500 font-medium mb-0.5">
                              {t("reflection.parentNoteLabel")}
                            </p>
                            <p className="text-xs text-stone-700">{r.parentNote}</p>
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
                            className="rounded-lg bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700"
                          >
                            {t("reflection.actions.delete")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600"
                          >
                            {t("reflection.actions.cancelDelete")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteId(r.id)}
                          className="rounded-lg p-1.5 text-stone-300 hover:bg-rose-50 hover:text-rose-500"
                        >
                          🗑️
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
