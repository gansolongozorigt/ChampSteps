// =============================================================================
// i18next configuration — Mongolian (default) + English.
// Language is detected from: localStorage → <html lang> → navigator.language.
// Components consume strings via: const { t } = useTranslation();
// =============================================================================
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import mn from "./locales/mn.json";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
export const SUPPORTED_LANGS = ["mn", "en", "ru"];
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
    resources: {
        mn: { translation: mn },
        en: { translation: en },
        ru: { translation: ru },
    },
    fallbackLng: "mn",
    supportedLngs: SUPPORTED_LANGS,
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
        order: ["localStorage", "htmlTag", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "champstep.lang",
    },
});
export default i18n;
