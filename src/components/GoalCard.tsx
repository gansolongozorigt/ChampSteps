// =============================================================================
// GoalCard — compact card on the Today screen: countdown, sessions/hours, weekly target.
// =============================================================================

import { useTranslation } from "react-i18next";
import { ChevronRight, Target } from "lucide-react";
import type { Goal } from "../types";
import { hoursLabel, type GoalStats } from "../lib/goals";

export function statsLine(t: (k: string, o?: Record<string, unknown>) => string, s: GoalStats): string {
  const h = hoursLabel(s.minutes);
  return h.hours > 0 ? t("goals.stats", { sessions: s.sessions, hours: h.hours }) : t("goals.statsMin", { sessions: s.sessions, minutes: s.minutes });
}

export default function GoalCard({ goal, stats, onOpen }: { goal: Goal; stats: GoalStats; onOpen: () => void }) {
  const { t } = useTranslation();
  const countdown = stats.daysLeft === 0
    ? t("goals.isToday", { title: goal.title })
    : stats.daysLeft < 0
    ? t("goals.overdue", { title: goal.title })
    : t("goals.daysLeft", { count: stats.daysLeft, title: goal.title });
  const target = goal.targetSessionsPerWeek ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((stats.weekSessions / target) * 100)) : 0;
  return (
    <button type="button" onClick={onOpen} className="cs-card p-4 text-left w-full min-w-[260px] snap-start hover:bg-bg-soft transition-colors" data-testid="goal-card">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-primary-soft text-primary-soft-ink flex items-center justify-center shrink-0">
          <Target size={20} strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-body-strong text-ink leading-snug" data-testid="goal-countdown">{countdown}</p>
          <p className="t-caption mt-0.5" data-testid="goal-stats">{statsLine(t, stats)}</p>
          {target > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between t-caption">
                <span>{t("goals.weekProgress", { done: stats.weekSessions, target })}</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
        <ChevronRight size={18} className="text-ink-3 shrink-0 mt-2" aria-hidden />
      </div>
    </button>
  );
}
