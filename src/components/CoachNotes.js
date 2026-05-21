import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createCoachNote, deleteCoachNote, subscribeCoachNotes, getUserDoc, } from "../lib/firebase";
export default function CoachNotes({ childId, childName, teacherId, teacherName, isTeacher, teacherIds = [], }) {
    const { t, i18n } = useTranslation();
    const [notes, setNotes] = useState([]);
    const [text, setText] = useState("");
    const [saving, setSaving] = useState(false);
    const [connectedTeachers, setConnectedTeachers] = useState([]);
    // Firestore-оос бодит цагт уншина
    useEffect(() => {
        const unsub = subscribeCoachNotes(childId, setNotes);
        return () => unsub();
    }, [childId]);
    // Хүүхдэд холбогдсон багшийн нэрийг татах
    useEffect(() => {
        if (isTeacher || teacherIds.length === 0)
            return;
        async function loadTeachers() {
            const results = [];
            for (const uid of teacherIds) {
                try {
                    const doc = await getUserDoc(uid);
                    if (doc)
                        results.push({ uid, name: doc.displayName ?? "Багш" });
                }
                catch {
                    // ignore
                }
            }
            setConnectedTeachers(results);
        }
        loadTeachers();
    }, [teacherIds, isTeacher]);
    async function handleAdd() {
        if (!text.trim())
            return;
        setSaving(true);
        try {
            await createCoachNote(childId, teacherId, teacherName, text.trim());
            setText("");
        }
        finally {
            setSaving(false);
        }
    }
    async function handleDelete(id) {
        await deleteCoachNote(id);
    }
    function formatDate(createdAt) {
        if (!createdAt)
            return "";
        const date = typeof createdAt === "string"
            ? new Date(createdAt)
            : createdAt.toDate?.() ?? new Date();
        const locale = i18n.language?.startsWith("en") ? "en-US" : "mn-MN";
        return date.toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }
    return (_jsxs("div", { className: "space-y-4", children: [isTeacher && (_jsxs("div", { className: "rounded-2xl border border-blue-100 bg-blue-50/50 p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("span", { className: "text-xl", children: "\u270F\uFE0F" }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-stone-900 text-sm", children: t("coach.writeNote", { name: childName }) }), _jsx("p", { className: "text-xs text-stone-500", children: t("coach.parentCanSee") })] })] }), _jsx("textarea", { value: text, onChange: (e) => setText(e.target.value), placeholder: t("coach.placeholder", { name: childName }), rows: 4, className: "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" }), _jsx("button", { onClick: handleAdd, disabled: saving || !text.trim(), className: "mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition", children: saving ? t("coach.saving") : t("coach.addButton") })] })), !isTeacher && connectedTeachers.length > 0 && (_jsxs("div", { className: "rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4", children: [_jsx("p", { className: "text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2", children: t("coach.connectedTeacher") }), _jsx("div", { className: "flex flex-wrap gap-2", children: connectedTeachers.map((tc) => (_jsxs("div", { className: "flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-1.5", children: [_jsx("div", { className: "w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold", children: tc.name.slice(0, 1).toUpperCase() }), _jsx("span", { className: "text-sm font-medium text-stone-800", children: tc.name })] }, tc.uid))) })] })), notes.length === 0 ? (_jsx("div", { className: "text-center py-10 text-stone-400 text-sm", children: isTeacher ? t("coach.empty") : t("coach.parentEmpty") })) : (_jsx("div", { className: "space-y-3", children: notes.map((n) => (_jsxs("div", { className: "rounded-2xl border border-stone-100 bg-white p-5 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold", children: n.teacherName?.slice(0, 1).toUpperCase() ?? "Б" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-stone-800", children: n.teacherName }), _jsx("p", { className: "text-xs text-stone-400", children: formatDate(n.createdAt) })] })] }), isTeacher && n.teacherId === teacherId && (_jsx("button", { onClick: () => handleDelete(n.id), className: "text-xs text-stone-400 hover:text-red-500 transition", children: t("coach.delete") }))] }), _jsx("p", { className: "text-sm text-stone-700 leading-relaxed whitespace-pre-wrap", children: n.content })] }, n.id))) }))] }));
}
