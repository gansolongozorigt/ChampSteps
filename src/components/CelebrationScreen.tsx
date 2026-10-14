// =============================================================================
// CelebrationScreen — competition day. Full screen, few big words, for the child:
// "{name}, today is {goal}!" / "you practised on 43 of 61 days" / "31 hours" / "You are ready."
// Avatar in a big circle; the three brand bars rise with a soft CSS animation
// (prefers-reduced-motion respected). Green / white only; no confetti.
// Small parent buttons at the bottom: record the result, plain view.
// =============================================================================

import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Award, LayoutList } from "lucide-react";
import type { Child, Goal } from "../types";
import { hoursLabel, type GoalStats } from "../lib/goals";

interface Props {
  child: Child;
  goal: Goal;
  stats: GoalStats;
  readOnly?: boolean;
  onResult: () => void;
  onPlainView: () => void;
}

export default function CelebrationScreen({ child, goal, stats, readOnly = false, onResult, onPlainView }: Props) {
  const { t } = useTranslation();
  const h = hoursLabel(stats.minutes);
  // Portal: the section wrapper animates with a transform, which would turn `fixed` into a
  // main-area overlay (sidebar visible, buttons clipped). On <body> it really covers the screen.
  return createPortal(
    <div className="fixed inset-0 z-40 bg-bg flex flex-col print:hidden" data-testid="celebration" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-[env(safe-area-inset-top)]">
        {child.avatarUrl ? (
          <img src={child.avatarUrl} alt={child.name} className="w-28 h-28 rounded-full object-cover border-4 border-primary-soft shadow-float" />
        ) : (
          <div className="w-28 h-28 rounded-full bg-primary-soft text-primary-soft-ink flex items-center justify-center text-[44px] font-extrabold border-4 border-primary-soft">
            {child.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="cs-rise mt-5 flex items-end gap-1.5 h-10" aria-hidden>
          <span className="cs-rise-bar w-4 h-5 rounded-md bg-primary" />
          <span className="cs-rise-bar w-4 h-7 rounded-md bg-primary" />
          <span className="cs-rise-bar w-4 h-10 rounded-md bg-ink" />
        </div>
        <h1 id="celebration-title" className="t-display mt-6 text-ink text-balance break-words">{t("goals.celebration.headline", { name: child.name, title: goal.title })}</h1>
        <p className="t-h2 mt-5 text-ink-2">{t("goals.celebration.days", { days: stats.days, total: stats.daysTotal })}</p>
        <p className="t-stat text-primary mt-2 text-[34px] leading-none">{h.hours > 0 ? t("goals.celebration.hours", { hours: h.hours }) : t("goals.celebration.minutes", { minutes: stats.minutes })}</p>
        <p className="t-display mt-6 text-primary">{t("goals.celebration.ready")}</p>
      </div>
      <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center justify-center gap-2">
        {!readOnly && (
          <button type="button" onClick={onResult} className="cs-btn cs-btn-primary cs-btn-sm" data-testid="celebration-result">
            <Award size={16} aria-hidden />{t("goals.celebration.writeResult")}
          </button>
        )}
        <button type="button" onClick={onPlainView} className="cs-btn cs-btn-ghost cs-btn-sm text-ink-3" data-testid="celebration-plain">
          <LayoutList size={16} aria-hidden />{t("goals.celebration.plainView")}
        </button>
      </div>
    </div>,
    document.body
  );
}
