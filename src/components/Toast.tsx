// =============================================================================
// Toast — Tiny, self-dismissing notification. Replaces alert() everywhere.
// Usage: <Toast kind="success" message="Saved" onClose={...} />
// Brand: graphite (--ink) pill, white text; kind only changes the icon (BRAND.md).
// =============================================================================

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export interface ToastProps {
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after this many ms. 0 disables. Default 4000. */
  durationMs?: number;
  onClose: () => void;
}

const ICON_CLASS: Record<ToastKind, string> = {
  success: "bg-primary text-white",
  error: "bg-error text-white",
  info: "bg-stage-2 text-white",
};

export default function Toast({ kind, message, durationMs = 4000, onClose }: ToastProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (durationMs <= 0) return;
    const id = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs, onClose]);

  const Icon = kind === "success" ? Check : kind === "error" ? CircleAlert : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 sm:bottom-8"
    >
      <div className="cs-toast-in pointer-events-auto flex max-w-sm items-center gap-3 rounded-full bg-ink pl-2 pr-1 py-1.5 text-white shadow-float">
        <span aria-hidden className={`flex h-7 w-7 items-center justify-center rounded-full ${ICON_CLASS[kind]}`}>
          <Icon size={15} strokeWidth={2.5} />
        </span>
        <span className="text-[14px] font-bold leading-snug">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="cs-icon-btn cs-icon-btn-sm text-stage-muted hover:bg-stage-2 hover:text-white"
          aria-label={t("app.dismiss")}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
