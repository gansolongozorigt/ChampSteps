import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// EmptyState — Warm, illustrated placeholder shown when there are no entries
// or when filters/search return nothing.
// Two variants:
//   - "journal"  → first-run (no achievements at all)
//   - "filtered" → filters/search wiped out results
// =============================================================================
import { useTranslation } from "react-i18next";
export default function EmptyState({ variant = "journal", onPrimary }) {
    const { t } = useTranslation();
    if (variant === "filtered") {
        return (_jsxs("div", { className: "rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center", children: [_jsx("div", { className: "mx-auto h-12 w-12 text-stone-400", children: _jsx(SearchIllustration, {}) }), _jsx("h3", { className: "mt-3 font-serif text-lg text-stone-800", children: t("emptySearch.title") }), _jsx("p", { className: "mt-1 text-sm text-stone-500", children: t("emptySearch.subtitle") }), onPrimary && (_jsx("button", { type: "button", onClick: onPrimary, className: "mt-4 inline-flex rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50", children: t("emptySearch.reset") }))] }));
    }
    return (_jsxs("div", { className: "overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-b from-amber-50 via-stone-50 to-white p-10 text-center shadow-sm", children: [_jsx("div", { className: "mx-auto h-36 w-36", children: _jsx(TrophyIllustration, {}) }), _jsx("h3", { className: "mt-4 font-serif text-2xl text-stone-900", children: t("empty.title") }), _jsx("p", { className: "mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-600", children: t("empty.subtitle") }), onPrimary && (_jsxs("button", { type: "button", onClick: onPrimary, className: "mt-6 inline-flex rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-stone-50 hover:bg-stone-800", children: ["+ ", t("empty.cta")] }))] }));
}
// -----------------------------------------------------------------------------
// Hand-drawn SVG illustrations — inline to avoid extra assets.
// -----------------------------------------------------------------------------
function TrophyIllustration() {
    return (_jsxs("svg", { viewBox: "0 0 144 144", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": true, children: [_jsxs("g", { opacity: "0.7", children: [_jsx("circle", { cx: "24", cy: "28", r: "3", fill: "#f59e0b" }), _jsx("circle", { cx: "120", cy: "34", r: "2.5", fill: "#ef4444" }), _jsx("circle", { cx: "18", cy: "62", r: "2", fill: "#6366f1" }), _jsx("circle", { cx: "128", cy: "70", r: "3", fill: "#10b981" }), _jsx("rect", { x: "110", y: "14", width: "6", height: "2", fill: "#f59e0b", transform: "rotate(30 113 15)" }), _jsx("rect", { x: "30", y: "100", width: "6", height: "2", fill: "#6366f1", transform: "rotate(-20 33 101)" }), _jsx("rect", { x: "106", y: "102", width: "6", height: "2", fill: "#ef4444", transform: "rotate(15 109 103)" })] }), _jsx("rect", { x: "46", y: "112", width: "52", height: "10", rx: "2", fill: "#78716c" }), _jsx("rect", { x: "56", y: "104", width: "32", height: "8", rx: "1.5", fill: "#a8a29e" }), _jsx("path", { d: "M52 30 h40 v30 a20 20 0 0 1 -40 0 z", fill: "#fbbf24", stroke: "#b45309", strokeWidth: "2" }), _jsx("path", { d: "M52 38 q-14 0 -14 14 q0 10 14 10", fill: "none", stroke: "#b45309", strokeWidth: "3" }), _jsx("path", { d: "M92 38 q14 0 14 14 q0 10 -14 10", fill: "none", stroke: "#b45309", strokeWidth: "3" }), _jsx("path", { d: "M72 38 l3.6 7.3 l8 1.2 l-5.8 5.7 l1.4 8 l-7.2 -3.8 l-7.2 3.8 l1.4 -8 l-5.8 -5.7 l8 -1.2 z", fill: "#fef3c7", stroke: "#b45309", strokeWidth: "1.5" }), _jsx("rect", { x: "66", y: "78", width: "12", height: "26", fill: "#b45309" })] }));
}
function SearchIllustration() {
    return (_jsxs("svg", { viewBox: "0 0 48 48", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": true, children: [_jsx("circle", { cx: "20", cy: "20", r: "12", fill: "none", stroke: "currentColor", strokeWidth: "2" }), _jsx("line", { x1: "29", y1: "29", x2: "42", y2: "42", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round" }), _jsx("line", { x1: "15", y1: "20", x2: "25", y2: "20", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" })] }));
}
