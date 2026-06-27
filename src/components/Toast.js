import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// Toast — Tiny, self-dismissing notification. Replaces alert() everywhere.
// Usage: <Toast kind="success" message="Saved" onClose={...} />
// =============================================================================
import { useEffect } from "react";
const STYLES = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    info: "bg-stone-900 text-white",
};
const ICONS = {
    success: "✓",
    error: "!",
    info: "i",
};
export default function Toast({ kind, message, durationMs = 4000, onClose }) {
    useEffect(() => {
        if (durationMs <= 0)
            return;
        const id = window.setTimeout(onClose, durationMs);
        return () => window.clearTimeout(id);
    }, [durationMs, onClose]);
    return (_jsx("div", { role: "status", "aria-live": "polite", className: "pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-8", children: _jsxs("div", { className: `cs-toast-in pointer-events-auto flex max-w-sm items-center gap-3 rounded-full px-4 py-2.5 text-sm shadow-lg shadow-stone-900/20 ${STYLES[kind]}`, children: [_jsx("span", { "aria-hidden": true, className: "flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs font-bold", children: ICONS[kind] }), _jsx("span", { className: "font-medium", children: message }), _jsx("button", { type: "button", onClick: onClose, className: "-mr-1 rounded-full px-2 text-sm text-white/80 hover:text-white", "aria-label": "Dismiss", children: "\u00D7" })] }) }));
}
