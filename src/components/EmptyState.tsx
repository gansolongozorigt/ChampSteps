// =============================================================================
// EmptyState — placeholder shown when there are no entries or when filters /
// search return nothing. No illustration (docs/BRAND.md): lucide icon 40px
// text-ink-3 + one line + primary pill button.
//   - "journal"  → first-run (no achievements at all)
//   - "filtered" → filters/search wiped out results
// =============================================================================

import { useTranslation } from "react-i18next";
import { Plus, Search, Trophy } from "lucide-react";

type Variant = "journal" | "filtered";

export interface EmptyStateProps {
  variant?: Variant;
  onPrimary?: () => void;
}

export default function EmptyState({ variant = "journal", onPrimary }: EmptyStateProps) {
  const { t } = useTranslation();

  if (variant === "filtered") {
    return (
      <div className="cs-card border-dashed p-8 text-center animate-fade-up">
        <Search size={40} strokeWidth={1.75} className="mx-auto text-ink-3" aria-hidden />
        <h3 className="t-h2 mt-3">{t("emptySearch.title")}</h3>
        <p className="t-body text-ink-2 mt-1">{t("emptySearch.subtitle")}</p>
        {onPrimary && (
          <button type="button" onClick={onPrimary} className="cs-btn cs-btn-outline mt-5">
            {t("emptySearch.reset")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="cs-card p-8 sm:p-10 text-center animate-fade-up">
      <Trophy size={40} strokeWidth={1.75} className="mx-auto text-ink-3" aria-hidden />
      <h3 className="t-h2 mt-3">{t("empty.title")}</h3>
      <p className="t-body text-ink-2 mx-auto mt-1 max-w-sm">{t("empty.subtitle")}</p>
      {onPrimary && (
        <button type="button" onClick={onPrimary} className="cs-btn cs-btn-primary mt-6">
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          <span>+ {t("empty.cta")}</span>
        </button>
      )}
    </div>
  );
}
