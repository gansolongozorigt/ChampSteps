import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// AdminPage — promo code management (guarded by hardcoded admin email)
// =============================================================================
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { createPromoCode, listPromoCodes, seedPromoCodes, } from "../lib/firebase";
const ADMIN_EMAIL = "admin@champsteps.app";
export default function AdminPage({ onClose }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    if (!user || user.email !== ADMIN_EMAIL) {
        return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm", onClick: onClose, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), className: "rounded-2xl bg-white p-8 shadow-xl text-center", children: [_jsx("p", { className: "text-stone-700 font-medium", children: t("admin.accessDenied") }), _jsx("button", { onClick: onClose, className: "mt-4 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800", children: t("delete.cancel") })] }) }));
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-sm p-2 sm:items-center sm:p-4", onClick: onClose, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), className: "w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl", children: [_jsxs("header", { className: "flex items-center justify-between border-b border-stone-100 px-5 py-3", children: [_jsx("h2", { className: "font-serif text-lg font-bold text-stone-900", children: t("admin.title") }), _jsx("button", { type: "button", onClick: onClose, className: "text-stone-400 hover:text-stone-700", children: "\u2715" })] }), _jsx("div", { className: "max-h-[80vh] overflow-y-auto px-5 py-5 space-y-6", children: _jsx(PromoSection, {}) })] }) }));
}
function PromoSection() {
    const { t } = useTranslation();
    const [codes, setCodes] = useState([]);
    const [loadingCodes, setLoadingCodes] = useState(true);
    const [code, setCode] = useState("");
    const [months, setMonths] = useState(3);
    const [maxUses, setMaxUses] = useState(100);
    const [expiry, setExpiry] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 2);
        return d.toISOString().slice(0, 10);
    });
    const [creating, setCreating] = useState(false);
    const [createMsg, setCreateMsg] = useState(null);
    const [seeding, setSeeding] = useState(false);
    const [seedMsg, setSeedMsg] = useState(null);
    async function load() {
        setLoadingCodes(true);
        try {
            setCodes(await listPromoCodes());
        }
        finally {
            setLoadingCodes(false);
        }
    }
    useEffect(() => { load(); }, []);
    async function handleCreate(e) {
        e.preventDefault();
        if (!code.trim())
            return;
        setCreating(true);
        setCreateMsg(null);
        try {
            await createPromoCode({
                code: code.trim().toUpperCase(),
                discountMonths: months,
                maxUses,
                expiresAt: new Date(expiry),
                active: true,
            });
            setCreateMsg(t("admin.created"));
            setCode("");
            await load();
        }
        finally {
            setCreating(false);
        }
    }
    async function handleSeed() {
        setSeeding(true);
        setSeedMsg(null);
        try {
            await seedPromoCodes();
            setSeedMsg(t("admin.seeded"));
            await load();
        }
        finally {
            setSeeding(false);
        }
    }
    return (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-stone-700 mb-3", children: t("admin.promoSection") }), _jsxs("div", { className: "mb-4", children: [_jsx("button", { type: "button", onClick: handleSeed, disabled: seeding, className: "rounded-lg border border-stone-200 px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400", children: seeding ? t("admin.seeding") : t("admin.seedButton") }), seedMsg && _jsx("span", { className: "ml-3 text-xs text-emerald-600", children: seedMsg })] }), _jsxs("form", { onSubmit: handleCreate, className: "rounded-xl border border-stone-200 p-4 space-y-3 mb-5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-xs font-medium text-stone-600", children: t("admin.codeName") }), _jsx("input", { type: "text", value: code, onChange: (e) => setCode(e.target.value.toUpperCase()), placeholder: "CHAMP3", required: true, className: "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-xs font-medium text-stone-600", children: t("admin.months") }), _jsx("input", { type: "number", min: 1, max: 24, value: months, onChange: (e) => setMonths(Number(e.target.value)), className: "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-xs font-medium text-stone-600", children: t("admin.maxUses") }), _jsx("input", { type: "number", min: 1, value: maxUses, onChange: (e) => setMaxUses(Number(e.target.value)), className: "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-xs font-medium text-stone-600", children: t("admin.expiry") }), _jsx("input", { type: "date", value: expiry, onChange: (e) => setExpiry(e.target.value), className: "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none" })] })] }), _jsx("button", { type: "submit", disabled: creating, className: "w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:bg-stone-400", children: creating ? t("admin.creating") : t("admin.createButton") }), createMsg && _jsx("p", { className: "text-xs text-emerald-600", children: createMsg })] }), _jsx("h4", { className: "text-xs font-semibold text-stone-500 mb-2", children: t("admin.listHeading") }), loadingCodes ? (_jsx("p", { className: "text-xs text-stone-400", children: t("admin.loading") })) : codes.length === 0 ? (_jsx("p", { className: "text-xs text-stone-400", children: "\u2014" })) : (_jsx("div", { className: "space-y-2", children: codes.map((c) => (_jsxs("div", { className: "rounded-lg border border-stone-200 px-3 py-2 text-xs flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("span", { className: "font-mono font-bold text-stone-900", children: c.code }), _jsxs("span", { className: "ml-2 text-stone-500", children: [c.discountMonths, "mo"] }), _jsx("span", { className: `ml-2 rounded px-1.5 py-0.5 ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`, children: c.active ? t("admin.active") : t("admin.inactive") })] }), _jsxs("span", { className: "text-stone-400 shrink-0", children: [c.usedBy.length, "/", c.maxUses, " ", t("admin.used")] })] }, c.code))) }))] }));
}
