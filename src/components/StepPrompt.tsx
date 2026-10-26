// =============================================================================
// StepPrompt — small skippable question sheet used by the first-steps flow
// ("Өнөөдрийн бэлтгэлээ тэмдэглэх үү?", "Орой 20:00-д сануулах уу?").
// Brand: docs/BRAND.md (modal sheet, lucide, no emoji).
// =============================================================================

import { Loader2, type LucideIcon } from "lucide-react";

export interface StepPromptProps {
  Icon: LucideIcon;
  title: string;
  hint: string;
  yes: string;
  no: string;
  onYes: () => void;
  onNo: () => void;
  busy?: boolean;
  /** Shown under the text (e.g. "notifications are blocked"); `action` adds a link-style button. */
  note?: { kind: "info" | "error"; text: string; action?: { label: string; onClick: () => void } } | null;
  testId?: string;
}

export default function StepPrompt({ Icon, title, hint, yes, no, onYes, onNo, busy = false, note, testId }: StepPromptProps) {
  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={busy ? undefined : onNo}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-sm" role="dialog" aria-modal="true" aria-labelledby={`${testId ?? "step-prompt"}-title`} data-testid={testId}>
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          <span className="w-11 h-11 rounded-full bg-primary-soft text-primary-soft-ink flex items-center justify-center"><Icon size={22} strokeWidth={2.2} aria-hidden /></span>
          <h2 id={`${testId ?? "step-prompt"}-title`} className="t-h1 mt-3">{title}</h2>
          <p className="t-body text-ink-2 mt-1">{hint}</p>
          {note && (
            <div role="status" className={`mt-3 rounded-input px-3 py-2 t-caption ${note.kind === "error" ? "bg-error-soft text-error" : "bg-bg-soft text-ink-2"}`}>
              <p>{note.text}</p>
              {note.action && (
                <button type="button" onClick={note.action.onClick} className="mt-1 font-bold text-primary underline-offset-2 hover:underline">{note.action.label}</button>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={onNo} disabled={busy} className="cs-btn cs-btn-ghost" data-testid={testId ? `${testId}-no` : undefined}>{no}</button>
            <button type="button" onClick={onYes} disabled={busy} className="cs-btn cs-btn-primary" data-testid={testId ? `${testId}-yes` : undefined}>
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {yes}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
