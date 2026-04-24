// =============================================================================
// AddAchievementForm — Multi-step form with i18next translations.
// Step 1: Basics (title, date, location, category)
// Step 2: Award + description
// Step 3: Photo upload (with client-side compression preview)
// Step 4: Review & submit
// =============================================================================

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  AchievementCategory,
  AchievementDraft,
  AwardType,
} from "../types";
import { compressImages } from "../utils/image";
import { awardStyles, categoryStyles, formatDate } from "../utils/format";

const CATEGORIES: AchievementCategory[] = ["Sports", "Arts", "Academic"];
const AWARDS: AwardType[] = ["Gold", "Silver", "Bronze", "Participant"];

const EMPTY_DRAFT: AchievementDraft = {
  title: "",
  date: new Date().toISOString().slice(0, 10),
  location: "",
  category: "Sports",
  description: "",
  awardType: "Gold",
  images: [],
};

export interface AddAchievementFormProps {
  childId: string;
  childName?: string;
  onSubmit: (draft: AchievementDraft) => Promise<void> | void;
  onCancel?: () => void;
}

type Step = 1 | 2 | 3 | 4;

export default function AddAchievementForm({
  childId,
  childName,
  onSubmit,
  onCancel,
}: AddAchievementFormProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<AchievementDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AchievementDraft, string>>>({});

  const previews = useMemo(
    () => draft.images.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [draft.images]
  );

  function update<K extends keyof AchievementDraft>(key: K, value: AchievementDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validateStep(s: Step): boolean {
    const next: typeof errors = {};
    if (s === 1) {
      if (!draft.title.trim()) next.title = t("form.validation.required");
      if (!draft.date) next.date = t("form.validation.required");
      if (!draft.location.trim()) next.location = t("form.validation.required");
    }
    if (s === 2) {
      if (!draft.description.trim()) next.description = t("form.validation.descriptionTooShort");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).slice(0, 8 - draft.images.length);
    const compressed = await compressImages(incoming, { maxDimension: 1600, quality: 0.8 });
    update("images", [...draft.images, ...compressed]);
  }

  function removeImage(index: number) {
    update(
      "images",
      draft.images.filter((_, i) => i !== index)
    );
  }

  async function handleSubmit() {
    if (!validateStep(2)) {
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(draft);
      setDraft(EMPTY_DRAFT);
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-stone-200 bg-stone-50/80 p-6 shadow-sm">
      <Header step={step} childName={childName} />

      <div className="mt-6 space-y-5">
        {step === 1 && (
          <section className="space-y-4">
            <Field label={t("form.fields.title")} error={errors.title}>
              <input
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder={t("form.fields.titlePlaceholder")}
                className={inputCls}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("form.fields.date")} error={errors.date}>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => update("date", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label={t("form.fields.location")} error={errors.location}>
                <input
                  value={draft.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder={t("form.fields.locationPlaceholder")}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label={t("form.fields.category")}>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const selected = draft.category === c;
                  return (
                    <button
                      type="button"
                      key={c}
                      onClick={() => update("category", c)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition ${
                        selected
                          ? `${categoryStyles[c].chip} ring-2`
                          : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {t(`categories.${c}`)}
                    </button>
                  );
                })}
              </div>
            </Field>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <Field label={t("form.fields.award")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AWARDS.map((a) => {
                  const selected = draft.awardType === a;
                  const s = awardStyles[a];
                  return (
                    <button
                      type="button"
                      key={a}
                      onClick={() => update("awardType", a)}
                      className={`flex flex-col items-center gap-1 rounded-xl border bg-white p-3 text-sm transition ${
                        selected ? `border-transparent ring-2 ${s.ring} ${s.bg}` : "border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      <span className="text-2xl" aria-hidden>{s.emoji}</span>
                      <span className={`font-medium ${selected ? s.text : "text-stone-700"}`}>
                        {t(`awards.${a}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={t("form.fields.description")} error={errors.description}>
              <textarea
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                rows={4}
                placeholder={t("form.fields.descriptionPlaceholder")}
                className={`${inputCls} resize-y`}
              />
            </Field>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <Field label={t("form.fields.photos")}>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-white p-8 text-center text-stone-500 hover:border-stone-400">
                <span className="text-3xl" aria-hidden>📸</span>
                <span className="text-sm font-medium">{t("form.fields.uploadCta")}</span>
                <span className="text-xs text-stone-400">{t("form.fields.uploadHint")}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            </Field>

            {previews.length > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {previews.map((p, i) => (
                  <li key={p.name + i} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200">
                    <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    >
                      {t("form.actions.remove")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="space-y-3">
            <h3 className="font-serif text-lg text-stone-800">{t("form.review.heading")}</h3>
            <ReviewRow label={t("form.review.labels.title")} value={draft.title} />
            <ReviewRow label={t("form.review.labels.date")} value={formatDate(draft.date, locale)} />
            <ReviewRow label={t("form.review.labels.location")} value={draft.location} />
            <ReviewRow label={t("form.review.labels.category")} value={t(`categories.${draft.category}`)} />
            <ReviewRow
              label={t("form.review.labels.award")}
              value={`${awardStyles[draft.awardType].emoji} ${t(`awards.${draft.awardType}`)}`}
            />
            <ReviewRow label={t("form.review.labels.description")} value={draft.description} />
            <ReviewRow
              label={t("form.review.labels.photos")}
              value={t("form.review.photosAttached", { count: draft.images.length })}
            />
          </section>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (step === 1 ? onCancel?.() : setStep((s) => (s - 1) as Step))}
          className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          {step === 1 ? t("form.actions.cancel") : t("form.actions.back")}
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={() => (validateStep(step) ? setStep((s) => (s + 1) as Step) : null)}
            className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-stone-50 hover:bg-stone-800"
          >
            {t("form.actions.continue")}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting
              ? t("form.actions.saving")
              : childName
              ? t("form.actions.saveForChild", { name: childName })
              : t("form.actions.save")}
          </button>
        )}
      </div>

      <input type="hidden" name="childId" value={childId} readOnly />
    </div>
  );
}

// -----------------------------------------------------------------------------

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200";

function Header({ step, childName }: { step: Step; childName?: string }) {
  const { t } = useTranslation();
  const labels = [
    t("form.steps.basics"),
    t("form.steps.story"),
    t("form.steps.photos"),
    t("form.steps.review"),
  ];
  return (
    <header>
      <p className="text-xs uppercase tracking-widest text-stone-500">
        {childName
          ? t("form.headerEyebrowWithName", { name: childName })
          : t("form.headerEyebrow")}
      </p>
      <h2 className="mt-1 font-serif text-2xl text-stone-900">{t("form.heading")}</h2>

      <ol className="mt-5 flex items-center gap-2">
        {labels.map((label, i) => {
          const idx = (i + 1) as Step;
          const active = idx === step;
          const done = idx < step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                  done
                    ? "bg-emerald-600 text-white"
                    : active
                    ? "bg-stone-900 text-white"
                    : "bg-stone-200 text-stone-500"
                }`}
              >
                {done ? "✓" : idx}
              </span>
              <span className={`hidden text-xs sm:inline ${active ? "text-stone-800" : "text-stone-500"}`}>
                {label}
              </span>
              {i < labels.length - 1 && <span className="h-px flex-1 bg-stone-200" />}
            </li>
          );
        })}
      </ol>
    </header>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-stone-200 py-2 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-stone-800">{value || "—"}</span>
    </div>
  );
}
