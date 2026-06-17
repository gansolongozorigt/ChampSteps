import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ChampStep — Achievement summary (зэрэглэлийн медаль + нийт тоо)
// Зөвхөн харагдац. achievements-ээс зэрэглэл тус бүрийн тоог тоолж emoji медаль харуулна.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
/** 0 → end рүү easeOutCubic-аар тоолно. reduced-motion үед шууд утга өгнө. */
function useCountUp(end, duration = 1100) {
    const [val, setVal] = useState(0);
    const raf = useRef();
    useEffect(() => {
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            setVal(end);
            return;
        }
        const start = performance.now();
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            setVal(Math.round(end * ease(t)));
            if (t < 1)
                raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => {
            if (raf.current)
                cancelAnimationFrame(raf.current);
        };
    }, [end, duration]);
    return val;
}
const MEDALS = [
    { key: "Gold", emoji: "🥇" },
    { key: "Silver", emoji: "🥈" },
    { key: "Bronze", emoji: "🥉" },
    { key: "Participant", emoji: "🏅" },
];
export default function AchievementSummary({ achievements, }) {
    const { t } = useTranslation();
    const counts = useMemo(() => {
        const c = { Gold: 0, Silver: 0, Bronze: 0, Participant: 0 };
        for (const a of achievements) {
            if (a.awardType in c)
                c[a.awardType] += 1;
        }
        return c;
    }, [achievements]);
    const total = useCountUp(achievements.length);
    return (_jsxs("section", { className: "rounded-2xl border border-stone-200 bg-white p-5 mb-5 shadow-sm", children: [_jsx("p", { className: "text-center text-[13px] text-stone-500 mb-4", children: t("summary.totalAchievements", { n: total }) }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: MEDALS.map((m, i) => (_jsx(MedalItem, { emoji: m.emoji, label: t(`awards.${m.key}`), value: counts[m.key] ?? 0, index: i }, m.key))) })] }));
}
function MedalItem({ emoji, label, value, index, }) {
    const n = useCountUp(value);
    return (_jsxs("div", { className: "flex flex-col items-center gap-1 rounded-xl py-2.5", children: [_jsx("span", { className: "text-[38px] leading-none animate-pop", style: { animationDelay: `${index * 0.09}s` }, children: emoji }), _jsx("span", { className: "text-[20px] font-bold text-stone-900 leading-tight", children: n }), _jsx("span", { className: "text-[12px] font-medium text-stone-500", children: label })] }));
}
