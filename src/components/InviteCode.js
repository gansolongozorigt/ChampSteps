import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// InviteCode — Багш шавиа нэмэх систем
// TeacherInvitePanel: багш код үүсгэнэ
// ParentLinkPanel: эцэг эх код оруулна
// =============================================================================
import { useState } from "react";
import { useTranslation } from "react-i18next";
export function TeacherInvitePanel({ teacherId, teacherName, onCreateCode }) {
    const { t } = useTranslation();
    const [code, setCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    async function handleCreate() {
        setLoading(true);
        try {
            const newCode = await onCreateCode(teacherId, teacherName);
            setCode(newCode);
        }
        catch (e) {
            console.error("invite code create failed:", e);
        }
        finally {
            setLoading(false);
        }
    }
    function handleCopy() {
        if (!code)
            return;
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    return (_jsxs("div", { className: "rounded-2xl border border-blue-100 bg-blue-50/50 p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("span", { className: "text-xl", children: "\uD83C\uDFEB" }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-stone-900 text-sm", children: t("invite.teacher.heading") }), _jsx("p", { className: "text-xs text-stone-500", children: t("invite.teacher.subtitle") })] })] }), !code ? (_jsx("button", { type: "button", onClick: handleCreate, disabled: loading, className: "w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50", children: loading ? t("invite.teacher.creating") : t("invite.teacher.createButton") })) : (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "rounded-xl bg-white border border-blue-200 p-4 text-center", children: [_jsx("p", { className: "text-xs text-stone-500 mb-1", children: t("invite.teacher.codeLabel") }), _jsx("p", { className: "font-mono text-3xl font-bold tracking-widest text-blue-700", children: code }), _jsx("p", { className: "text-xs text-stone-400 mt-1", children: t("invite.teacher.codeExpiry") })] }), _jsx("button", { type: "button", onClick: handleCopy, className: `w-full rounded-xl py-2.5 text-sm font-medium transition ${copied
                            ? "bg-emerald-600 text-white"
                            : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"}`, children: copied ? t("invite.teacher.copied") : t("invite.teacher.copyButton") }), _jsx("button", { type: "button", onClick: () => setCode(null), className: "w-full text-xs text-stone-400 hover:text-stone-600", children: t("invite.teacher.newCode") })] }))] }));
}
export function ParentLinkPanel({ childId, childName, onUseCode }) {
    const { t } = useTranslation();
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);
    async function handleLink() {
        if (code.trim().length !== 6) {
            setError(t("invite.parent.errors.length"));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await onUseCode(code.trim().toUpperCase(), childId);
            setSuccess(t("invite.parent.success"));
            setCode("");
        }
        catch (e) {
            const msg = e.message;
            if (msg.includes("аль хэдийн") || msg.includes("already"))
                setError(t("invite.parent.errors.used"));
            else if (msg.includes("дууссан") || msg.includes("expired"))
                setError(t("invite.parent.errors.expired"));
            else if (msg.includes("олдсонгүй") || msg.includes("not found"))
                setError(t("invite.parent.errors.notFound"));
            else
                setError(t("invite.parent.errors.invalid"));
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("div", { className: "rounded-2xl border border-amber-100 bg-amber-50/50 p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("span", { className: "text-xl", children: "\uD83D\uDD17" }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-stone-900 text-sm", children: t("invite.parent.heading") }), _jsx("p", { className: "text-xs text-stone-500", children: t("invite.parent.subtitle", { name: childName }) })] })] }), success ? (_jsxs("div", { className: "rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center", children: [_jsx("p", { className: "text-2xl mb-1", children: "\u2705" }), _jsx("p", { className: "text-sm font-medium text-emerald-700", children: success }), _jsx("button", { type: "button", onClick: () => setSuccess(null), className: "mt-2 text-xs text-stone-400 hover:text-stone-600", children: t("invite.parent.reconnect") })] })) : (_jsxs("div", { className: "space-y-2", children: [_jsx("input", { value: code, onChange: (e) => {
                            setCode(e.target.value.toUpperCase().slice(0, 6));
                            setError(null);
                        }, placeholder: t("invite.parent.placeholder"), maxLength: 6, className: "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-center font-mono text-xl font-bold tracking-widest text-stone-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-300" }), error && _jsx("p", { className: "text-xs text-rose-600 text-center", children: error }), _jsx("button", { type: "button", onClick: handleLink, disabled: loading || code.length !== 6, className: "w-full rounded-xl bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50", children: loading ? t("invite.parent.connecting") : t("invite.parent.connectButton") })] }))] }));
}
