import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Achievement, Child } from "../types";

interface Props {
  child: Child;
  achievements: Achievement[];
}

export default function AIInsightCard({ child, achievements }: Props) {
  const { t } = useTranslation();
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const getInsight = async () => {
    setLoading(true);
    setError("");
    try {
      const summary = achievements
        .slice(0, 10)
        .map((a) => `- ${a.title} (${a.date}, ${a.category}, ${a.awardType})`)
        .join("\n");

      const response = await fetch("/api/ai-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: child.name,
          birthDate: child.birthDate,
          summary,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server error");
      setInsight(data.insight);
    } catch (e) {
      setError(t("ai.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h3 className="font-semibold text-gray-800">{t("ai.heading")}</h3>
        </div>
        <button
          onClick={getInsight}
          disabled={loading}
          className="text-sm bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading ? t("ai.loading") : insight ? t("ai.refresh") : t("ai.fetch")}
        </button>
      </div>
      {insight && (
        <div>
          <p className="text-gray-700 text-sm leading-relaxed">{insight}</p>
          <p className="text-xs text-gray-400 mt-3 border-t pt-2">
            ⚡ {t("ai.footer", { name: child.name })}
          </p>
        </div>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {!insight && !loading && (
        <p className="text-gray-400 text-sm">{t("ai.empty")}</p>
      )}
    </div>
  );
}
