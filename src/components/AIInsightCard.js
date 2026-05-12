import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// AIInsightCard.tsx — хэл дамжуулж, зөв хэлээр хариу авна
import { useState } from "react";
import { useTranslation } from "react-i18next";
export default function AIInsightCard({ child, achievements }) {
    const { t, i18n } = useTranslation();
    const [insight, setInsight] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
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
            const response = await fetch("/api/ai-insight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    childName: child.name,
                    birthDate: child.birthDate,
                    summary,
                    language, // ← шинэ: хэл дамжуулна
                }),
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error || t("ai.error"));
            setInsight(data.insight);
        }
        catch (e) {
            setError(t("ai.error"));
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mt-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xl", children: "\uD83E\uDD16" }), _jsx("h3", { className: "font-semibold text-stone-800", children: t("ai.heading") })] }), _jsx("button", { onClick: getInsight, disabled: loading, className: "text-sm bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 disabled:opacity-50 active:scale-95 transition-all", children: loading ? t("ai.loading") : insight ? t("ai.refresh") : t("ai.fetch") })] }), insight && (_jsxs("div", { children: [_jsx("p", { className: "text-stone-700 text-sm leading-relaxed", children: insight }), _jsxs("p", { className: "text-xs text-stone-400 mt-3 border-t pt-2", children: ["\u26A1 ", t("ai.footer", { name: child.name })] })] })), error && _jsx("p", { className: "text-red-500 text-sm", children: error }), !insight && !loading && (_jsx("p", { className: "text-stone-400 text-sm", children: t("ai.empty") }))] }));
}
