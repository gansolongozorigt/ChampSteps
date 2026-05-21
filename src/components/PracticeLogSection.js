import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// PracticeLogSection — Өдөр бүрийн бэлтгэлийн тэмдэглэл
// =============================================================================
import { useState } from "react";
import { useTranslation } from "react-i18next";
export default function PracticeLogSection({ logs, onAdd, onDelete, }) {
    const { t, i18n } = useTranslation();
    const [showForm, setShowForm] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [duration, setDuration] = useState(60);
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    async function handleAdd() {
        if (!content.trim())
            return;
        setSaving(true);
        try {
            await onAdd({ date, duration, content: content.trim() });
            setContent("");
            setDate(new Date().toISOString().slice(0, 10));
            setDuration(60);
            setShowForm(false);
        }
        finally {
            setSaving(false);
        }
    }
    async function handleDelete(id) {
        await onDelete(id);
        setDeleteId(null);
    }
    const totalMinutes = logs.reduce((s, l) => s + l.duration, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainMins = totalMinutes % 60;
    const totalText = () => {
        if (totalHours > 0 && remainMins > 0)
            return t("practice.total", { hours: totalHours, mins: remainMins, count: logs.length });
        if (totalHours > 0)
            return t("practice.totalHours", { hours: totalHours, count: logs.length });
        return t("practice.totalMins", { mins: remainMins, count: logs.length });
    };
    const locale = i18n.language === "mn" ? "mn-MN" : "en-US";
    return (_jsxs("div", { className: "mt-10", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-serif text-xl text-stone-900", children: t("practice.heading") }), logs.length > 0 && (_jsx("p", { className: "text-xs text-stone-500 mt-0.5", children: totalText() }))] }), _jsx("button", { type: "button", onClick: () => setShowForm(!showForm), className: "rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-stone-800", children: t("practice.addButton") })] }), showForm && (_jsxs("div", { className: "mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "flex flex-col md:flex-row gap-4 mb-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "block text-xs font-medium text-stone-600 mb-1", children: t("practice.fields.date") }), _jsx("input", { type: "date", value: date, onChange: (e) => setDate(e.target.value), className: "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-stone-200" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-stone-600 mb-1", children: t("practice.fields.duration") }), _jsx("div", { className: "flex items-center gap-2", children: [30, 60, 90, 120].map((m) => (_jsx("button", { type: "button", onClick: () => setDuration(m), className: `rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${duration === m
                                                ? "bg-stone-900 text-white"
                                                : "border border-stone-200 text-stone-600 hover:bg-stone-50"}`, children: m < 60 ? `${m}m` : `${m / 60}h` }, m))) })] })] }), _jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "block text-xs font-medium text-stone-600 mb-1", children: t("practice.fields.notes") }), _jsx("textarea", { value: content, onChange: (e) => setContent(e.target.value), rows: 3, placeholder: t("practice.fields.notesPlaceholder"), className: "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-200" })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setShowForm(false), className: "rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100", children: t("practice.actions.cancel") }), _jsx("button", { type: "button", onClick: handleAdd, disabled: saving || !content.trim(), className: "rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50", children: saving ? t("practice.actions.saving") : t("practice.actions.save") })] })] })), logs.length === 0 ? (_jsxs("div", { className: "rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center", children: [_jsx("p", { className: "text-3xl mb-2", children: "\uD83C\uDFCB\uFE0F" }), _jsx("p", { className: "text-sm font-medium text-stone-700", children: t("practice.empty.title") }), _jsx("p", { className: "text-xs text-stone-500 mt-1", children: t("practice.empty.subtitle") })] })) : (_jsx("ul", { className: "space-y-3", children: logs.map((log) => (_jsx("li", { className: "rounded-2xl border border-stone-200 bg-white p-4 shadow-sm", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-stone-100 text-center", children: _jsx("span", { className: "text-xs font-bold text-stone-700 leading-none", children: log.duration >= 60 ? `${log.duration / 60}h` : `${log.duration}m` }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-stone-500", children: new Date(log.date).toLocaleDateString(locale, {
                                                    year: "numeric", month: "long", day: "numeric"
                                                }) }), _jsx("p", { className: "text-sm text-stone-800 mt-0.5 leading-relaxed", children: log.content })] })] }), _jsx("div", { className: "flex items-center gap-1 shrink-0", children: deleteId === log.id ? (_jsxs("div", { className: "flex gap-1", children: [_jsx("button", { type: "button", onClick: () => handleDelete(log.id), className: "rounded-lg bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700", children: t("practice.actions.confirmDelete") }), _jsx("button", { type: "button", onClick: () => setDeleteId(null), className: "rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600", children: t("practice.actions.cancelDelete") })] })) : (_jsx("button", { type: "button", onClick: () => setDeleteId(log.id), className: "rounded-lg p-1.5 text-stone-300 hover:bg-rose-50 hover:text-rose-500", children: "\uD83D\uDDD1\uFE0F" })) })] }) }, log.id))) }))] }));
}
