// =============================================================================
// TodayPage — the daily-habit screen (/today): child chips, date (today or any
// past day), 7-day strip, streak, a 3-field quick form (what / minutes / save)
// and the entries of the selected day. Writes the SAME practiceLogs documents
// as the "Бэлтгэл" section (date, duration, content) — no schema change.
// Brand: docs/BRAND.md (cards 1px line, pill chips, lucide, no emoji).
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, Clock, Flame } from "lucide-react";
import type { Child, PracticeLog } from "../types";
import { addDays, currentStreak, dayLabel, lastNDays, localDateKey, loggedDays, weekdayShort } from "../lib/streak";

const LAST_CHILD_KEY = "champstep.today.childId";
const DURATIONS = [15, 30, 45, 60] as const;

export type SaveOutcome = "saved" | "queued";

export interface TodayPageProps {
  kids: Child[];
  activeIdx: number;
  onSelectChild: (i: number) => void;
  /** All practice logs of the active child (any date). */
  logs: PracticeLog[];
  onAdd: (log: { date: string; duration: number; content: string }) => Promise<SaveOutcome>;
  onDelete: (id: string) => Promise<void>;
  /** Teacher: view only. */
  readOnly?: boolean;
}

function readLastChild(): string | null {
  try { return localStorage.getItem(LAST_CHILD_KEY); } catch { return null; }
}
function writeLastChild(id: string) {
  try { localStorage.setItem(LAST_CHILD_KEY, id); } catch { /* private mode */ }
}

export default function TodayPage({ kids, activeIdx, onSelectChild, logs, onAdd, onDelete, readOnly = false }: TodayPageProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? "mn";
  const today = localDateKey(new Date());

  const [date, setDate] = useState(today);
  const [content, setContent] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<SaveOutcome | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Last chosen child on this device wins on first mount (manifest shortcut / notification open).
  useEffect(() => {
    const last = readLastChild();
    if (!last) return;
    const i = kids.findIndex((k) => k.childId === last);
    if (i >= 0 && i !== activeIdx) onSelectChild(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2500);
    return () => window.clearTimeout(id);
  }, [flash]);

  const days = useMemo(() => loggedDays(logs), [logs]);
  const streak = useMemo(() => currentStreak(days, today), [days, today]);
  const week = useMemo(() => lastNDays(today, 7), [today]);
  const dayLogs = useMemo(() => logs.filter((l) => l.date === date), [logs, date]);

  function pickChild(i: number) {
    writeLastChild(kids[i].childId);
    onSelectChild(i);
  }

  async function save() {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const outcome = await onAdd({ date, duration, content: text });
      setContent("");
      setFlash(outcome);
    } catch {
      // parent showed the error toast; keep the text
    } finally {
      setSaving(false);
    }
  }

  // "Өнөөдөр · 10-р сарын 14" fits a phone; other days carry the weekday instead.
  const dateLabel = () => {
    if (date === today) return `${t("today.isToday")} · ${dayLabel(date, lang, false)}`;
    if (date === addDays(today, -1)) return `${t("today.isYesterday")} · ${dayLabel(date, lang, false)}`;
    return dayLabel(date, lang);
  };

  return (
    <div data-testid="today-page">
      {/* Child chips */}
      {kids.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 mb-4" role="tablist" aria-label={t("today.childLabel")}>
          {kids.map((k, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={k.childId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pickChild(i)}
                className={`cs-chip h-10 px-4 text-[13px] shrink-0 transition-colors ${active ? "bg-primary text-white" : "cs-chip-muted"}`}
              >
                {k.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Date + streak */}
      <div className="cs-card p-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label={t("today.prevDay")} className="cs-icon-btn text-ink-2">
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          <div className="text-center min-w-0">
            <p className="t-body-strong text-ink truncate" data-testid="today-date">{dateLabel()}</p>
            {date !== today && (
              <button type="button" onClick={() => setDate(today)} className="t-caption text-primary font-bold mt-0.5">
                {t("today.backToToday")}
              </button>
            )}
          </div>
          <button type="button" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label={t("today.nextDay")} className="cs-icon-btn text-ink-2 disabled:opacity-30">
            <ChevronRight size={22} strokeWidth={2.2} />
          </button>
        </div>

        {/* 7-day strip */}
        <div className="mt-4 grid grid-cols-7 gap-1" aria-label={t("today.week")}>
          {week.map((d) => {
            const logged = days.has(d);
            const selected = d === date;
            const dt = new Date(d + "T12:00:00");
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                aria-pressed={selected}
                aria-label={`${dayLabel(d, lang)}${logged ? " · " + t("today.saved") : ""}`}
                data-logged={logged ? "1" : "0"}
                className={`flex flex-col items-center gap-1.5 py-2 rounded-input min-h-[56px] transition-colors ${selected ? "bg-primary-soft" : "hover:bg-surface-muted"}`}
              >
                <span className="t-caption leading-none">{weekdayShort(d, lang)}</span>
                <span className={`text-[13px] font-extrabold tabular-nums leading-none ${selected ? "text-primary-soft-ink" : "text-ink"}`}>{dt.getDate()}</span>
                <span aria-hidden className={`w-2 h-2 rounded-full ${logged ? "bg-primary" : "border border-line-strong"}`} />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2" data-testid="today-streak">
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${streak > 0 ? "bg-primary-soft text-primary-soft-ink" : "bg-surface-muted text-ink-3"}`}>
            <Flame size={20} strokeWidth={2.2} aria-hidden />
          </span>
          <p className="t-body-strong text-ink">
            {streak > 0 ? t("today.streak", { count: streak }) : t("today.streakNone")}
          </p>
        </div>
      </div>

      {/* Quick form */}
      {readOnly ? (
        <p className="t-caption mb-4">{t("today.teacherNote")}</p>
      ) : (
        <div className="cs-card p-4 mb-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder={t("today.whatPlaceholder")}
            aria-label={t("today.whatPlaceholder")}
            className="cs-textarea"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void save(); }}
          />
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="t-caption mr-1 inline-flex items-center gap-1"><Clock size={14} aria-hidden />{t("today.durationLabel")}</span>
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDuration(m)}
                aria-pressed={duration === m}
                className={`cs-chip h-10 px-3.5 text-[13px] tabular-nums ${duration === m ? "bg-primary text-white" : "cs-chip-outline"}`}
              >
                {t("today.minutes", { count: m })}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !content.trim()}
            className="cs-btn cs-btn-primary w-full mt-4"
            data-testid="today-save"
          >
            {saving ? t("today.saving") : t("today.save")}
          </button>
          {flash && (
            <p role="status" className="mt-3 flex items-center justify-center gap-1.5 t-caption text-primary font-bold cs-item-in" data-testid="today-flash">
              <Check size={16} strokeWidth={2.5} aria-hidden />
              {flash === "queued" ? t("today.queued") : t("today.saved")}
            </p>
          )}
        </div>
      )}

      {/* Entries of the selected day */}
      <p className="t-label mb-2">{t("today.entriesTitle")}</p>
      {dayLogs.length === 0 ? (
        <p className="t-caption" data-testid="today-empty">{t("today.noEntries")}</p>
      ) : (
        <ul className="space-y-2" data-testid="today-entries">
          {dayLogs.map((log) => (
            <li key={log.id} className="cs-card p-3 flex items-start justify-between gap-3 cs-item-in">
              <div className="flex items-start gap-3 min-w-0">
                <span className="h-10 w-10 shrink-0 rounded-input bg-primary-soft text-primary-soft-ink flex items-center justify-center text-[12px] font-extrabold tabular-nums">
                  {log.duration >= 60 && log.duration % 60 === 0 ? `${log.duration / 60}h` : `${log.duration}m`}
                </span>
                <p className="t-body text-ink min-w-0 break-words">{log.content}</p>
              </div>
              {!readOnly && (
                deleteId === log.id ? (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => { void onDelete(log.id); setDeleteId(null); }} className="cs-btn cs-btn-danger cs-btn-xs">{t("practice.actions.confirmDelete")}</button>
                    <button type="button" onClick={() => setDeleteId(null)} className="cs-btn cs-btn-ghost cs-btn-xs">{t("practice.actions.cancelDelete")}</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDeleteId(log.id)} className="cs-btn cs-btn-ghost cs-btn-xs shrink-0">{t("practice.actions.delete")}</button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
