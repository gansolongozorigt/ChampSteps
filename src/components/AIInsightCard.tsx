// AIInsightCard.tsx — AI зөвлөгөө, зөвхөн сонгосон хүүхдэд.
//
// Client нь /api/ai-insight руу ЗӨВХӨН { childId, language } илгээнэ; амжилт,
// бэлтгэлийг сервер өөрөө Firestore-оос уншина (эзэмшил шалгана). Кэш нь
// aiInsights/{childId} (зөвхөн сервер бичнэ): карт нээгдэх / хүүхэд солигдоход
// тэр хүүхдийн кэшийг уншиж харуулна. "Шинэчлэх" дарахад сервер өгөгдөл
// өөрчлөгдөөгүй бол (dataHash ижил, 24 цаг болоогүй) кэшээ буцааж, карт
// "Шинэ өгөгдөл байхгүй" toast харуулна.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { Achievement, Child, TIER_LIMITS } from "../types";
import { useAuth } from "../lib/auth";
import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import type { ToastKind } from "./Toast";

interface Props {
  child: Child;
  achievements: Achievement[];
  onToast?: (kind: ToastKind, message: string) => void;
}

interface InsightResponse {
  insight?: string;
  cached?: boolean;
  createdAt?: string;
  error?: string;
}

// Гарчгууд (mn/en/ru) — серверийн system prompt-той ижил.
const HEADINGS = [
  "Давуу тал", "Ажиглалт", "Дараагийн алхам",
  "Strengths", "Observations", "Next steps",
  "Сильные стороны", "Наблюдения", "Следующие шаги",
];
const headingKey = (s: string) => s.replace(/[*#_:：.\s]+/g, " ").trim().toLowerCase();
const HEADING_SET = new Set(HEADINGS.map(headingKey));

interface Section { heading: string | null; body: string }

/** "Гарчиг\nтекст" / "Гарчиг: текст" / "**Гарчиг**" хэлбэрүүдийг хэсэг болгон хуваана. */
export function splitSections(text: string): Section[] {
  const out: Section[] = [];
  let cur: Section = { heading: null, body: "" };
  const push = () => { if (cur.heading || cur.body.trim()) out.push({ heading: cur.heading, body: cur.body.trim() }); };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { cur.body += "\n"; continue; }
    const m = /^([*#_\s]*)([^:：]{2,40}?)[*_\s]*[:：]?\s*(.*)$/.exec(line);
    const candidate = m ? headingKey(m[2]) : "";
    if (candidate && HEADING_SET.has(candidate)) {
      push();
      cur = { heading: m![2].replace(/[*#_]/g, "").trim(), body: m![3] ? m![3] + "\n" : "" };
    } else {
      cur.body += line + "\n";
    }
  }
  push();
  return out;
}

export default function AIInsightCard({ child, achievements, onToast }: Props) {
  const { t, i18n } = useTranslation();
  const { subscription } = useAuth();
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const childId = child.childId;
  const insightRef = useRef("");
  insightRef.current = insight;
  void achievements; // харагдах эсэхийг эцэг компонент шийднэ; өгөгдөл сервер уншина

  const hasAI = TIER_LIMITS[subscription]?.hasAI === true;

  // Хүүхэд солигдох бүрт: state цэвэрлэж, тэр хүүхдийн кэшийг уншина.
  useEffect(() => {
    let alive = true;
    setInsight("");
    setError("");
    if (!hasAI || !isFirebaseConfigured || !db || !childId) return;
    getDoc(doc(db, "aiInsights", childId))
      .then((snap) => {
        if (!alive) return;
        const text = snap.exists() ? (snap.data()?.text as unknown) : "";
        if (typeof text === "string" && text.trim()) setInsight(text);
      })
      .catch(() => { /* кэш уншигдахгүй (rules хараахан нээгээгүй) → хоосон эхэлнэ */ });
    return () => { alive = false; };
  }, [childId, hasAI]);

  // Free / Family багцад AI байхгүй — картыг огт үзүүлэхгүй.
  if (!hasAI) return null;

  const getInsight = async () => {
    const hadInsight = Boolean(insightRef.current);
    setLoading(true);
    setError("");
    try {
      const language = i18n.language?.startsWith("en") ? "en" : i18n.language?.startsWith("ru") ? "ru" : "mn";
      const idToken = await auth?.currentUser?.getIdToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const response = await fetch("/api/ai-insight", {
        method: "POST",
        headers,
        body: JSON.stringify({ childId, language }),
      });

      const data = (await response.json().catch(() => ({}))) as InsightResponse;
      if (!response.ok) {
        if (response.status === 429) throw new Error("ai.rateLimited");
        if (response.status === 403 && data.error === "tier_required") throw new Error("ai.tierRequired");
        throw new Error("ai.error");
      }
      // Хариу ирэхэд өөр хүүхэд сонгогдсон бол хаяна.
      if (childId !== child.childId) return;
      setInsight(data.insight ?? "");
      if (data.cached && hadInsight) onToast?.("info", t("ai.noNewData"));
    } catch (e) {
      const key = e instanceof Error && e.message.startsWith("ai.") ? e.message : "ai.error";
      setError(t(key));
    } finally {
      setLoading(false);
    }
  };

  const sections = insight ? splitSections(insight) : [];

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mt-4" data-testid="ai-insight-card">
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
          <div className="text-stone-700 text-sm leading-relaxed space-y-3" data-testid="ai-insight-text">
            {sections.map((s, i) => (
              <div key={i}>
                {s.heading && <p className="font-semibold text-stone-800 mb-0.5">{s.heading}</p>}
                {s.body && <p className="whitespace-pre-line">{s.body}</p>}
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-3 border-t pt-2">
            ⚡ {t("ai.footer", { name: child.name })}
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!insight && !loading && !error && (
        <p className="text-stone-400 text-sm">{t("ai.empty")}</p>
      )}
    </div>
  );
}
