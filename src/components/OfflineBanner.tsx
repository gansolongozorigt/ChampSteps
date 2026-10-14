// =============================================================================
// OfflineBanner — "no internet" strip + "N entries waiting to sync" counter.
// Offline writes are queued by Firestore's persistent cache (src/lib/firebase.ts);
// the counter comes from the live subscriptions (src/lib/pendingWrites.ts).
// =============================================================================

import { useTranslation } from "react-i18next";
import { CloudUpload, WifiOff } from "lucide-react";
import { useOnline } from "../hooks/useOnline";
import { usePendingWrites } from "../lib/pendingWrites";

export default function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  const pending = usePendingWrites();
  if (online && pending === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className={`flex items-center justify-center gap-2 px-4 py-2 t-caption print:hidden ${online ? "bg-bg-soft text-ink-2" : "bg-warn-soft text-warn"}`}
    >
      {online ? <CloudUpload size={16} strokeWidth={2.2} aria-hidden /> : <WifiOff size={16} strokeWidth={2.2} aria-hidden />}
      <span>
        {online ? t("offline.pending", { count: pending }) : t("offline.banner")}
        {!online && pending > 0 && <> · {t("offline.pending", { count: pending })}</>}
      </span>
    </div>
  );
}
