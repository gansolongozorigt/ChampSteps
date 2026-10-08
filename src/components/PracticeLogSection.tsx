// =============================================================================
// PracticeLogSection — Өдөр бүрийн бэлтгэлийн тэмдэглэл
// Brand: docs/BRAND.md (cards 1px line, pill chips, surface-muted inputs).
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Trash2 } from "lucide-react";
import type { PracticeLog } from "../types";

export interface PracticeLogSectionProps {
  childId: string;
  logs: PracticeLog[];
  onAdd: (log: Omit<PracticeLog, "id" | "childId" | "createdAt">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Багшийн горим: нэмэх/устгах товч нуугдана */
  readOnly?: boolean;
}

export default function PracticeLogSection({
  logs,
  onAdd,
  onDelete,
  readOnly = false,
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
    } catch {
      // parent already showed the error toast; keep the form open with the text
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
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="t-h2">{t("practice.heading")}</h2>
          {logs.length > 0 && (
            <p className="t-caption mt-0.5">{totalText()}</p>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="cs-btn cs-btn-primary cs-btn-sm shrink-0"
          >
            {t("practice.addButton")}
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 cs-card p-4 sm:p-5 cs-item-in">
          <div className="flex flex-col gap-4 mb-4">
            <div>
              <label className="cs-field-label">
                {t("practice.fields.date")}
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
                {t("practice.fields.duration")}
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[30, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    aria-pressed={duration === m}
                    className="cs-chip cs-chip-outline h-11 px-4 text-[13px] tabular-nums"
                  >
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="cs-field-label">
              {t("practice.fields.notes")}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder={t("practice.fields.notesPlaceholder")}
              className="cs-textarea"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="cs-btn cs-btn-ghost"
            >
              {t("practice.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !content.trim()}
              className="cs-btn cs-btn-primary"
            >
              {saving ? t("practice.actions.saving") : t("practice.actions.save")}
            </button>
          </div>
        </div>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="cs-card border-dashed p-8 text-center">
          <Clock size={40} strokeWidth={1.75} className="mx-auto text-ink-3" aria-hidden="true" />
          <p className="t-body-strong text-ink mt-3">{t("practice.empty.title")}</p>
          <p className="t-caption mt-1">{t("practice.empty.subtitle")}</p>
        </div>
      ) : (
        <ul className="cs-timeline space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="relative cs-card p-4 cs-item-in">
              <span className="cs-timeline-dot" aria-hidden="true" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input bg-primary-soft text-primary-soft-ink">
                    <span className="text-[13px] font-extrabold leading-none tabular-nums">
                      {log.duration >= 60 ? `${log.duration / 60}h` : `${log.duration}m`}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="t-caption">
                      {new Date(log.date).toLocaleDateString(locale, {
                        year: "numeric", month: "long", day: "numeric"
                      })}
                    </p>
                    <p className="t-body text-ink mt-0.5">{log.content}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {readOnly ? null : deleteId === log.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(log.id)}
                        className="cs-btn cs-btn-danger cs-btn-xs"
                      >
                        {t("practice.actions.confirmDelete")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(null)}
                        className="cs-btn cs-btn-outline cs-btn-xs"
                      >
                        {t("practice.actions.cancelDelete")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteId(log.id)}
                      aria-label={t("practice.actions.delete")}
                      title={t("practice.actions.delete")}
                      className="cs-icon-btn text-ink-3 hover:text-error"
                    >
                      <Trash2 size={18} />
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
