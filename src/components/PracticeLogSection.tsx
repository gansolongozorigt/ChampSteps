// =============================================================================
// PracticeLogSection — Өдөр бүрийн бэлтгэлийн тэмдэглэл
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PracticeLog } from "../types";

export interface PracticeLogSectionProps {
  childId: string;
  logs: PracticeLog[];
  onAdd: (log: Omit<PracticeLog, "id" | "childId" | "createdAt">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function PracticeLogSection({
  logs,
  onAdd,
  onDelete,
}: PracticeLogSectionProps) {
  const { t, i18n } = useTranslation();

  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(60);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleAdd() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onAdd({ date, duration, content: content.trim() });
      setContent("");
      setDate(new Date().toISOString().slice(0, 10));
      setDuration(60);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await onDelete(id);
    setDeleteId(null);
  }

  const totalMinutes = logs.reduce((s, l) => s + l.duration, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainMins = totalMinutes % 60;

  const totalText = () => {
    if (totalHours > 0 && remainMins > 0)
      return t("practice.total", { hours: totalHours, mins: remainMins, count: logs.length });
    if (totalHours > 0)
      return t("practice.totalHours", { hours: totalHours, count: logs.length });
    return t("practice.totalMins", { mins: remainMins, count: logs.length });
  };

  const locale = i18n.language === "mn" ? "mn-MN" : "en-US";

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-xl text-stone-900">{t("practice.heading")}</h2>
          {logs.length > 0 && (
            <p className="text-xs text-stone-500 mt-0.5">{totalText()}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
        >
          {t("practice.addButton")}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                {t("practice.fields.date")}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                {t("practice.fields.duration")}
              </label>
              <div className="flex items-center gap-2">
                {[30, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      duration === m
                        ? "bg-stone-900 text-white"
                        : "border border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              {t("practice.fields.notes")}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder={t("practice.fields.notesPlaceholder")}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-200"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
            >
              {t("practice.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !content.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? t("practice.actions.saving") : t("practice.actions.save")}
            </button>
          </div>
        </div>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center">
          <p className="text-3xl mb-2">🏋️</p>
          <p className="text-sm font-medium text-stone-700">{t("practice.empty.title")}</p>
          <p className="text-xs text-stone-500 mt-1">{t("practice.empty.subtitle")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-stone-100 text-center">
                    <span className="text-xs font-bold text-stone-700 leading-none">
                      {log.duration >= 60 ? `${log.duration / 60}h` : `${log.duration}m`}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">
                      {new Date(log.date).toLocaleDateString(locale, {
                        year: "numeric", month: "long", day: "numeric"
                      })}
                    </p>
                    <p className="text-sm text-stone-800 mt-0.5 leading-relaxed">{log.content}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {deleteId === log.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(log.id)}
                        className="rounded-lg bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700"
                      >
                        {t("practice.actions.confirmDelete")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(null)}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600"
                      >
                        {t("practice.actions.cancelDelete")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteId(log.id)}
                      className="rounded-lg p-1.5 text-stone-300 hover:bg-rose-50 hover:text-rose-500"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
