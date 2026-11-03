// =============================================================================
// LegalSheet — About / Terms (incl. privacy) as a full-height sheet, for screens
// without the dashboard's profile menu: the login page footer (store requirement)
// and the no-child / no-student screens. Brand: docs/BRAND.md (modal sheet, lucide).
// =============================================================================

import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import AboutPage from "./AboutPage";
import TermsPage, { type TermsTab } from "./TermsPage";

export type LegalView = { page: "about" } | { page: "terms"; tab?: TermsTab };

export default function LegalSheet({ view, onClose }: { view: LegalView; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-2xl" role="dialog" aria-modal="true" aria-label={t(view.page === "about" ? "nav.about" : "nav.terms")} data-testid="legal-sheet">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6 relative">
          <button type="button" onClick={onClose} aria-label={t("goals.detail.close")} className="cs-icon-btn cs-icon-btn-sm text-ink-3 absolute right-3 top-3 z-10"><X size={18} /></button>
          {view.page === "about" ? <AboutPage /> : <TermsPage initialTab={view.tab} />}
        </div>
      </div>
    </div>
  );
}

/** "Бидний тухай · Нөхцөл" (or "Нөхцөл · Нууцлал") text links. */
export function LegalLinks({ onOpen, privacy = false, className = "" }: { onOpen: (v: LegalView) => void; privacy?: boolean; className?: string }) {
  const { t } = useTranslation();
  const link = "font-bold text-ink-2 hover:text-primary underline-offset-2 hover:underline min-h-[32px]";
  return (
    <p className={`t-caption flex items-center justify-center gap-2 ${className}`} data-testid="legal-links">
      {privacy ? (
        <>
          <button type="button" className={link} onClick={() => onOpen({ page: "terms", tab: "terms" })}>{t("terms.tabTerms")}</button>
          <span aria-hidden>·</span>
          <button type="button" className={link} onClick={() => onOpen({ page: "terms", tab: "privacy" })}>{t("terms.tabPrivacy")}</button>
        </>
      ) : (
        <>
          <button type="button" className={link} onClick={() => onOpen({ page: "about" })}>{t("nav.about")}</button>
          <span aria-hidden>·</span>
          <button type="button" className={link} onClick={() => onOpen({ page: "terms" })}>{t("nav.terms")}</button>
        </>
      )}
    </p>
  );
}
