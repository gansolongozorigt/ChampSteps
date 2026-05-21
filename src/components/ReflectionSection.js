import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// ReflectionSection — Нууц сэтгэлзүйн тэмдэглэл
// Зөвхөн эцэг эх харна. Багш хандах эрхгүй.
// =============================================================================
import { useState } from "react";
import { useTranslation } from "react-i18next";
const MOOD_VALUES = [1, 2, 3, 4, 5];
const MOOD_EMOJIS = {
    1: "😞", 2: "😔", 3: "😐", 4: "😊", 5: "😄",
};
export default function ReflectionSection({ reflections, onAdd, onDelete, }) {
    const { t, i18n } = useTranslation();
    const [showForm, setShowForm] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [mood, setMood] = useState(3);
    const [content, setContent] = useState("");
    const [parentNote, setParentNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    async function handleAdd() {
        if (!content.trim())
            return;
        setSaving(true);
        try {
            await onAdd({ date, mood, content: content.trim(), parentNote: parentNote.trim() || undefined });
            setContent("");
            setParentNote("");
            setMood(3);
            setDate(new Date().toISOString().slice(0, 10));
            setShowForm(false);
        }
        finally {
            setSaving(false);
        }
    }
    const avgMood = reflections.length
        ? (reflections.reduce((s, r) => s + r.mood, 0) / reflections.length).toFixed(1)
        : null;
    const locale = i18n.language === "mn" ? "mn-MN" : "en-US";
    return (_jsxs("div", { className: "mt-8 mb-10", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h2", { className: "font-serif text-xl text-stone-900", children: t("reflection.heading") }), _jsxs("span", { className: "rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 uppercase tracking-wide", children: ["\uD83D\uDD12 ", t("reflection.private")] })] }), avgMood && (_jsx("p", { className: "text-xs text-stone-500 mt-0.5", children: t("reflection.avgMood", { avg: avgMood, count: reflections.length }) }))] }), _jsx("button", { type: "button", onClick: () => setShowForm(!showForm), className: "rounded-full bg-purple-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-800", children: t("reflection.addButton") })] }), showForm && (_jsxs("div", { className: "mb-4 rounded-2xl border border-purple-100 bg-purple-50/50 p-4 shadow-sm", children: [_jsxs("div", { className: "flex flex-col md:flex-row gap-4 mb-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "block text-xs font-medium text-stone-600 mb-1", children: t("reflection.fields.date") }), _jsx("input", { type: "date", value: date, onChange: (e) => setDate(e.target.value), className: "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-purple-200" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-stone-600 mb-1", children: t("reflection.fields.mood") }), _jsx("div", { className: "flex gap-1.5", children: MOOD_VALUES.map((v) => (_jsx("button", { type: "button", onClick: () => setMood(v), title: t(`reflection.moods.${v}`), className: `flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${mood === v
                                                ? "bg-purple-700 ring-2 ring-purple-300 scale-110"
                                                : "bg-white border border-stone-200 hover:bg-purple-50"}`, children: MOOD_EMOJIS[v] }, v))) })] })] }), _jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "block text-xs font-medium text-stone-600 mb-1", children: t("reflection.fields.childNote") }), _jsx("textarea", { value: content, onChange: (e) => setContent(e.target.value), rows: 3, placeholder: t("reflection.fields.childNotePlaceholder"), className: "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200" })] }), _jsxs("div", { className: "mb-3", children: [_jsxs("label", { className: "block text-xs font-medium text-stone-600 mb-1", children: [t("reflection.fields.parentNote"), " ", _jsx("span", { className: "text-stone-400", children: t("reflection.fields.parentNoteOptional") })] }), _jsx("textarea", { value: parentNote, onChange: (e) => setParentNote(e.target.value), rows: 2, placeholder: t("reflection.fields.parentNotePlaceholder"), className: "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200" })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setShowForm(false), className: "rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100", children: t("reflection.actions.cancel") }), _jsx("button", { type: "button", onClick: handleAdd, disabled: saving || !content.trim(), className: "rounded-lg bg-purple-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50", children: saving ? t("reflection.actions.saving") : t("reflection.actions.save") })] })] })), reflections.length === 0 ? (_jsxs("div", { className: "rounded-2xl border border-dashed border-purple-200 bg-purple-50/30 p-8 text-center", children: [_jsx("p", { className: "text-3xl mb-2", children: "\uD83D\uDC9C" }), _jsx("p", { className: "text-sm font-medium text-stone-700", children: t("reflection.empty.title") }), _jsx("p", { className: "text-xs text-stone-500 mt-1", children: t("reflection.empty.subtitle") })] })) : (_jsx("ul", { className: "space-y-3", children: reflections.map((r) => {
                    const moodLabel = t(`reflection.moods.${r.mood}`);
                    const isExpanded = expandedId === r.id;
                    return (_jsx("li", { className: "rounded-2xl border border-purple-100 bg-white shadow-sm overflow-hidden", children: _jsx("div", { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-3 flex-1 min-w-0", children: [_jsx("div", { className: "flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-purple-50 text-xl shrink-0", children: MOOD_EMOJIS[r.mood] }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "text-xs text-stone-500", children: [new Date(r.date).toLocaleDateString(locale, {
                                                                year: "numeric", month: "long", day: "numeric"
                                                            }), " \u00B7 ", moodLabel] }), _jsx("p", { className: `text-sm text-stone-800 mt-0.5 leading-relaxed ${!isExpanded ? "line-clamp-2" : ""}`, children: r.content }), r.content.length > 100 && (_jsx("button", { type: "button", onClick: () => setExpandedId(isExpanded ? null : r.id), className: "text-xs text-purple-600 mt-1 hover:underline", children: isExpanded ? t("reflection.actions.collapse") : t("reflection.actions.expand") })), isExpanded && r.parentNote && (_jsxs("div", { className: "mt-2 rounded-lg bg-stone-50 px-3 py-2", children: [_jsx("p", { className: "text-xs text-stone-500 font-medium mb-0.5", children: t("reflection.parentNoteLabel") }), _jsx("p", { className: "text-xs text-stone-700", children: r.parentNote })] }))] })] }), _jsx("div", { className: "flex items-center gap-1 shrink-0", children: deleteId === r.id ? (_jsxs("div", { className: "flex gap-1", children: [_jsx("button", { type: "button", onClick: () => { onDelete(r.id); setDeleteId(null); }, className: "rounded-lg bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700", children: t("reflection.actions.delete") }), _jsx("button", { type: "button", onClick: () => setDeleteId(null), className: "rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600", children: t("reflection.actions.cancelDelete") })] })) : (_jsx("button", { type: "button", onClick: () => setDeleteId(r.id), className: "rounded-lg p-1.5 text-stone-300 hover:bg-rose-50 hover:text-rose-500", children: "\uD83D\uDDD1\uFE0F" })) })] }) }) }, r.id));
                }) }))] }));
}
