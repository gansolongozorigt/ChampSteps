// =============================================================================
// Toast — Tiny, self-dismissing notification. Replaces alert() everywhere.
// Usage: <Toast kind="success" message="Saved" onClose={...} />
// =============================================================================

import { useEffect } from "react";

export type ToastKind = "success" | "error" | "info";

export interface ToastProps {
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after this many ms. 0 disables. Default 4000. */
  durationMs?: number;
  onClose: () => void;
}

const STYLES: Record<ToastKind, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  info: "bg-stone-900 text-white",
};

const ICONS: Record<ToastKind, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

export default function Toast({ kind, message, durationMs = 4000, onClose }: ToastProps) {
  useEffect(() => {
    if (durationMs <= 0) return;
    const id = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-8"
    >
      <div
        className={`cs-toast-in pointer-events-auto flex max-w-sm items-center gap-3 rounded-full px-4 py-2.5 text-sm shadow-lg shadow-stone-900/20 ${STYLES[kind]}`}
      >
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs font-bold"
        >
          {ICONS[kind]}
        </span>
        <span className="font-medium">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 rounded-full px-2 text-sm text-white/80 hover:text-white"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
