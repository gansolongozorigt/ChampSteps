// =============================================================================
// DeleteChildModal — confirm the irreversible removal of one child.
// Shows what will go (counts from App state), offers "download the PDF first",
// and only enables Delete once the child's name is typed exactly.
// UI: brand tokens (docs/BRAND.md); error colour on the button only.
// =============================================================================

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, TriangleAlert } from "lucide-react";
import type { Child } from "../types";

export interface DeleteChildCounts {
  achievements: number;
  photos: number;
  practiceLogs: number;
  reflections: number;
}

interface Props {
  child: Child;
  counts: DeleteChildCounts;
  onCancel: () => void;
  /** Opens the PDF export (parent decides whether the tier allows it). */
  onPdf: () => void;
  /** Resolves when the child is gone; rejects with a message to show. */
  onConfirm: () => Promise<void>;
}

export default function DeleteChildModal({ child, counts, onCancel, onPdf, onConfirm }: Props) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = child.name.trim();
  const matches = typed.trim() === name && name.length > 0;

  async function confirm() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("danger.child.error"));
      setDeleting(false);
    }
  }

  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={deleting ? undefined : onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="delete-child-title">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-soft text-error" aria-hidden="true">
              <TriangleAlert size={20} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 id="delete-child-title" className="t-h1">{t("danger.child.title", { name })}</h2>
              <p className="t-body text-ink-2 mt-2">
                {t("danger.child.summary", { achievements: counts.achievements, photos: counts.photos, practice: counts.practiceLogs, reflections: counts.reflections })}
              </p>
            </div>
          </div>

          <button type="button" onClick={onPdf} disabled={deleting} className="mt-4 inline-flex min-h-[44px] items-center text-[14px] font-bold text-primary hover:underline underline-offset-2 disabled:opacity-40">
            {t("danger.child.pdfFirst")}
          </button>

          <label className="mt-5 block">
            <span className="cs-field-label">{t("danger.child.typeName", { name })}</span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void confirm(); }}
              disabled={deleting}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="cs-input"
              data-testid="delete-child-name"
            />
          </label>

          {error && (
            <p className="mt-3 rounded-input bg-error-soft px-3 py-2 text-[13px] font-semibold text-error" role="alert">{error}</p>
          )}

          <div className="mt-6 flex items-center justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={onCancel} disabled={deleting} className="cs-btn cs-btn-ghost">
              {t("danger.cancel")}
            </button>
            <button type="button" onClick={() => void confirm()} disabled={!matches || deleting} className="cs-btn cs-btn-danger min-w-[120px]" data-testid="delete-child-confirm">
              {deleting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {t("danger.child.deleting")}
                </span>
              ) : t("danger.child.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
