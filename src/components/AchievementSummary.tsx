// ChampStep — Achievement summary (зэрэглэлийн медаль + нийт тоо)
// Зөвхөн харагдац. achievements-ээс зэрэглэл тус бүрийн тоог тоолж emoji медаль харуулна.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Achievement } from "../types";

/** 0 → end рүү easeOutCubic-аар тоолно. reduced-motion үед шууд утга өгнө. */
function useCountUp(end: number, duration = 1100): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVal(end);
      return;
    }
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(end * ease(t)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [end, duration]);
  return val;
}

const MEDALS = [
  { key: "Gold", emoji: "🥇" },
  { key: "Silver", emoji: "🥈" },
  { key: "Bronze", emoji: "🥉" },
  { key: "Participant", emoji: "🏅" },
] as const;

export default function AchievementSummary({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const { t } = useTranslation();

  const counts = useMemo(() => {
    const c: Record<string, number> = { Gold: 0, Silver: 0, Bronze: 0, Participant: 0 };
    for (const a of achievements) {
      if (a.awardType in c) c[a.awardType] += 1;
    }
    return c;
  }, [achievements]);

  const total = useCountUp(achievements.length);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 mb-5 shadow-sm">
      <p className="text-center text-[13px] text-stone-500 mb-4">
        {t("summary.totalAchievements", { n: total })}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MEDALS.map((m, i) => (
          <MedalItem
            key={m.key}
            emoji={m.emoji}
            label={t(`awards.${m.key}`)}
            value={counts[m.key] ?? 0}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}

function MedalItem({
  emoji,
  label,
  value,
  index,
}: {
  emoji: string;
  label: string;
  value: number;
  index: number;
}) {
  const n = useCountUp(value);
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl py-2.5">
      <span
        className="text-[38px] leading-none animate-pop"
        style={{ animationDelay: `${index * 0.09}s` }}
      >
        {emoji}
      </span>
      <span className="text-[20px] font-bold text-stone-900 leading-tight">{n}</span>
      <span className="text-[12px] font-medium text-stone-500">{label}</span>
    </div>
  );
}
