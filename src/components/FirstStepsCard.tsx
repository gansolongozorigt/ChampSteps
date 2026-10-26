// =============================================================================
// FirstStepsCard — "Эхлэх алхмууд" at the top of the parent dashboard and Today.
// Each step: title + one short "why" line; a done step shows only a check (no
// counts, no percent, no progress bar). Tapping an open step goes straight to it.
// Steps come from src/lib/onboarding.ts. Brand: docs/BRAND.md (lucide, no emoji).
// =============================================================================

import { useTranslation } from "react-i18next";
import { BellRing, Check, ChevronRight, Clock, Target, Trophy, UserPlus, X, type LucideIcon } from "lucide-react";
import type { Step, StepId } from "../lib/onboarding";

const ICON: Record<StepId, LucideIcon> = { child: UserPlus, goal: Target, practice: Clock, achievement: Trophy, reminder: BellRing };

export interface FirstStepsCardProps {
  steps: Step[];
  onStep: (id: StepId) => void;
  onClose: () => void;
  className?: string;
}

export default function FirstStepsCard({ steps, onStep, onClose, className = "" }: FirstStepsCardProps) {
  const { t } = useTranslation();
  return (
    <section className={`cs-card p-4 ${className}`} aria-labelledby="first-steps-title" data-testid="first-steps">
      <div className="flex items-center justify-between gap-2">
        <h2 id="first-steps-title" className="t-h2">{t("onboarding.card.title")}</h2>
        <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost cs-btn-xs text-ink-3 -mr-1" data-testid="first-steps-close">
          <X size={16} aria-hidden />{t("onboarding.card.close")}
        </button>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {steps.map(({ id, done }) => {
          const Icon = ICON[id];
          const body = (
            <>
              <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-primary text-white" : "bg-primary-soft text-primary-soft-ink"}`}>
                {done ? <Check size={18} strokeWidth={2.6} aria-label={t("onboarding.card.done")} /> : <Icon size={18} strokeWidth={2.2} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`t-body-strong block ${done ? "text-ink-2" : "text-ink"}`}>{t(`onboarding.steps.${id}.title`)}</span>
                <span className="t-caption block">{t(`onboarding.steps.${id}.why`)}</span>
              </span>
            </>
          );
          return (
            <li key={id} data-testid={`first-step-${id}`} data-done={done ? "1" : "0"}>
              {done ? (
                <div className="flex items-center gap-3 py-2.5">{body}</div>
              ) : (
                <button type="button" onClick={() => onStep(id)} className="w-full flex items-center gap-3 py-2.5 text-left min-h-[52px] rounded-input hover:bg-bg-soft transition-colors">
                  {body}
                  <ChevronRight size={18} className="text-ink-3 shrink-0" aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
