// =============================================================================
// InstallBanner + InstallGuideModal — "add to home screen" nudge (src/lib/install.ts).
//   iOS:     banner "How?" opens the 3-step guide (Share → Add to Home Screen → Add).
//   Android: banner "Install" fires the captured beforeinstallprompt.
// Graphite strip like a toast (BRAND.md: graphite only for stage cards and toasts).
// =============================================================================

import type React from "react";
import { useTranslation } from "react-i18next";
import { Check, Share, Smartphone, SquarePlus, X } from "lucide-react";
import type { InstallKind } from "../lib/install";

interface BannerProps {
  kind: Exclude<InstallKind, "none">;
  /** Phone: px above the bottom edge (bottom nav + upgrade bar height). Desktop uses a fixed corner. */
  bottomOffset?: number;
  onHow: () => void;
  onInstall: () => void;
  onLater: () => void;
}

export function InstallBanner({ kind, bottomOffset = 72, onHow, onInstall, onLater }: BannerProps) {
  const { t } = useTranslation();
  return (
    <div
      role="region"
      aria-label={t("install.bannerTitle")}
      data-testid="install-banner"
      className="fixed inset-x-3 z-30 bottom-[calc(env(safe-area-inset-bottom)+var(--ib-bottom))] md:inset-x-auto md:right-6 md:w-96 md:bottom-6 print:hidden cs-item-in"
      style={{ "--ib-bottom": `${bottomOffset}px` } as React.CSSProperties}
    >
      <div className="bg-ink text-white rounded-card px-4 py-3 flex items-center gap-3 shadow-float">
        <Smartphone size={22} strokeWidth={2} className="shrink-0 text-primary-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-tight">{t("install.bannerTitle")}</p>
          <p className="text-[12px] text-stage-muted leading-snug mt-0.5">{t("install.bannerText")}</p>
        </div>
        <button
          type="button"
          onClick={kind === "ios" ? onHow : onInstall}
          className="cs-btn cs-btn-xs bg-primary text-white hover:bg-primary-hover shrink-0"
        >
          {kind === "ios" ? t("install.how") : t("install.install")}
        </button>
        <button type="button" onClick={onLater} aria-label={t("install.later")} className="cs-icon-btn cs-icon-btn-sm text-stage-muted hover:text-white shrink-0">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export function InstallGuideModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const steps = [
    { Icon: Share, text: t("install.step1") },
    { Icon: SquarePlus, text: t("install.step2") },
    { Icon: Check, text: t("install.step3") },
  ];
  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="install-title" data-testid="install-guide">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          <p className="t-label">iOS · Safari</p>
          <h2 id="install-title" className="t-h1 mt-1">{t("install.modalTitle")}</h2>
          <ol className="mt-5 space-y-4">
            {steps.map(({ Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary text-white text-[13px] font-extrabold flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
                <span className="w-11 h-11 rounded-input bg-surface-muted text-ink flex items-center justify-center shrink-0">
                  <Icon size={22} strokeWidth={2} aria-hidden />
                </span>
                <p className="t-body text-ink">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={onClose} className="cs-btn cs-btn-primary">{t("install.done")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
