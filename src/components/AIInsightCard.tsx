// AIInsightCard.tsx — хэл дамжуулж, зөв хэлээр хариу авна.
// /api/ai-insight нь Bearer idToken шаардана; AI-гүй багцад карт огт харагдахгүй.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Achievement, Child, TIER_LIMITS } from "../types";
import { useAuth } from "../lib/auth";
import { auth } from "../lib/firebase";

interface Props {
  child: Child;
  achievements: Achievement[];
}

export default function AIInsightCard({ child, achievements }: Props) {
  const { t, i18n } = useTranslation();
  const { subscription } = useAuth();
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Free / Family багцад AI байхгүй — картыг огт үзүүлэхгүй.
  if (!TIER_LIMITS[subscription]?.hasAI) return null;

  const getInsight = async () => {
    setLoading(true);
    setError("");
    try {
      const summary = achievements
        .slice(0, 10)
        .map((a) => `- ${a.title} (${a.date}, ${a.category}, ${a.awardType})`)
        .join("\n");

      // i18n.language нь "mn" эсвэл "en" байна — API-д дамжуулна
      const language = i18n.language?.startsWith("en") ? "en" : "mn";

      const idToken = await auth?.currentUser?.getIdToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const response = await fetch("/api/ai-insight", {
        method: "POST",
        headers,
        body: JSON.stringify({
          childName: child.name,
          birthDate: child.birthDate,
          summary,
          language, // ← хэл дамжуулна
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { insight?: string; error?: string };
      if (!response.ok) {
        if (response.status === 429) throw new Error("ai.rateLimited");
        if (response.status === 403 && data.error === "tier_required") throw new Error("ai.tierRequired");
        throw new Error("ai.error");
      }
      setInsight(data.insight ?? "");
    } catch (e) {
      const key = e instanceof Error && e.message.startsWith("ai.") ? e.message : "ai.error";
      setError(t(key));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h3 className="font-semibold text-stone-800">{t("ai.heading")}</h3>
        </div>
        <button
          onClick={getInsight}
          disabled={loading}
          className="cs-shine text-sm bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 disabled:opacity-50 active:scale-95 transition-all"
        >
          {loading ? t("ai.loading") : insight ? t("ai.refresh") : t("ai.fetch")}
        </button>
      </div>

      {insight && (
        <div>
          <p className="text-stone-700 text-sm leading-relaxed">{insight}</p>
          <p className="text-xs text-stone-400 mt-3 border-t pt-2">
            ⚡ {t("ai.footer", { name: child.name })}
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!insight && !loading && (
        <p className="text-stone-400 text-sm">{t("ai.empty")}</p>
      )}
    </div>
  );
}
