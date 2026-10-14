// =============================================================================
// GoalDetailModal — countdown, statistics, linked practice entries, edit / cancel,
// "record the result" (opens the achievement form prefilled, App.tsx).
// =============================================================================

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, CalendarDays, Clock, Flame, Pencil, Target, X } from "lucide-react";
import type { Goal, PracticeLog } from "../types";
import { goalStats, hoursLabel, logsForGoal } from "../lib/goals";
import { dayLabel } from "../lib/streak";

interface Props {
  goal: Goal;
  logs: PracticeLog[];
  today: string;
  readOnly?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelGoal: () => Promise<void>;
  onResult: () => void;
}

export default function GoalDetailModal({ goal, logs, today, readOnly = false, onClose, onEdit, onCancelGoal, onResult }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? "mn";
  const stats = useMemo(() => goalStats(goal, logs, today), [goal, logs, today]);
  const mine = useMemo(() => logsForGoal(goal, logs).sort((a, b) => (a.date < b.date ? 1 : -1)), [goal, logs]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const h = hoursLabel(stats.minutes);
  const active = goal.status === "active";

  const countdown = !active
    ? t(goal.status === "done" ? "goals.detail.done" : "goals.detail.cancelled")
    : stats.daysLeft === 0 ? t("goals.detail.today")
    : stats.daysLeft < 0 ? t("goals.detail.past")
    : t("goals.detail.countdown", { count: stats.daysLeft });

  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-lg" role="dialog" aria-modal="true" aria-labelledby="goal-detail-title" data-testid="goal-detail">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="t-label inline-flex items-center gap-1.5"><Target size={14} aria-hidden />{t(`categories.${goal.category}`)} · {dayLabel(goal.date, lang)}</p>
              <h2 id="goal-detail-title" className="t-h1 mt-1 break-words">{goal.title}</h2>
              <p className={`t-body-strong mt-1 ${active && stats.daysLeft >= 0 ? "text-primary" : "text-ink-2"}`} data-testid="goal-detail-countdown">{countdown}</p>
            </div>
            <button type="button" onClick={onClose} aria-label={t("goals.detail.close")} className="cs-icon-btn cs-icon-btn-sm text-ink-3 shrink-0"><X size={18} /></button>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-2" data-testid="goal-detail-stats">
            <Stat Icon={CalendarDays} label={t("goals.detail.days")} value={String(stats.days)} sub={t("goals.detail.ofTotal", { total: stats.daysTotal })} />
            <Stat Icon={Award} label={t("goals.detail.sessions")} value={String(stats.sessions)} sub={goal.targetSessionsPerWeek ? t("goals.weekProgress", { done: stats.weekSessions, target: goal.targetSessionsPerWeek }) : undefined} />
            <Stat Icon={Clock} label={t("goals.detail.hours")} value={h.hours > 0 ? `${h.hours}` : `${stats.minutes}`} sub={h.hours > 0 ? `${h.minutes} min` : "min"} />
            <Stat Icon={Flame} label={t("goals.detail.streak")} value={String(stats.longestStreak)} />
          </dl>

          <p className="t-label mt-5 mb-2">{t("goals.detail.logs")}</p>
          {mine.length === 0 ? (
            <p className="t-caption">{t("goals.detail.noLogs")}</p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {mine.map((l) => (
                <li key={l.id} className="flex items-start gap-2 t-caption text-ink-2">
                  <span className="tabular-nums shrink-0 w-24">{l.date}</span>
                  <span className="tabular-nums shrink-0 w-10 text-ink">{l.duration}m</span>
                  <span className="min-w-0 break-words">{l.content}</span>
                </li>
              ))}
            </ul>
          )}

          {!readOnly && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {active && (
                <button type="button" onClick={onResult} className="cs-btn cs-btn-primary" data-testid="goal-result">
                  <Award size={18} strokeWidth={2.2} aria-hidden />{t("goals.detail.result")}
                </button>
              )}
              {active && <button type="button" onClick={onEdit} className="cs-btn cs-btn-outline"><Pencil size={16} aria-hidden />{t("goals.detail.edit")}</button>}
              {active && (
                confirmCancel ? (
                  <span className="inline-flex items-center gap-1 ml-auto">
                    <span className="t-caption">{t("goals.detail.cancelConfirm")}</span>
                    <button type="button" disabled={busy} onClick={() => { setBusy(true); void onCancelGoal().finally(() => setBusy(false)); }} className="cs-btn cs-btn-danger cs-btn-xs">{t("practice.actions.confirmDelete")}</button>
                    <button type="button" onClick={() => setConfirmCancel(false)} className="cs-btn cs-btn-ghost cs-btn-xs">{t("practice.actions.cancelDelete")}</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmCancel(true)} className="cs-btn cs-btn-ghost cs-btn-sm ml-auto text-ink-3">{t("goals.detail.cancelGoal")}</button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ Icon, label, value, sub }: { Icon: typeof Clock; label: string; value: string; sub?: string }) {
  return (
    <div className="cs-card-soft px-3 py-2.5">
      <dt className="t-caption inline-flex items-center gap-1"><Icon size={13} aria-hidden />{label}</dt>
      <dd className="t-stat text-ink leading-tight mt-0.5">{value}{sub && <span className="t-caption font-semibold ml-1.5">{sub}</span>}</dd>
    </div>
  );
}
