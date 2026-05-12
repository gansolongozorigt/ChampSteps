import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// AddAchievementForm v2 — initialDraft prop нэмэгдсэн (edit дэмжинэ)
// =============================================================================
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { compressImages } from "../utils/image";
import { awardStyles, categoryStyles, formatDate } from "../utils/format";
const CATEGORIES = ["Sports", "Arts", "Academic"];
const AWARDS = ["Gold", "Silver", "Bronze", "Participant"];
const EMPTY_DRAFT = {
    title: "",
    date: new Date().toISOString().slice(0, 10),
    location: "",
    category: "Sports",
    description: "",
    awardType: "Gold",
    images: [],
};
export default function AddAchievementForm({ childId, childName, initialDraft, onSubmit, onCancel, }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.resolvedLanguage ?? i18n.language;
    const isEditing = !!initialDraft;
    const [step, setStep] = useState(1);
    const [draft, setDraft] = useState({
        ...EMPTY_DRAFT,
        ...initialDraft,
        images: [],
    });
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const previews = useMemo(() => draft.images.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })), [draft.images]);
    function update(key, value) {
        setDraft((d) => ({ ...d, [key]: value }));
        setErrors((e) => ({ ...e, [key]: undefined }));
    }
    function validateStep(s) {
        const next = {};
        if (s === 1) {
            if (!draft.title.trim())
                next.title = t("form.validation.required");
            if (!draft.date)
                next.date = t("form.validation.required");
            if (!draft.location.trim())
                next.location = t("form.validation.required");
        }
        if (s === 2) {
            if (!draft.description.trim())
                next.description = t("form.validation.descriptionTooShort");
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    }
    async function handleFiles(files) {
        if (!files || files.length === 0)
            return;
        const incoming = Array.from(files).slice(0, 8 - draft.images.length);
        const compressed = await compressImages(incoming, { maxDimension: 1600, quality: 0.8 });
        update("images", [...draft.images, ...compressed]);
    }
    function removeImage(index) {
        update("images", draft.images.filter((_, i) => i !== index));
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
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs("div", { className: "mx-auto w-full max-w-2xl rounded-2xl border border-stone-200 bg-stone-50/80 p-6 shadow-sm", children: [_jsx(Header, { step: step, childName: childName, isEditing: isEditing }), _jsxs("div", { className: "mt-6 space-y-5", children: [step === 1 && (_jsxs("section", { className: "space-y-4", children: [_jsx(Field, { label: t("form.fields.title"), error: errors.title, children: _jsx("input", { value: draft.title, onChange: (e) => update("title", e.target.value), placeholder: t("form.fields.titlePlaceholder"), className: inputCls }) }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Field, { label: t("form.fields.date"), error: errors.date, children: _jsx("input", { type: "date", value: draft.date, onChange: (e) => update("date", e.target.value), className: inputCls }) }), _jsx(Field, { label: t("form.fields.location"), error: errors.location, children: _jsx("input", { value: draft.location, onChange: (e) => update("location", e.target.value), placeholder: t("form.fields.locationPlaceholder"), className: inputCls }) })] }), _jsx(Field, { label: t("form.fields.category"), children: _jsx("div", { className: "flex flex-wrap gap-2", children: CATEGORIES.map((c) => {
                                        const selected = draft.category === c;
                                        return (_jsx("button", { type: "button", onClick: () => update("category", c), className: `rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition ${selected ? `${categoryStyles[c].chip} ring-2` : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-100"}`, children: t(`categories.${c}`) }, c));
                                    }) }) })] })), step === 2 && (_jsxs("section", { className: "space-y-4", children: [_jsx(Field, { label: t("form.fields.award"), children: _jsx("div", { className: "grid grid-cols-2 gap-2 sm:grid-cols-4", children: AWARDS.map((a) => {
                                        const selected = draft.awardType === a;
                                        const s = awardStyles[a];
                                        return (_jsxs("button", { type: "button", onClick: () => update("awardType", a), className: `flex flex-col items-center gap-1 rounded-xl border bg-white p-3 text-sm transition ${selected ? `border-transparent ring-2 ${s.ring} ${s.bg}` : "border-stone-200 hover:bg-stone-50"}`, children: [_jsx("span", { className: "text-2xl", "aria-hidden": true, children: s.emoji }), _jsx("span", { className: `font-medium ${selected ? s.text : "text-stone-700"}`, children: t(`awards.${a}`) })] }, a));
                                    }) }) }), _jsx(Field, { label: t("form.fields.description"), error: errors.description, children: _jsx("textarea", { value: draft.description, onChange: (e) => update("description", e.target.value), rows: 4, placeholder: t("form.fields.descriptionPlaceholder"), className: `${inputCls} resize-y` }) })] })), step === 3 && (_jsxs("section", { className: "space-y-4", children: [_jsx(Field, { label: t("form.fields.photos"), children: _jsxs("label", { className: "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-white p-8 text-center text-stone-500 hover:border-stone-400", children: [_jsx("span", { className: "text-3xl", "aria-hidden": true, children: "\uD83D\uDCF8" }), _jsx("span", { className: "text-sm font-medium", children: t("form.fields.uploadCta") }), _jsx("span", { className: "text-xs text-stone-400", children: t("form.fields.uploadHint") }), _jsx("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onChange: (e) => handleFiles(e.target.files) })] }) }), previews.length > 0 && (_jsx("ul", { className: "grid grid-cols-3 gap-3 sm:grid-cols-4", children: previews.map((p, i) => (_jsxs("li", { className: "group relative aspect-square overflow-hidden rounded-lg border border-stone-200", children: [_jsx("img", { src: p.url, alt: p.name, className: "h-full w-full object-cover" }), _jsx("button", { type: "button", onClick: () => removeImage(i), className: "absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100", children: t("form.actions.remove") })] }, p.name + i))) }))] })), step === 4 && (_jsxs("section", { className: "space-y-3", children: [_jsx("h3", { className: "font-serif text-lg text-stone-800", children: t("form.review.heading") }), _jsx(ReviewRow, { label: t("form.review.labels.title"), value: draft.title }), _jsx(ReviewRow, { label: t("form.review.labels.date"), value: formatDate(draft.date, locale) }), _jsx(ReviewRow, { label: t("form.review.labels.location"), value: draft.location }), _jsx(ReviewRow, { label: t("form.review.labels.category"), value: t(`categories.${draft.category}`) }), _jsx(ReviewRow, { label: t("form.review.labels.award"), value: `${awardStyles[draft.awardType].emoji} ${t(`awards.${draft.awardType}`)}` }), _jsx(ReviewRow, { label: t("form.review.labels.description"), value: draft.description }), _jsx(ReviewRow, { label: t("form.review.labels.photos"), value: t("form.review.photosAttached", { count: draft.images.length }) })] }))] }), _jsxs("div", { className: "mt-8 flex items-center justify-between gap-3", children: [_jsx("button", { type: "button", onClick: () => (step === 1 ? onCancel?.() : setStep((s) => (s - 1))), className: "rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100", children: step === 1 ? t("form.actions.cancel") : t("form.actions.back") }), step < 4 ? (_jsx("button", { type: "button", onClick: () => (validateStep(step) ? setStep((s) => (s + 1)) : null), className: "rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-stone-50 hover:bg-stone-800", children: t("form.actions.continue") })) : (_jsx("button", { type: "button", disabled: submitting, onClick: handleSubmit, className: "rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60", children: submitting
                            ? t("form.actions.saving")
                            : isEditing
                                ? "Өөрчлөлт хадгалах"
                                : childName
                                    ? t("form.actions.saveForChild", { name: childName })
                                    : t("form.actions.save") }))] }), _jsx("input", { type: "hidden", name: "childId", value: childId, readOnly: true })] }));
}
// -----------------------------------------------------------------------------
const inputCls = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200";
function Header({ step, childName, isEditing }) {
    const { t } = useTranslation();
    const labels = [t("form.steps.basics"), t("form.steps.story"), t("form.steps.photos"), t("form.steps.review")];
    return (_jsxs("header", { children: [_jsx("p", { className: "text-xs uppercase tracking-widest text-stone-500", children: childName ? t("form.headerEyebrowWithName", { name: childName }) : t("form.headerEyebrow") }), _jsx("h2", { className: "mt-1 font-serif text-2xl text-stone-900", children: isEditing ? "Бичлэг засах" : t("form.heading") }), _jsx("ol", { className: "mt-5 flex items-center gap-2", children: labels.map((label, i) => {
                    const idx = (i + 1);
                    const active = idx === step;
                    const done = idx < step;
                    return (_jsxs("li", { className: "flex flex-1 items-center gap-2", children: [_jsx("span", { className: `flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${done ? "bg-emerald-600 text-white" : active ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-500"}`, children: done ? "✓" : idx }), _jsx("span", { className: `hidden text-xs sm:inline ${active ? "text-stone-800" : "text-stone-500"}`, children: label }), i < labels.length - 1 && _jsx("span", { className: "h-px flex-1 bg-stone-200" })] }, label));
                }) })] }));
}
function Field({ label, error, children }) {
    return (_jsxs("label", { className: "block", children: [_jsx("span", { className: "mb-1 block text-sm font-medium text-stone-700", children: label }), children, error && _jsx("span", { className: "mt-1 block text-xs text-rose-600", children: error })] }));
}
function ReviewRow({ label, value }) {
    return (_jsxs("div", { className: "flex justify-between gap-4 border-b border-dashed border-stone-200 py-2 text-sm", children: [_jsx("span", { className: "text-stone-500", children: label }), _jsx("span", { className: "max-w-[60%] text-right font-medium text-stone-800", children: value || "—" })] }));
}
