import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { createCoachNote, deleteCoachNote, subscribeCoachNotes, } from "../lib/firebase";
export default function CoachNotes({ childId, childName, teacherId, teacherName, isTeacher, }) {
    const [notes, setNotes] = useState([]);
    const [text, setText] = useState("");
    const [saving, setSaving] = useState(false);
    // Firestore-оос бодит цагт уншина
    useEffect(() => {
        const unsub = subscribeCoachNotes(childId, setNotes);
        return () => unsub();
    }, [childId]);
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
    return (_jsxs("div", { className: "space-y-4", children: [isTeacher && (_jsxs("div", { className: "rounded-2xl border border-blue-100 bg-blue-50/50 p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("span", { className: "text-xl", children: "\u270F\uFE0F" }), _jsxs("div", { children: [_jsxs("h3", { className: "font-semibold text-stone-900 text-sm", children: [childName, "-\u0434 \u0437\u04E9\u0432\u043B\u04E9\u0433\u04E9\u04E9 \u0431\u0438\u0447\u0438\u0445"] }), _jsx("p", { className: "text-xs text-stone-500", children: "\u042D\u0446\u044D\u0433 \u044D\u0445 \u0445\u0430\u0440\u0430\u0445 \u0431\u043E\u043B\u043E\u043C\u0436\u0442\u043E\u0439" })] })] }), _jsx("textarea", { value: text, onChange: (e) => setText(e.target.value), placeholder: `${childName}-ийн бэлтгэл, дэвшлийн талаар зөвлөгөө бичнэ үү...`, rows: 4, className: "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" }), _jsx("button", { onClick: handleAdd, disabled: saving || !text.trim(), className: "mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition", children: saving ? "Хадгалж байна..." : "Зөвлөгөө нэмэх" })] })), notes.length === 0 ? (_jsx("div", { className: "text-center py-10 text-stone-400 text-sm", children: isTeacher
                    ? "Одоогоор зөвлөгөө байхгүй байна. Дээр бичнэ үү!"
                    : "Багш таньд одоогоор зөвлөгөө өгөөгүй байна." })) : (_jsx("div", { className: "space-y-3", children: notes.map((n) => (_jsxs("div", { className: "rounded-2xl border border-stone-100 bg-white p-5 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold", children: n.teacherName?.slice(0, 1).toUpperCase() ?? "Б" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-stone-800", children: n.teacherName }), _jsx("p", { className: "text-xs text-stone-400", children: n.createdAt
                                                        ? new Date(n.createdAt).toLocaleDateString("mn-MN", {
                                                            year: "numeric",
                                                            month: "long",
                                                            day: "numeric",
                                                        })
                                                        : "" })] })] }), isTeacher && n.teacherId === teacherId && (_jsx("button", { onClick: () => handleDelete(n.id), className: "text-xs text-stone-400 hover:text-red-500 transition", children: "\u0423\u0441\u0442\u0433\u0430\u0445" }))] }), _jsx("p", { className: "text-sm text-stone-700 leading-relaxed whitespace-pre-wrap", children: n.note })] }, n.id))) }))] }));
}
