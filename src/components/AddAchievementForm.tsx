// =============================================================================
// AddAchievementForm v2 — initialDraft prop нэмэгдсэн (edit дэмжинэ)
// UI: brand tokens (docs/BRAND.md). The root is a plain container — App.tsx
// wraps it in .cs-modal (handle, radius, backdrop). Logic unchanged.
// =============================================================================

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Camera, Dumbbell, Medal, Palette, X, type LucideIcon } from "lucide-react";
import type { AchievementCategory, AchievementDraft, AwardType } from "../types";
import { compressImages, validateImageFile } from "../utils/image";
import { formatDate } from "../utils/format";

const CATEGORIES: AchievementCategory[] = ["Sports", "Arts", "Academic"];
const AWARDS: AwardType[] = ["Gold", "Silver", "Bronze", "Participant"];

const CATEGORY_ICON: Record<AchievementCategory, LucideIcon> = { Sports: Dumbbell, Arts: Palette, Academic: BookOpen };
const AWARD_CHIP: Record<AwardType, string> = {
  Gold: "cs-chip-gold",
  Silver: "cs-chip-silver",
  Bronze: "cs-chip-bronze",
  Participant: "cs-chip-participant",
};
const AWARD_ICON_COLOR: Record<AwardType, string> = {
  Gold: "text-gold",
  Silver: "text-silver",
  Bronze: "text-bronze",
  Participant: "text-ink-3",
};

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
  /** Edit горимд хуучин утгуудыг урьдчилан бөглөхөд ашиглана */
  initialDraft?: Partial<AchievementDraft>;
  onSubmit: (draft: AchievementDraft) => Promise<void> | void;
  onCancel?: () => void;
  /** Rejected/undecodable photo → parent shows a toast. */
  onError?: (message: string) => void;
}

type Step = 1 | 2 | 3 | 4;

export default function AddAchievementForm({
  childId,
  childName,
  initialDraft,
  onSubmit,
  onCancel,
  onError,
}: AddAchievementFormProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const isEditing = !!initialDraft;

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<AchievementDraft>({
    ...EMPTY_DRAFT,
    ...initialDraft,
    images: [],
  });
  // Edit mode: photos already uploaded; the user may remove some.
  const [kept, setKept] = useState<string[]>(
    () => (initialDraft as { imageURLs?: string[] } | undefined)?.imageURLs ?? []
  );
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
    const all = Array.from(files);
    const rejected = all.map(validateImageFile).find((r) => r !== null);
    if (rejected) {
      onError?.(t(rejected === "size" ? "form.validation.imageSize" : "form.validation.imageType"));
      return;
    }
    const incoming = all.slice(0, Math.max(0, 8 - kept.length - draft.images.length));
    try {
      const compressed = await compressImages(incoming, { maxDimension: 1600, quality: 0.8 });
      update("images", [...draft.images, ...compressed]);
    } catch (e) {
      console.warn("[champstep] image decode failed:", e);
      onError?.(t("form.validation.imageType")); // HEIC/corrupt: browser could not decode it
    }
  }

  function removeImage(index: number) {
    update("images", draft.images.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!validateStep(2)) { setStep(2); return; }
    setSubmitting(true);
    try {
      await onSubmit(isEditing ? { ...draft, keptImageURLs: kept } : draft);
      setDraft(EMPTY_DRAFT);
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  }

  const AwardIcon = Medal;

  return (
    <div className="w-full p-5 sm:p-6">
      <Header step={step} childName={childName} isEditing={isEditing} />

      <div className="mt-6 space-y-5">
        {step === 1 && (
          <section className="space-y-4">
            <Field label={t("form.fields.title")} error={errors.title}>
              <input
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder={t("form.fields.titlePlaceholder")}
                className="cs-input"
                aria-invalid={errors.title ? "true" : undefined}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("form.fields.date")} error={errors.date}>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => update("date", e.target.value)}
                  className="cs-input"
                  aria-invalid={errors.date ? "true" : undefined}
                />
              </Field>
              <Field label={t("form.fields.location")} error={errors.location}>
                <input
                  value={draft.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder={t("form.fields.locationPlaceholder")}
                  className="cs-input"
                  aria-invalid={errors.location ? "true" : undefined}
                />
              </Field>
            </div>
            <Field label={t("form.fields.category")} group>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const selected = draft.category === c;
                  const Icon = CATEGORY_ICON[c];
                  return (
                    <button
                      type="button"
                      key={c}
                      onClick={() => update("category", c)}
                      aria-pressed={selected}
                      className={`cs-chip ${selected ? "" : "cs-chip-outline"} h-11 px-4 text-[14px]`}
                    >
                      <Icon size={18} strokeWidth={2} />
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
            <Field label={t("form.fields.award")} group>
              <div className="flex flex-wrap gap-2">
                {AWARDS.map((a) => {
                  const selected = draft.awardType === a;
                  return (
                    <button
                      type="button"
                      key={a}
                      onClick={() => update("awardType", a)}
                      aria-pressed={selected}
                      className={`cs-chip ${selected ? AWARD_CHIP[a] : "cs-chip-outline"} h-11 px-4 text-[14px]`}
                    >
                      <AwardIcon size={18} strokeWidth={2} className={selected ? "" : AWARD_ICON_COLOR[a]} />
                      {t(`awards.${a}`)}
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
                className="cs-textarea"
                aria-invalid={errors.description ? "true" : undefined}
              />
            </Field>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <Field label={t("form.fields.photos")}>
              <label className="flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-bg-soft p-8 text-center transition-colors hover:border-primary hover:bg-primary-soft/40">
                <Camera size={32} strokeWidth={2} className="text-ink-3" aria-hidden />
                <span className="t-body-strong text-ink">{t("form.fields.uploadCta")}</span>
                <span className="t-caption">{t("form.fields.uploadHint")}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { const fl = e.target.files; void handleFiles(fl); }} />
              </label>
            </Field>
            {kept.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {kept.map((url, i) => (
                  <li key={url + i} className="relative aspect-square overflow-hidden rounded-image border border-line bg-surface-muted">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setKept((k) => k.filter((_, j) => j !== i))}
                      aria-label={t("form.actions.remove")}
                      title={t("form.actions.remove")}
                      className="cs-icon-btn cs-icon-btn-sm absolute right-1 top-1 bg-ink/80 text-white hover:bg-ink"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {previews.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {previews.map((p, i) => (
                  <li key={p.name + i} className="relative aspect-square overflow-hidden rounded-image border border-line bg-surface-muted">
                    <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label={t("form.actions.remove")}
                      title={t("form.actions.remove")}
                      className="cs-icon-btn cs-icon-btn-sm absolute right-1 top-1 bg-ink/80 text-white hover:bg-ink"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="cs-card-soft p-4 sm:p-5">
            <h3 className="t-h2 mb-2">{t("form.review.heading")}</h3>
            <ReviewRow label={t("form.review.labels.title")} value={draft.title} />
            <ReviewRow label={t("form.review.labels.date")} value={formatDate(draft.date, locale)} />
            <ReviewRow label={t("form.review.labels.location")} value={draft.location} />
            <ReviewRow label={t("form.review.labels.category")} value={t(`categories.${draft.category}`)} />
            <ReviewRow label={t("form.review.labels.award")} value={t(`awards.${draft.awardType}`)} />
            <ReviewRow label={t("form.review.labels.description")} value={draft.description} />
            <ReviewRow label={t("form.review.labels.photos")} value={t("form.review.photosAttached", { count: kept.length + draft.images.length })} last />
          </section>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-8 flex items-center justify-between gap-3 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
        <button
          type="button"
          onClick={() => (step === 1 ? onCancel?.() : setStep((s) => (s - 1) as Step))}
          className="cs-btn cs-btn-ghost"
        >
          {step === 1 ? t("form.actions.cancel") : t("form.actions.back")}
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={() => (validateStep(step) ? setStep((s) => (s + 1) as Step) : null)}
            className="cs-btn cs-btn-primary"
          >
            {t("form.actions.continue")}
          </button>
        ) : (
          <button type="button" disabled={submitting} onClick={handleSubmit} className="cs-btn cs-btn-primary">
            {submitting
              ? t("form.actions.saving")
              : isEditing
              ? t("form.actions.saveChanges")
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

function Header({ step, childName, isEditing }: { step: Step; childName?: string; isEditing?: boolean }) {
  const { t } = useTranslation();
  const labels = [t("form.steps.basics"), t("form.steps.story"), t("form.steps.photos"), t("form.steps.review")];
  return (
    <header>
      <p className="t-caption">
        {childName ? t("form.headerEyebrowWithName", { name: childName }) : t("form.headerEyebrow")}
      </p>
      <h2 className="t-h1 mt-1">
        {isEditing ? t("form.editHeading") : t("form.heading")}
      </h2>
      <div className="mt-4 flex items-center gap-3">
        <div className="cs-progress-dots" aria-hidden>
          {labels.map((label, i) => {
            const idx = (i + 1) as Step;
            return <span key={label} data-active={idx === step ? "true" : undefined} data-done={idx < step ? "true" : undefined} />;
          })}
        </div>
        <span className="t-caption text-ink-2">{labels[step - 1]}</span>
      </div>
    </header>
  );
}

function Field({ label, error, children, group = false }: { label: string; error?: string; children: ReactNode; /** true for button groups: renders a <div>, so the first button does not inherit the label text as its accessible name */ group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block">
      <span className="cs-field-label">{label}</span>
      {children}
      {error && <span className="mt-1 block t-caption text-error">{error}</span>}
    </Tag>
  );
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-2.5 ${last ? "" : "border-b border-line"}`}>
      <span className="t-caption">{label}</span>
      <span className="max-w-[60%] text-right t-body-strong text-ink">{value || "—"}</span>
    </div>
  );
}
