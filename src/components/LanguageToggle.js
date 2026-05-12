import { jsx as _jsx } from "react/jsx-runtime";
// =============================================================================
// LanguageToggle — Compact MN / EN pill switcher.
// Persists selection via i18next-browser-languagedetector (localStorage).
// =============================================================================
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS } from "../i18n";
const LABELS = {
    mn: "MN",
    en: "EN",
};
export default function LanguageToggle() {
    const { i18n, t } = useTranslation();
    const current = (SUPPORTED_LANGS.includes(i18n.resolvedLanguage)
        ? i18n.resolvedLanguage
        : "mn");
    return (_jsx("div", { role: "group", "aria-label": t("app.language"), className: "inline-flex rounded-full border border-stone-200 bg-white p-0.5 shadow-sm", children: SUPPORTED_LANGS.map((lng) => {
            const active = current === lng;
            return (_jsx("button", { type: "button", onClick: () => i18n.changeLanguage(lng), "aria-pressed": active, className: `rounded-full px-2.5 py-1 text-xs font-semibold tracking-wider transition ${active
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:text-stone-800"}`, children: LABELS[lng] }, lng));
        }) }));
}
