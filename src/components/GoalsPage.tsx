// =============================================================================
// GoalsPage — "Зорилго" (/goals, old /today links land here): when, at which
// competition, aiming for what result. Active goals (countdown, linked practice,
// target result), add a goal, the competition-day screen ("You are ready"),
// "how did it go?" for a past date, and finished / cancelled goals (collapsed).
// Daily practice lives on the Practice page. Brand: docs/BRAND.md (lucide, no emoji).
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, ChevronDown, Plus, Target, Trophy, XCircle } from "lucide-react";
import type { Child, Goal, PracticeLog } from "../types";
import { dayLabel, localDateKey } from "../lib/streak";
import { activeGoals, goalStats, goalsToday, overdueGoals, pastGoals } from "../lib/goals";
import GoalCard from "./GoalCard";
import CelebrationScreen from "./CelebrationScreen";

export interface GoalsPageProps {
  child: Child;
  /** All practice logs of the active child (goal statistics). */
  logs: PracticeLog[];
  /** All goals of the active child (any status). */
  goals: Goal[];
  /** Teacher: view only. */
  readOnly?: boolean;
  onAddGoal?: () => void;
  onOpenGoal?: (goal: Goal) => void;
  onEditGoal?: (goal: Goal) => void;
  /** "Record the result" → achievement form prefilled (App.tsx). */
  onGoalResult?: (goal: Goal) => void;
  /** Free plan with its active goal(s) used: the add button opens the form with the upgrade note. */
  limitReached?: boolean;
}

export default function GoalsPage({ child, logs, goals, readOnly = false, onAddGoal, onOpenGoal, onEditGoal, onGoalResult, limitReached = false }: GoalsPageProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? "mn";
  const today = localDateKey(new Date());

  const active = useMemo(() => activeGoals(goals), [goals]);
  const todayGoals = useMemo(() => goalsToday(goals, today), [goals, today]);
  const overdue = useMemo(() => overdueGoals(goals, today), [goals, today]);
  const past = useMemo(() => pastGoals(goals), [goals]);
  // Celebration can be switched to the plain view for this child until the page is reopened.
  const [plainView, setPlainView] = useState(false);
  useEffect(() => { setPlainView(false); }, [child.childId]);
  const [showPast, setShowPast] = useState(false);

  return (
    <div data-testid="goals-page">
      {/* Competition day: full-screen celebration for the child (first goal dated today). */}
      {todayGoals.length > 0 && !plainView && (
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
          {g.targetResult && <p className="t-caption text-primary-soft-ink mt-0.5">{t("goals.targetLine", { target: g.targetResult })}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onGoalResult?.(g)} className="cs-btn cs-btn-primary cs-btn-sm"><Trophy size={16} aria-hidden />{t("goals.writeResult")}</button>
            <button type="button" onClick={() => onEditGoal?.(g)} className="cs-btn cs-btn-outline cs-btn-sm">{t("goals.notYet")}</button>
          </div>
        </div>
      ))}

      {/* Active goals */}
      {active.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 mb-4" data-testid="goal-cards">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} stats={goalStats(g, logs, today)} onOpen={() => onOpenGoal?.(g)} />
          ))}
        </div>
      ) : readOnly ? (
        <div className="cs-card border-dashed p-8 text-center mb-4" data-testid="goals-empty">
          <Target size={40} strokeWidth={1.75} className="mx-auto text-ink-3" aria-hidden />
          <p className="t-body-strong text-ink mt-3">{t("goals.page.emptyTitle")}</p>
        </div>
      ) : null}

      {!readOnly && onAddGoal && (
        <button type="button" onClick={onAddGoal} className="cs-card border-dashed p-4 mb-4 w-full text-left flex items-center gap-3 hover:border-primary transition-colors" data-testid="goal-add-card" data-limit={limitReached ? "1" : undefined}>
          <span className="w-10 h-10 rounded-full bg-primary-soft text-primary-soft-ink flex items-center justify-center shrink-0"><Target size={20} strokeWidth={2.2} aria-hidden /></span>
          <span className="min-w-0">
            <span className="t-body-strong text-ink block">{active.length > 0 ? t("goals.page.addAnother") : t("goals.addCta")}</span>
            <span className="t-caption block">{t("goals.addCtaHint")}</span>
          </span>
          <Plus size={18} className="ml-auto text-ink-3 shrink-0" aria-hidden />
        </button>
      )}

      {/* Finished / cancelled goals, collapsed */}
      {past.length > 0 && (
        <section className="mt-6" data-testid="goals-past">
          <button type="button" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast} className="w-full flex items-center justify-between gap-2 min-h-[44px] text-left" data-testid="goals-past-toggle">
            <span className="t-label">{t("goals.page.past", { count: past.length })}</span>
            <ChevronDown size={18} className={`text-ink-3 transition-transform ${showPast ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showPast && (
            <ul className="mt-2 space-y-2">
              {past.map((g) => {
                const done = g.status === "done";
                return (
                  <li key={g.id}>
                    <button type="button" onClick={() => onOpenGoal?.(g)} className="cs-card p-3 w-full text-left flex items-start gap-3 hover:bg-bg-soft transition-colors" data-testid="goal-past-item">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-primary-soft text-primary-soft-ink" : "bg-surface-muted text-ink-3"}`}>
                        {done ? <Award size={18} strokeWidth={2.2} aria-hidden /> : <XCircle size={18} strokeWidth={2.2} aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="t-body-strong text-ink block break-words">{g.title}</span>
                        <span className="t-caption block">{dayLabel(g.date, lang)} · {t(done ? "goals.detail.done" : "goals.detail.cancelled")}</span>
                        {g.targetResult && <span className="t-caption block text-primary-soft-ink">{t("goals.targetLine", { target: g.targetResult })}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
