// =============================================================================
// GoalForm — create / edit a goal (competition the child prepares for).
// One screen, two required fields (name, date), category chips, optional targets.
// Brand: docs/BRAND.md (modal, pill chips, lucide icons, no emoji).
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Dumbbell, Palette, Target, type LucideIcon } from "lucide-react";
import type { AchievementCategory, Goal, GoalDraft } from "../types";
import { localDateKey } from "../lib/streak";

const CATEGORIES: AchievementCategory[] = ["Sports", "Arts", "Academic"];
const CATEGORY_ICON: Record<AchievementCategory, LucideIcon> = { Sports: Dumbbell, Arts: Palette, Academic: BookOpen };

export interface GoalFormProps {
  childName?: string;
  /** Edit mode when set. */
  initial?: Goal;
  onSubmit: (draft: GoalDraft) => Promise<void>;
  onCancel: () => void;
  /** Free plan: one active goal per child. Shown as a note; the form stays usable for edits. */
  limitReached?: boolean;
  onUpgrade?: () => void;
  /** First-steps flow right after the first child: "When is the next competition?" + why, cancel = "no competition yet". */
  intro?: boolean;
}

export default function GoalForm({ childName, initial, onSubmit, onCancel, limitReached = false, onUpgrade, intro = false }: GoalFormProps) {
  const { t } = useTranslation();
  const today = localDateKey(new Date());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [category, setCategory] = useState<AchievementCategory>(initial?.category ?? "Sports");
  const [sessions, setSessions] = useState(initial?.targetSessionsPerWeek ? String(initial.targetSessionsPerWeek) : "");
  const [minutes, setMinutes] = useState(initial?.targetMinutes ? String(initial.targetMinutes) : "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});
  const blocked = limitReached && !initial;

  async function submit() {
    const next: typeof errors = {};
    if (!title.trim()) next.title = t("form.validation.required");
    if (!date) next.date = t("form.validation.required");
    else if (date < today && !initial) next.date = t("goals.validation.future");
    setErrors(next);
    if (Object.keys(next).length || blocked) return;
    setSaving(true);
    try {
      const s = Number(sessions), m = Number(minutes);
      await onSubmit({
        title: title.trim(),
        date,
        category,
        targetSessionsPerWeek: Number.isFinite(s) && s > 0 ? Math.round(s) : undefined,
        targetMinutes: Number.isFinite(m) && m > 0 ? Math.round(m) : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="goal-form-title" data-testid="goal-form">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          {childName && <p className="t-label">{childName}</p>}
          <h2 id="goal-form-title" className="t-h1 mt-1 inline-flex items-center gap-2">
            <Target size={22} strokeWidth={2.2} className="text-primary" aria-hidden />
            {initial ? t("goals.editTitle") : intro ? t("onboarding.goalIntro.title") : t("goals.formTitle")}
          </h2>
          {intro && <p className="t-body text-ink-2 mt-1" data-testid="goal-intro-hint">{t("onboarding.goalIntro.hint")}</p>}

          {blocked && (
            <div className="mt-4 rounded-input bg-bg-soft px-3 py-2 t-caption text-ink-2" role="status">
              {t("goals.limitFree")}
              {onUpgrade && <button type="button" onClick={onUpgrade} className="ml-2 font-bold text-primary hover:underline">{t("sub.upgrade")}</button>}
            </div>
          )}

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="cs-field-label">{t("goals.fields.title")}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("goals.fields.titlePlaceholder")} className="cs-input" aria-invalid={errors.title ? "true" : undefined} data-testid="goal-title" />
              {errors.title && <span className="t-caption text-error mt-1 block">{errors.title}</span>}
            </label>
            <label className="block">
              <span className="cs-field-label">{t("goals.fields.date")}</span>
              <input type="date" value={date} min={initial ? undefined : today} onChange={(e) => setDate(e.target.value)} className="cs-input" aria-invalid={errors.date ? "true" : undefined} data-testid="goal-date" />
              {errors.date && <span className="t-caption text-error mt-1 block">{errors.date}</span>}
            </label>
            <div>
              <span className="cs-field-label">{t("goals.fields.category")}</span>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  const active = category === c;
                  return (
                    <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={active} className={`cs-chip h-10 px-3.5 text-[13px] inline-flex items-center gap-1.5 ${active ? "bg-primary text-white" : "cs-chip-outline"}`}>
                      <Icon size={16} strokeWidth={2.2} aria-hidden />{t(`categories.${c}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="cs-field-label">{t("goals.fields.sessionsPerWeek")}</span>
                <input type="number" inputMode="numeric" min={1} max={14} value={sessions} onChange={(e) => setSessions(e.target.value)} className="cs-input tabular-nums" data-testid="goal-sessions" />
              </label>
              <label className="block">
                <span className="cs-field-label">{t("goals.fields.minutes")}</span>
                <input type="number" inputMode="numeric" min={5} max={600} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="cs-input tabular-nums" data-testid="goal-minutes" />
              </label>
            </div>
          </div>

          {/* intro: the long "no competition yet" label → full-width buttons, save on top */}
          <div className={intro ? "mt-6 flex flex-col-reverse gap-2" : "mt-6 flex justify-end gap-2"}>
            <button type="button" onClick={onCancel} className={`cs-btn cs-btn-ghost ${intro ? "w-full" : ""}`} data-testid={intro ? "goal-intro-skip" : undefined}>{intro ? t("onboarding.goalIntro.skip") : t("goals.cancel")}</button>
            <button type="button" onClick={() => void submit()} disabled={saving || blocked} className={`cs-btn cs-btn-primary ${intro ? "w-full" : ""}`} data-testid="goal-submit">
              {saving ? t("goals.saving") : t("goals.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
