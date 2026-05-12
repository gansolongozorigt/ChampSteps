import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// SubscriptionModal v3 — i18n бүрэн дэмжсэн
// =============================================================================
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
export default function SubscriptionModal({ onClose }) {
    const { t } = useTranslation();
    const { subscription, activateSubscription } = useAuth();
    const [step, setStep] = useState("compare");
    const [selectedTier, setSelectedTier] = useState("family");
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    // Tier мэдээллийг i18n-тэй уялдуулан тодорхойлно
    const TIERS = [
        {
            id: "free",
            name: t("sub.tierNames.free"),
            price: "₮0",
            children: t("sub.children", { n: 1 }),
            achievements: t("sub.entries", { n: 30 }),
            pdf: false,
            ai: false,
            color: "border-stone-200",
        },
        {
            id: "family",
            name: t("sub.tierNames.family"),
            price: "₮9,900",
            children: t("sub.children", { n: 3 }),
            achievements: t("sub.unlimited"),
            pdf: true,
            ai: false,
            color: "border-blue-200",
            badge: t("sub.popular"),
        },
        {
            id: "master",
            name: t("sub.tierNames.master"),
            price: "₮24,900",
            children: t("sub.children", { n: 10 }),
            achievements: t("sub.unlimited"),
            pdf: true,
            ai: true,
            color: "border-amber-300",
        },
        {
            id: "coach",
            name: t("sub.tierNames.coach"),
            price: "₮49,900",
            children: t("sub.children", { n: 30 }),
            achievements: t("sub.unlimited"),
            pdf: true,
            ai: true,
            color: "border-purple-300",
        },
    ];
    async function handlePay() {
        setError(null);
        setProcessing(true);
        try {
            await new Promise((r) => setTimeout(r, 1800));
            await activateSubscription(selectedTier);
            setStep("success");
        }
        catch (e) {
            console.error("[champstep] activateSubscription failed:", e);
            setError(t("sub.error"));
        }
        finally {
            setProcessing(false);
        }
    }
    const tierInfo = TIERS.find((t) => t.id === selectedTier);
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-2 backdrop-blur-sm sm:items-center sm:p-4 print:hidden", onClick: onClose, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), className: "w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl", children: [_jsxs("header", { className: "flex items-center justify-between border-b border-stone-100 px-5 py-3", children: [_jsx("h2", { className: "font-serif text-lg font-bold text-stone-900", children: t("sub.title") }), _jsx("button", { type: "button", onClick: onClose, className: "text-stone-400 hover:text-stone-700", children: "\u2715" })] }), step === "compare" && (_jsxs("div", { className: "px-5 py-5 max-h-[80vh] overflow-y-auto", children: [_jsx("p", { className: "text-sm text-stone-500 mb-4", children: t("sub.subtitle") }), _jsx("div", { className: "space-y-3", children: TIERS.map((tier) => {
                                const isCurrent = subscription === tier.id;
                                const isSelected = selectedTier === tier.id;
                                return (_jsx("button", { type: "button", onClick: () => !isCurrent && setSelectedTier(tier.id), disabled: isCurrent, className: `w-full rounded-xl border-2 p-4 text-left transition ${isSelected && !isCurrent
                                        ? `${tier.color} bg-stone-50 ring-2 ring-stone-900`
                                        : isCurrent
                                            ? "border-emerald-300 bg-emerald-50 cursor-default"
                                            : `${tier.color} hover:bg-stone-50`}`, children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-semibold text-stone-900", children: tier.name }), tier.badge && (_jsx("span", { className: "rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700", children: tier.badge })), isCurrent && (_jsx("span", { className: "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700", children: t("sub.current") }))] }), _jsxs("div", { className: "mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500", children: [_jsxs("span", { children: ["\uD83D\uDC64 ", tier.children] }), _jsxs("span", { children: ["\uD83C\uDFC6 ", tier.achievements] }), tier.pdf && _jsx("span", { children: "\uD83D\uDCC4 PDF" }), tier.ai && _jsx("span", { children: "\uD83E\uDD16 AI" })] })] }), _jsxs("div", { className: "shrink-0 text-right", children: [_jsx("span", { className: "font-bold text-stone-900", children: tier.price }), tier.id !== "free" && (_jsx("span", { className: "block text-[10px] text-stone-400", children: t("sub.perMonth") }))] })] }) }, tier.id));
                            }) }), _jsx("button", { type: "button", onClick: () => setStep("pay"), disabled: selectedTier === subscription || selectedTier === "free", className: "mt-5 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400", children: selectedTier === subscription
                                ? t("sub.currentPlan")
                                : selectedTier === "free"
                                    ? t("sub.freePlan")
                                    : t("sub.pay") })] })), step === "pay" && (_jsxs("div", { className: "px-5 py-5", children: [_jsxs("div", { className: "mb-4 rounded-xl bg-stone-50 p-3 flex items-center justify-between", children: [_jsx("span", { className: "text-sm font-medium text-stone-700", children: tierInfo?.name }), _jsxs("span", { className: "font-bold text-stone-900", children: [tierInfo?.price, t("sub.perMonth")] })] }), _jsx("p", { className: "text-sm text-stone-500 mb-3", children: t("sub.payWith") }), _jsx("div", { className: "mx-auto flex h-48 w-48 items-center justify-center rounded-xl border border-stone-200 bg-stone-50", children: _jsxs("svg", { width: "140", height: "140", viewBox: "0 0 160 160", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": true, children: [_jsx("rect", { width: "160", height: "160", fill: "white" }), Array.from({ length: 12 }).map((_, r) => Array.from({ length: 12 }).map((__, c) => {
                                        const seed = (r * 13 + c * 7 + r * c) % 5;
                                        return seed < 2 ? (_jsx("rect", { x: 8 + c * 12, y: 8 + r * 12, width: "10", height: "10", fill: "#1c1917" }, `${r}-${c}`)) : null;
                                    })), _jsx("rect", { x: "4", y: "4", width: "32", height: "32", fill: "none", stroke: "#1c1917", strokeWidth: "4" }), _jsx("rect", { x: "124", y: "4", width: "32", height: "32", fill: "none", stroke: "#1c1917", strokeWidth: "4" }), _jsx("rect", { x: "4", y: "124", width: "32", height: "32", fill: "none", stroke: "#1c1917", strokeWidth: "4" })] }) }), _jsx("p", { className: "mt-2 text-center text-xs text-stone-400", children: t("sub.scanQr") }), error && (_jsx("div", { className: "mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", children: error })), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { type: "button", onClick: () => setStep("compare"), disabled: processing, className: "flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed", children: t("sub.back") }), _jsx("button", { type: "button", onClick: handlePay, disabled: processing, className: "flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50", children: processing ? t("sub.processing") : t("sub.confirm") })] }), _jsx("p", { className: "mt-2 text-center text-[10px] text-stone-400", children: t("sub.demo") })] })), step === "success" && (_jsxs("div", { className: "px-5 py-6 text-center", children: [_jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl", children: "\u2705" }), _jsx("h3", { className: "mt-3 font-serif text-xl font-bold text-stone-900", children: t("sub.success") }), _jsx("p", { className: "mt-2 text-sm text-stone-500", children: t("sub.successMsg", { name: tierInfo?.name }) }), _jsx("button", { type: "button", onClick: onClose, className: "mt-5 w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800", children: t("sub.close") })] }))] }) }));
}
