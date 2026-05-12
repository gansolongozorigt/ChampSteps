import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// ChildProfileEditor — Modal for editing the child's name, bio, birth date,
// and avatar photo. Avatar is compressed client-side before it would be
// uploaded to Firebase Storage.
// =============================================================================
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { compressImage } from "../utils/image";
export default function ChildProfileEditor({ child, onClose, onSave }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(child);
    const [avatarFile, setAvatarFile] = useState(undefined);
    const [avatarPreview, setAvatarPreview] = useState(child.avatarUrl);
    const [saving, setSaving] = useState(false);
    // Revoke any object URLs we created when the component unmounts.
    useEffect(() => {
        return () => {
            if (avatarPreview && avatarPreview.startsWith("blob:")) {
                URL.revokeObjectURL(avatarPreview);
            }
        };
    }, [avatarPreview]);
    const initials = useMemo(() => draft.name.trim().slice(0, 1).toUpperCase() || "?", [draft.name]);
    async function handleAvatarChange(file) {
        if (!file)
            return;
        const compressed = await compressImage(file, { maxDimension: 512, quality: 0.85 });
        setAvatarFile(compressed);
        const url = URL.createObjectURL(compressed);
        setAvatarPreview(url);
        setDraft((d) => ({ ...d, avatarUrl: url }));
    }
    function handleRemoveAvatar() {
        setAvatarFile(undefined);
        setAvatarPreview(undefined);
        setDraft((d) => ({ ...d, avatarUrl: undefined }));
    }
    async function handleSave() {
        setSaving(true);
        try {
            await onSave(draft, avatarFile);
            onClose();
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-2 backdrop-blur-sm sm:items-center sm:p-4", onClick: onClose, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), className: "w-full max-w-lg rounded-2xl border border-stone-200 bg-stone-50/90 p-6 shadow-xl", children: [_jsxs("header", { children: [_jsx("p", { className: "text-xs uppercase tracking-widest text-stone-500", children: t("app.journal") }), _jsx("h2", { className: "mt-1 font-serif text-2xl text-stone-900", children: t("profile.heading") })] }), _jsxs("div", { className: "mt-6 flex items-center gap-4", children: [_jsx("div", { className: "h-20 w-20 overflow-hidden rounded-full bg-stone-200 ring-2 ring-white shadow", children: avatarPreview ? (_jsx("img", { src: avatarPreview, alt: draft.name, className: "h-full w-full object-cover" })) : (_jsx("div", { className: "flex h-full w-full items-center justify-center text-2xl font-semibold text-stone-500", children: initials })) }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("label", { className: "cursor-pointer rounded-lg bg-stone-900 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-stone-800", children: [t("profile.fields.avatar"), _jsx("input", { type: "file", accept: "image/*", hidden: true, onChange: (e) => handleAvatarChange(e.target.files?.[0]) })] }), avatarPreview && (_jsx("button", { type: "button", onClick: handleRemoveAvatar, className: "text-xs text-stone-500 hover:text-rose-600", children: t("profile.actions.removeAvatar") }))] })] }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Field, { label: t("profile.fields.name"), children: _jsx("input", { value: draft.name, onChange: (e) => setDraft((d) => ({ ...d, name: e.target.value })), className: inputCls }) }), _jsx(Field, { label: t("profile.fields.birthDate"), children: _jsx("input", { type: "date", value: draft.birthDate, onChange: (e) => setDraft((d) => ({ ...d, birthDate: e.target.value })), className: inputCls }) }), _jsx(Field, { label: t("profile.fields.bio"), children: _jsx("textarea", { value: draft.bio ?? "", onChange: (e) => setDraft((d) => ({ ...d, bio: e.target.value })), rows: 3, placeholder: t("profile.fields.bioPlaceholder"), className: `${inputCls} resize-y` }) })] }), _jsxs("div", { className: "mt-8 flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100", children: t("profile.actions.cancel") }), _jsx("button", { type: "button", disabled: saving || !draft.name.trim(), onClick: handleSave, className: "rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60", children: saving ? t("form.actions.saving") : t("profile.actions.save") })] })] }) }));
}
const inputCls = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200";
function Field({ label, children }) {
    return (_jsxs("label", { className: "block", children: [_jsx("span", { className: "mb-1 block text-sm font-medium text-stone-700", children: label }), children] }));
}
