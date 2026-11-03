// =============================================================================
// PracticePage — "Бэлтгэл" (/practice): how much did the child practise each day,
// what went well, what to improve, what was learned (the child answers).
// Top: date (today or any past day), 7-day strip, streak and the quick form
// (minutes, goal, "what did you do" + three short optional questions).
// Below: the history. Teacher (readOnly): strip + history, no form.
// Writes practiceLogs (date, duration, content, goalId?, wentWell?, toImprove?, learned?).
// Brand: docs/BRAND.md (cards 1px line, pill chips, lucide, no emoji).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, Clock, Flame, Target, Trash2 } from "lucide-react";
import { PRACTICE_TEXT_MAX, type Child, type Goal, type PracticeLog } from "../types";
import { addDays, currentStreak, dayLabel, lastNDays, localDateKey, loggedDays, weekdayShort } from "../lib/streak";
import { activeGoals } from "../lib/goals";
import { PRACTICE_QUESTIONS, answeredQuestions, buildPracticeLog, hasPracticeText, type PracticeDraft, type PracticeQuestion } from "../lib/practice";

const LAST_CHILD_KEY = "champstep.today.childId";
const LAST_GOAL_KEY = (childId: string) => `champstep.today.goalId.${childId}`;
const DURATIONS = [15, 30, 45, 60] as const;

export type SaveOutcome = "saved" | "queued";

export interface PracticePageProps {
  kids: Child[];
  activeIdx: number;
  onSelectChild: (i: number) => void;
  /** All practice logs of the active child (any date). */
  logs: PracticeLog[];
  onAdd: (log: Omit<PracticeLog, "id" | "childId" | "createdAt">) => Promise<SaveOutcome>;
  onDelete: (id: string) => Promise<void>;
  /** Teacher: view only. */
  readOnly?: boolean;
  /** All goals of the active child (any status): active ones can be linked, titles label the history. */
  goals?: Goal[];
  /** Changes → the quick form is scrolled into view and focused (first-steps "log today's practice"). */
  focusForm?: number;
}

function readKey(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeKey(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

const EMPTY_ANSWERS: Record<PracticeQuestion, string> = { wentWell: "", toImprove: "", learned: "" };

export default function PracticePage({ kids, activeIdx, onSelectChild, logs, onAdd, onDelete, readOnly = false, goals = [], focusForm }: PracticePageProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? "mn";
  const today = localDateKey(new Date());

  const [date, setDate] = useState(today);
  const [content, setContent] = useState("");
  const [answers, setAnswers] = useState<Record<PracticeQuestion, string>>(EMPTY_ANSWERS);
  const [duration, setDuration] = useState<number>(30);
  const [customDuration, setCustomDuration] = useState(false);
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

  // Active goals → chips; the last one picked on this device is preselected, tap again = no goal.
  const active = useMemo(() => activeGoals(goals), [goals]);
  const goalTitle = useMemo(() => new Map(goals.map((g) => [g.id, g.title])), [goals]);
  const [goalId, setGoalId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (active.length === 0) { setGoalId(undefined); return; }
    const last = readKey(LAST_GOAL_KEY(childId));
    const keep = active.find((g) => g.id === goalId) ? goalId : active.find((g) => g.id === last)?.id ?? active[0].id;
    setGoalId(keep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, active.map((g) => g.id).join(",")]);
  function pickGoal(id: string) {
    if (goalId === id) { setGoalId(undefined); return; }
    writeKey(LAST_GOAL_KEY(childId), id);
    setGoalId(id);
  }

  // Last chosen child on this device wins on first mount (manifest shortcut / notification open).
  useEffect(() => {
    const last = readKey(LAST_CHILD_KEY);
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
  const history = useMemo(() => [...logs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [logs]);

  function pickChild(i: number) {
    writeKey(LAST_CHILD_KEY, kids[i].childId);
    onSelectChild(i);
  }

  const draft: PracticeDraft = { date, duration, content, goalId: active.some((g) => g.id === goalId) ? goalId : undefined, ...answers };
  const canSave = hasPracticeText(draft) && duration > 0;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const outcome = await onAdd(buildPracticeLog(draft));
      setContent("");
      setAnswers(EMPTY_ANSWERS);
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

  const totalMinutes = logs.reduce((s, l) => s + (Number(l.duration) || 0), 0);
  const totalText = () => {
    const hours = Math.floor(totalMinutes / 60), mins = totalMinutes % 60;
    if (hours > 0 && mins > 0) return t("practice.total", { hours, mins, count: logs.length });
    if (hours > 0) return t("practice.totalHours", { hours, count: logs.length });
    return t("practice.totalMins", { mins, count: logs.length });
  };

  return (
    <div data-testid="practice-page">
      {/* Child chips */}
      {kids.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 mb-4" role="tablist" aria-label={t("today.childLabel")}>
          {kids.map((k, i) => {
            const on = i === activeIdx;
            return (
              <button key={k.childId} type="button" role="tab" aria-selected={on} onClick={() => pickChild(i)}
                className={`cs-chip h-10 px-4 text-[13px] shrink-0 transition-colors ${on ? "bg-primary text-white" : "cs-chip-muted"}`}>
                {k.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Date + 7-day strip + streak */}
      <div className="cs-card p-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label={t("today.prevDay")} className="cs-icon-btn text-ink-2">
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          <div className="text-center min-w-0">
            <p className="t-body-strong text-ink truncate" data-testid="practice-date">{dateLabel()}</p>
            {date !== today && (
              <button type="button" onClick={() => setDate(today)} className="t-caption text-primary font-bold mt-0.5">{t("today.backToToday")}</button>
            )}
          </div>
          <button type="button" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label={t("today.nextDay")} className="cs-icon-btn text-ink-2 disabled:opacity-30">
            <ChevronRight size={22} strokeWidth={2.2} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1" aria-label={t("today.week")}>
          {week.map((d) => {
            const logged = days.has(d);
            const selected = d === date;
            const dt = new Date(d + "T12:00:00");
            return (
              <button key={d} type="button" onClick={() => setDate(d)} aria-pressed={selected}
                aria-label={`${dayLabel(d, lang)}${logged ? " · " + t("today.saved") : ""}`} data-logged={logged ? "1" : "0"}
                className={`flex flex-col items-center gap-1.5 py-2 rounded-input min-h-[56px] transition-colors ${selected ? "bg-primary-soft" : "hover:bg-surface-muted"}`}>
                <span className="t-caption leading-none">{weekdayShort(d, lang)}</span>
                <span className={`text-[13px] font-extrabold tabular-nums leading-none ${selected ? "text-primary-soft-ink" : "text-ink"}`}>{dt.getDate()}</span>
                <span aria-hidden className={`w-2 h-2 rounded-full ${logged ? "bg-primary" : "border border-line-strong"}`} />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2" data-testid="practice-streak">
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${streak > 0 ? "bg-primary-soft text-primary-soft-ink" : "bg-surface-muted text-ink-3"}`}>
            <Flame size={20} strokeWidth={2.2} aria-hidden />
          </span>
          <p className="t-body-strong text-ink">{streak > 0 ? t("today.streak", { count: streak }) : t("today.streakNone")}</p>
        </div>
      </div>

      {/* Quick form */}
      {readOnly ? (
        <p className="t-caption mb-4">{t("today.teacherNote")}</p>
      ) : (
        <div className="cs-card p-4 mb-6" data-testid="practice-form">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="t-caption mr-1 inline-flex items-center gap-1"><Clock size={14} aria-hidden />{t("today.durationLabel")}</span>
            {DURATIONS.map((m) => (
              <button key={m} type="button" onClick={() => { setCustomDuration(false); setDuration(m); }} aria-pressed={!customDuration && duration === m}
                className={`cs-chip h-10 px-3.5 text-[13px] tabular-nums ${!customDuration && duration === m ? "bg-primary text-white" : "cs-chip-outline"}`}>
                {t("today.minutes", { count: m })}
              </button>
            ))}
            <button type="button" onClick={() => setCustomDuration(true)} aria-pressed={customDuration}
              className={`cs-chip h-10 px-3.5 text-[13px] ${customDuration ? "bg-primary text-white" : "cs-chip-outline"}`} data-testid="practice-duration-other">
              {t("practice.durationOther")}
            </button>
            {customDuration && (
              <label className="inline-flex items-center gap-2">
                <input type="number" inputMode="numeric" min={5} max={600} step={5} value={duration || ""} autoFocus
                  onChange={(e) => setDuration(Math.max(0, Math.min(600, Math.round(Number(e.target.value) || 0))))}
                  aria-label={t("practice.fields.duration")} className="cs-input w-24 tabular-nums" data-testid="practice-duration-input" />
                <span className="t-caption">{t("practice.minutesUnit")}</span>
              </label>
            )}
          </div>

          {active.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap" data-testid="goal-chips">
              <span className="t-caption mr-1 inline-flex items-center gap-1"><Target size={14} aria-hidden />{t("goals.linkLabel")}</span>
              {active.map((g) => (
                // long names: one chip never wider than the row, cut with "…" (full name in the tooltip); several wrap
                <button key={g.id} type="button" onClick={() => pickGoal(g.id)} aria-pressed={goalId === g.id} title={g.title}
                  className={`cs-chip h-10 px-3.5 text-[13px] max-w-full sm:max-w-xs min-w-0 ${goalId === g.id ? "bg-primary text-white" : "cs-chip-outline"}`}>
                  <span className="truncate">{g.title}</span>
                </button>
              ))}
            </div>
          )}

          <label className="block mt-4">
            <span className="cs-field-label">{t("practice.q.content")}</span>
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} rows={2}
              placeholder={t("practice.q.contentPlaceholder")} className="cs-textarea min-h-[72px]" data-testid="practice-content"
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void save(); }} />
          </label>
          {PRACTICE_QUESTIONS.map((k) => (
            <label key={k} className="block mt-3">
              <span className="cs-field-label">{t(`practice.q.${k}`)}</span>
              <input value={answers[k]} onChange={(e) => setAnswers((a) => ({ ...a, [k]: e.target.value }))} maxLength={PRACTICE_TEXT_MAX}
                placeholder={t(`practice.q.${k}Placeholder`)} className="cs-input" data-testid={`practice-${k}`}
                onKeyDown={(e) => { if (e.key === "Enter") void save(); }} />
            </label>
          ))}
          <p className="t-caption mt-2">{t("practice.q.hint")}</p>

          <button type="button" onClick={() => void save()} disabled={saving || !canSave} className="cs-btn cs-btn-primary w-full mt-4" data-testid="practice-save">
            {saving ? t("today.saving") : t("today.save")}
          </button>
          {flash && (
            <p role="status" className="mt-3 flex items-center justify-center gap-1.5 t-caption text-primary font-bold cs-item-in" data-testid="practice-flash">
              <Check size={16} strokeWidth={2.5} aria-hidden />
              {flash === "queued" ? t("today.queued") : t("today.saved")}
            </p>
          )}
        </div>
      )}

      {/* History */}
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="t-label">{t("practice.historyTitle")}</p>
        {logs.length > 0 && <p className="t-caption" data-testid="practice-total">{totalText()}</p>}
      </div>
      {history.length === 0 ? (
        <div className="cs-card border-dashed p-8 text-center" data-testid="practice-empty">
          <Clock size={40} strokeWidth={1.75} className="mx-auto text-ink-3" aria-hidden="true" />
          <p className="t-body-strong text-ink mt-3">{t("practice.empty.title")}</p>
          <p className="t-caption mt-1">{t("practice.empty.subtitle")}</p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="practice-history">
          {history.map((log) => {
            const answered = answeredQuestions(log);
            const title = log.goalId ? goalTitle.get(log.goalId) : undefined;
            return (
              <li key={log.id} className="cs-card p-3.5 cs-item-in" data-testid="practice-entry">
                <div className="flex items-start justify-between gap-3">
                  <p className="t-caption min-w-0 flex flex-wrap items-center gap-x-1.5" data-testid="practice-entry-meta">
                    <span>{dayLabel(log.date, lang)}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums font-bold text-ink-2">{t("today.minutes", { count: Number(log.duration) || 0 })}</span>
                    {title && (<><span aria-hidden>·</span><span className="inline-flex items-center gap-1 text-primary-soft-ink min-w-0"><Target size={12} aria-hidden /><span className="truncate">{title}</span></span></>)}
                  </p>
                  {!readOnly && (
                    deleteId === log.id ? (
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => { void onDelete(log.id); setDeleteId(null); }} className="cs-btn cs-btn-danger cs-btn-xs">{t("practice.actions.confirmDelete")}</button>
                        <button type="button" onClick={() => setDeleteId(null)} className="cs-btn cs-btn-ghost cs-btn-xs">{t("practice.actions.cancelDelete")}</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDeleteId(log.id)} aria-label={t("practice.actions.delete")} title={t("practice.actions.delete")} className="cs-icon-btn cs-icon-btn-sm text-ink-3 hover:text-error shrink-0 -mt-1 -mr-1">
                        <Trash2 size={16} />
                      </button>
                    )
                  )}
                </div>
                {log.content && <p className="t-body text-ink mt-1 break-words">{log.content}</p>}
                {answered.length > 0 && (
                  <dl className="mt-2 space-y-1.5" data-testid="practice-answers">
                    {answered.map(({ key, text }) => (
                      <div key={key} className="border-l-[3px] border-primary-soft pl-2.5">
                        <dt className="t-caption font-bold text-ink-2">{t(`practice.q.${key}`)}</dt>
                        <dd className="t-body text-ink break-words">{text}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
