// ChampStep — Achievement summary (медалийн тоо + нийт)
// Зөвхөн харагдац. 4 хүрээтэй stat карт: медалийн өнгөт дугуй badge + lucide icon,
// .t-stat тоо, медалийн өнгөт label (docs/BRAND.md).
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Medal, type LucideIcon } from "lucide-react";
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

const MEDALS: ReadonlyArray<{ key: "Gold" | "Silver" | "Bronze" | "Participant"; Icon: LucideIcon; badge: string; label: string }> = [
  { key: "Gold", Icon: Medal, badge: "cs-badge-gold", label: "text-gold" },
  { key: "Silver", Icon: Medal, badge: "cs-badge-silver", label: "text-silver" },
  { key: "Bronze", Icon: Medal, badge: "cs-badge-bronze", label: "text-bronze" },
  { key: "Participant", Icon: Award, badge: "cs-badge-participant", label: "text-ink-3" },
];

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
    <section className="mb-5">
      <p className="t-caption text-center mb-3">
        {t("summary.totalAchievements", { n: total })}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {MEDALS.map((m, i) => (
          <MedalItem
            key={m.key}
            Icon={m.Icon}
            badge={m.badge}
            labelClass={m.label}
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
  Icon,
  badge,
  labelClass,
  label,
  value,
  index,
}: {
  Icon: LucideIcon;
  badge: string;
  labelClass: string;
  label: string;
  value: number;
  index: number;
}) {
  const n = useCountUp(value);
  return (
    <div
      className="cs-card flex flex-col items-center gap-1.5 px-1 py-3 sm:py-4 animate-fade-up"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <span className={`cs-badge ${badge}`} aria-hidden>
        <Icon size={20} strokeWidth={2} />
      </span>
      <span className="t-stat">{n}</span>
      <span className={`t-label text-center ${labelClass}`}>{label}</span>
    </div>
  );
}
