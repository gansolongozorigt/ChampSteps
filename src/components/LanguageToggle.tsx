// =============================================================================
// LanguageToggle — Compact MN / EN pill switcher.
// Persists selection via i18next-browser-languagedetector (localStorage).
// =============================================================================

import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS, type AppLang } from "../i18n";

const LABELS: Record<AppLang, string> = {
  mn: "MN",
  en: "EN",
  ru: "RU",
};

export default function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGS.includes(i18n.resolvedLanguage as AppLang)
    ? (i18n.resolvedLanguage as AppLang)
    : "mn");

  return (
    <div
      role="group"
      aria-label={t("app.language")}
      className="cs-segment"
    >
      {SUPPORTED_LANGS.map((lng) => {
        const active = current === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => i18n.changeLanguage(lng)}
            aria-pressed={active}
            className="cs-segment-item min-w-[44px] justify-center tracking-wider"
          >
            {LABELS[lng]}
          </button>
        );
      })}
    </div>
  );
}
