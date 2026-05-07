// =============================================================================
// ReflectionSection — Нууц сэтгэлзүйн тэмдэглэл
// Зөвхөн эцэг эх харна. Багш хандах эрхгүй.
// =============================================================================

import { useState } from "react";
import type { Reflection } from "../types";

export interface ReflectionSectionProps {
  childId: string;
  reflections: Reflection[];
  onAdd: (r: Omit<Reflection, "id" | "childId" | "createdAt">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const MOODS: { value: Reflection["mood"]; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "Маш муу" },
  { value: 2, emoji: "😔", label: "Муу" },
  { value: 3, emoji: "😐", label: "Дунд" },
  { value: 4, emoji: "😊", label: "Сайн" },
  { value: 5, emoji: "😄", label: "Маш сайн" },
];

export default function ReflectionSection({
  reflections,
  onAdd,
  onDelete,
}: ReflectionSectionProps) {
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

  return (
    <div className="mt-8 mb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-xl text-stone-900">Хүүхдийн сэтгэлзүйн тэмдэглэл</h2>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 uppercase tracking-wide">
              🔒 Нууц
            </span>
          </div>
          {avgMood && (
            <p className="text-xs text-stone-500 mt-0.5">
              Дундаж сэтгэл: {avgMood}/5 · {reflections.length} тэмдэглэл
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-full bg-purple-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-800"
        >
          + Тэмдэглэл нэмэх
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 rounded-2xl border border-purple-100 bg-purple-50/50 p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Огноо</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Сэтгэл хэр байна?</label>
              <div className="flex gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    title={m.label}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${
                      mood === m.value
                        ? "bg-purple-700 ring-2 ring-purple-300 scale-110"
                        : "bg-white border border-stone-200 hover:bg-purple-50"
                    }`}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Хүүхдийн тэмдэглэл
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Өнөөдөр юу мэдэрсэн бэ? Юу сайн байсан, юу хэцүү байсан?"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Эцэг эхийн нэмэлт тэмдэглэл <span className="text-stone-400">(заавал биш)</span>
            </label>
            <textarea
              value={parentNote}
              onChange={(e) => setParentNote(e.target.value)}
              rows={2}
              placeholder="Эцэг эхийн ажиглалт, санал..."
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
            >
              Болих
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !content.trim()}
              className="rounded-lg bg-purple-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? "Хадгалж байна..." : "Хадгалах"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {reflections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/30 p-8 text-center">
          <p className="text-3xl mb-2">💜</p>
          <p className="text-sm font-medium text-stone-700">Сэтгэлзүйн тэмдэглэл байхгүй</p>
          <p className="text-xs text-stone-500 mt-1">Хүүхдийнхээ сэтгэл санааг тогтмол тэмдэглэ</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reflections.map((r) => {
            const moodInfo = MOODS.find((m) => m.value === r.mood);
            const isExpanded = expandedId === r.id;
            return (
              <li key={r.id} className="rounded-2xl border border-purple-100 bg-white shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-purple-50 text-xl shrink-0">
                        {moodInfo?.emoji}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-stone-500">{formatDate(r.date)} · {moodInfo?.label}</p>
                        <p className={`text-sm text-stone-800 mt-0.5 leading-relaxed ${!isExpanded ? "line-clamp-2" : ""}`}>
                          {r.content}
                        </p>
                        {r.content.length > 100 && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className="text-xs text-purple-600 mt-1 hover:underline"
                          >
                            {isExpanded ? "Хураах" : "Дэлгэрэнгүй"}
                          </button>
                        )}
                        {isExpanded && r.parentNote && (
                          <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2">
                            <p className="text-xs text-stone-500 font-medium mb-0.5">Эцэг эхийн тэмдэглэл:</p>
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
                            Устга
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600"
                          >
                            Болих
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" });
}
