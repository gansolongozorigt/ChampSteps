// =============================================================================
// TodayPage — the daily-habit screen (/today): child chips, date (today or any
// past day), 7-day strip, streak, a 3-field quick form (what / minutes / save)
// and the entries of the selected day. Writes the SAME practiceLogs documents
// as the "Бэлтгэл" section (date, duration, content) — no schema change.
// Brand: docs/BRAND.md (cards 1px line, pill chips, lucide, no emoji).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, Clock, Flame, Plus, Target, Trophy } from "lucide-react";
import type { Child, Goal, PracticeLog } from "../types";
import { addDays, currentStreak, dayLabel, lastNDays, localDateKey, loggedDays, weekdayShort } from "../lib/streak";
import { activeGoals, goalStats, goalsToday, overdueGoals } from "../lib/goals";
import GoalCard from "./GoalCard";
import CelebrationScreen from "./CelebrationScreen";

const LAST_CHILD_KEY = "champstep.today.childId";
const LAST_GOAL_KEY = (childId: string) => `champstep.today.goalId.${childId}`;
const DURATIONS = [15, 30, 45, 60] as const;

export type SaveOutcome = "saved" | "queued";

export interface TodayPageProps {
  kids: Child[];
  activeIdx: number;
  onSelectChild: (i: number) => void;
  /** All practice logs of the active child (any date). */
  logs: PracticeLog[];
  onAdd: (log: { date: string; duration: number; content: string; goalId?: string }) => Promise<SaveOutcome>;
  onDelete: (id: string) => Promise<void>;
  /** Teacher: view only. */
  readOnly?: boolean;
  /** All goals of the active child (any status). */
  goals?: Goal[];
  onAddGoal?: () => void;
  onOpenGoal?: (goal: Goal) => void;
  onEditGoal?: (goal: Goal) => void;
  /** "Record the result" → achievement form prefilled (App.tsx). */
  onGoalResult?: (goal: Goal) => void;
  /** Changes → the quick form is scrolled into view and focused (first-steps "log today's practice"). */
  focusForm?: number;
}

function readLastChild(): string | null {
  try { return localStorage.getItem(LAST_CHILD_KEY); } catch { return null; }
}
function writeLastChild(id: string) {
  try { localStorage.setItem(LAST_CHILD_KEY, id); } catch { /* private mode */ }
}
function readLastGoal(childId: string): string | null {
  try { return localStorage.getItem(LAST_GOAL_KEY(childId)); } catch { return null; }
}
function writeLastGoal(childId: string, goalId: string) {
  try { localStorage.setItem(LAST_GOAL_KEY(childId), goalId); } catch { /* private mode */ }
}

export default function TodayPage({ kids, activeIdx, onSelectChild, logs, onAdd, onDelete, readOnly = false, goals = [], onAddGoal, onOpenGoal, onEditGoal, onGoalResult, focusForm }: TodayPageProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? "mn";
  const today = localDateKey(new Date());

  const [date, setDate] = useState(today);
  const [content, setContent] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<SaveOutcome | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const child = kids[activeIdx];
  const childId = child?.childId ?? "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!focusForm || !textareaRef.current) return;
    textareaRef.current.scrollIntoView({ block: "center" });
    textareaRef.current.focus({ preventScroll: true });
  }, [focusForm]);

  // Goals: active ones drive the cards, the goal chips and the competition-day screen.
  const active = useMemo(() => activeGoals(goals), [goals]);
  const todayGoals = useMemo(() => goalsToday(goals, today), [goals, today]);
  const overdue = useMemo(() => overdueGoals(goals, today), [goals, today]);
  const [goalId, setGoalId] = useState<string | undefined>(undefined);
  // Celebration can be switched to the plain view for this child until the page is reopened.
  const [plainView, setPlainView] = useState(false);
  useEffect(() => { setPlainView(false); }, [childId]);
  useEffect(() => {
    if (active.length === 0) { setGoalId(undefined); return; }
    const last = readLastGoal(childId);
    const keep = active.find((g) => g.id === goalId) ? goalId : active.find((g) => g.id === last)?.id ?? active[0].id;
    setGoalId(keep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, active.map((g) => g.id).join(",")]);
  function pickGoal(id: string) { writeLastGoal(childId, id); setGoalId(id); }

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
      const outcome = await onAdd({ date, duration, content: text, goalId: active.some((g) => g.id === goalId) ? goalId : undefined });
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

      {/* Competition day: full-screen celebration for the child (first goal dated today). */}
      {todayGoals.length > 0 && !plainView && child && (
        <CelebrationScreen
          child={child}
          goal={todayGoals[0]}
          stats={goalStats(todayGoals[0], logs, today)}
          readOnly={readOnly}
          onResult={() => onGoalResult?.(todayGoals[0])}
          onPlainView={() => setPlainView(true)}
        />
      )}
      {todayGoals.length > 0 && plainView && (
        <button type="button" onClick={() => setPlainView(false)} className="cs-btn cs-btn-soft cs-btn-sm mb-4" data-testid="back-to-celebration">
          <Trophy size={16} aria-hidden />{t("goals.celebration.backToCelebration")}
        </button>
      )}

      {/* Past competition still active: ask for the result. */}
      {!readOnly && overdue.map((g) => (
        <div key={g.id} className="cs-card p-4 mb-4 border-primary" data-testid="goal-overdue">
          <p className="t-body-strong text-ink">{t("goals.howWasIt")}</p>
          <p className="t-caption mt-0.5">{t("goals.howWasItHint", { title: g.title, date: dayLabel(g.date, lang) })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onGoalResult?.(g)} className="cs-btn cs-btn-primary cs-btn-sm"><Trophy size={16} aria-hidden />{t("goals.writeResult")}</button>
            <button type="button" onClick={() => onEditGoal?.(g)} className="cs-btn cs-btn-outline cs-btn-sm">{t("goals.notYet")}</button>
          </div>
        </div>
      ))}

      {/* Goals: cards (horizontal scroll when several) or the "add a goal" card. */}
      {active.length > 0 ? (
        <div className={`mb-4 ${active.length > 1 ? "flex gap-3 overflow-x-auto snap-x scrollbar-hide -mx-4 px-4 pb-1" : ""}`} data-testid="goal-cards">
          {active.map((g) => (
            <div key={g.id} className={active.length > 1 ? "shrink-0 w-[85%] max-w-sm" : ""}>
              <GoalCard goal={g} stats={goalStats(g, logs, today)} onOpen={() => onOpenGoal?.(g)} />
            </div>
          ))}
        </div>
      ) : (!readOnly && onAddGoal && (
        <button type="button" onClick={onAddGoal} className="cs-card border-dashed p-4 mb-4 w-full text-left flex items-center gap-3 hover:border-primary transition-colors" data-testid="goal-add-card">
          <span className="w-10 h-10 rounded-full bg-primary-soft text-primary-soft-ink flex items-center justify-center shrink-0"><Target size={20} strokeWidth={2.2} aria-hidden /></span>
          <span className="min-w-0">
            <span className="t-body-strong text-ink block">{t("goals.addCta")}</span>
            <span className="t-caption block">{t("goals.addCtaHint")}</span>
          </span>
          <Plus size={18} className="ml-auto text-ink-3 shrink-0" aria-hidden />
        </button>
      ))}

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
            ref={textareaRef}
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
          {active.length > 1 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap" data-testid="goal-chips">
              <span className="t-caption mr-1 inline-flex items-center gap-1"><Target size={14} aria-hidden />{t("goals.linkLabel")}</span>
              {active.map((g) => (
                <button key={g.id} type="button" onClick={() => pickGoal(g.id)} aria-pressed={goalId === g.id} className={`cs-chip h-10 px-3.5 text-[13px] max-w-[60%] truncate ${goalId === g.id ? "bg-primary text-white" : "cs-chip-outline"}`}>
                  {g.title}
                </button>
              ))}
            </div>
          )}
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
