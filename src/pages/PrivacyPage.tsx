// =============================================================================
// PrivacyPage — public /privacy (no sign-in): the store listing links here.
// Same document style as the Terms page (docs/BRAND.md "баримтын аяс"). mn / en / ru.
// =============================================================================

import { useTranslation } from "react-i18next";
import Logo from "../components/Logo";

const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const;

export default function PrivacyPage() {
  const { t, i18n } = useTranslation();
  const langs = ["mn", "en", "ru"] as const;
  return (
    <div className="min-h-screen supports-[height:100dvh]:min-h-dvh bg-bg font-sans text-ink">
      <header className="sticky top-0 z-10 bg-surface border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-3">
          <a href="/" aria-label="ChampStep"><Logo size={22} /></a>
          <div className="cs-segment" role="group" aria-label="Language">
            {langs.map((l) => (
              <button key={l} type="button" onClick={() => void i18n.changeLanguage(l)} aria-pressed={i18n.language?.startsWith(l)} className={`cs-segment-item ${i18n.language?.startsWith(l) ? "is-active" : ""}`}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8" data-testid="privacy-page">
        <p className="t-label">{t("privacy.company")}</p>
        <h1 className="t-h1 mt-1">{t("privacy.title")}</h1>
        <p className="t-caption mt-1">{t("privacy.updated")}</p>
        <div className="cs-card p-5 mt-5">
          <p className="t-body text-ink-2 mb-5">{t("privacy.intro")}</p>
          {SECTIONS.map((s) => (
            <section key={s} className="mb-5">
              <h2 className="t-h2 mb-1.5">{t(`privacy.${s}Title`)}</h2>
              <p className="t-body text-ink-2">{t(`privacy.${s}`)}</p>
            </section>
          ))}
        </div>
        <p className="t-caption mt-6 flex flex-wrap gap-x-4 gap-y-1">
          <a href="/" className="text-primary font-bold">{t("privacy.backToApp")}</a>
          <a href="/?page=terms" className="text-primary font-bold">{t("privacy.linkTerms")}</a>
          <span>info@champstep.mn</span>
        </p>
      </main>
    </div>
  );
}
