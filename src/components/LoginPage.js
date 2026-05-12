import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// LoginPage v2 — багш / эцэг эх role сонголттой
// =============================================================================
import { useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import { useAuth } from "../lib/auth";
import { isFirebaseConfigured } from "../lib/firebase";
export default function LoginPage() {
    const { t } = useTranslation();
    const { signIn, signUp, signInWithGoogle, signInOffline } = useAuth();
    const [mode, setMode] = useState("signin");
    const [role, setRole] = useState("parent");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            if (mode === "signin") {
                await signIn(email.trim(), password);
            }
            else {
                await signUp(email.trim(), password, displayName.trim() || "Хэрэглэгч", role);
            }
        }
        catch (err) {
            setError(mapAuthError(err, t));
        }
        finally {
            setSubmitting(false);
        }
    }
    async function handleGoogle() {
        setError(null);
        setSubmitting(true);
        try {
            await signInWithGoogle(role);
        }
        catch (err) {
            setError(mapAuthError(err, t));
        }
        finally {
            setSubmitting(false);
        }
    }
    function handleOffline() {
        signInOffline(displayName.trim() || undefined, role);
    }
    return (_jsxs("div", { className: "flex min-h-screen flex-col bg-gradient-to-b from-stone-50 to-amber-50 font-sans", children: [_jsxs("header", { className: "flex items-center justify-between px-4 py-4 sm:px-6", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded bg-stone-900 overflow-hidden", children: _jsxs("svg", { width: "22", height: "22", viewBox: "0 0 48 48", fill: "none", children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "lg1", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#d97706", stopOpacity: "0.3" }), _jsx("stop", { offset: "100%", stopColor: "#d97706", stopOpacity: "0.15" })] }), _jsxs("linearGradient", { id: "lg2", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#d97706", stopOpacity: "0.7" }), _jsx("stop", { offset: "100%", stopColor: "#b45309", stopOpacity: "0.5" })] }), _jsxs("linearGradient", { id: "lg3", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#fbbf24" }), _jsx("stop", { offset: "100%", stopColor: "#d97706" })] })] }), _jsx("rect", { x: "4", y: "32", width: "10", height: "12", rx: "2", fill: "url(#lg1)" }), _jsx("rect", { x: "17", y: "22", width: "10", height: "22", rx: "2", fill: "url(#lg2)" }), _jsx("rect", { x: "30", y: "10", width: "10", height: "34", rx: "2", fill: "url(#lg3)" }), _jsx("circle", { cx: "35", cy: "7", r: "5", fill: "white", opacity: "0.9" })] }) }), _jsxs("span", { className: "font-bold tracking-tight text-stone-900", style: { fontFamily: "'Playfair Display', serif" }, children: ["Champ", _jsx("span", { style: { background: "linear-gradient(135deg, #d97706, #92400e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }, children: "Step" })] })] }), _jsx(LanguageToggle, {})] }), _jsx("main", { className: "flex flex-grow items-center justify-center px-4 pb-10", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "mb-6 text-center", children: [_jsx("h1", { className: "font-serif text-2xl font-bold text-stone-900 sm:text-3xl", children: mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle") }), _jsx("p", { className: "mt-2 text-sm text-stone-500", children: t("auth.subtitle") })] }), _jsxs("div", { className: "rounded-2xl border border-stone-200 bg-white p-6 shadow-sm", children: [mode === "signup" && (_jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500", children: "\u0422\u0430 \u0445\u044D\u043D \u0431\u044D?" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(RoleButton, { selected: role === "parent", onClick: () => setRole("parent"), icon: "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67", label: "\u042D\u0446\u044D\u0433 \u044D\u0445", desc: "\u0425\u04AF\u04AF\u0445\u0434\u0438\u0439\u043D\u0445\u044D\u044D \u0430\u043C\u0436\u0438\u043B\u0442\u044B\u0433 \u0445\u044F\u043D\u0430\u043D\u0430" }), _jsx(RoleButton, { selected: role === "teacher", onClick: () => setRole("teacher"), icon: "\uD83C\uDFEB", label: "\u0411\u0430\u0433\u0448 / \u0414\u0430\u0441\u0433\u0430\u043B\u0436\u0443\u0443\u043B\u0430\u0433\u0447", desc: "\u0428\u0430\u0432\u044C \u043D\u0430\u0440\u0430\u0430 \u0443\u0434\u0438\u0440\u0434\u0430\u043D\u0430" })] })] })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [mode === "signup" && (_jsx(Field, { id: "displayName", label: t("auth.name"), value: displayName, onChange: setDisplayName, placeholder: role === "teacher" ? "Багшийн нэр" : "Эцэг эхийн нэр" })), _jsx(Field, { id: "email", type: "email", label: t("auth.email"), value: email, onChange: setEmail, placeholder: "name@email.com", required: true, autoComplete: "email" }), _jsx(Field, { id: "password", type: "password", label: t("auth.password"), value: password, onChange: setPassword, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true, autoComplete: mode === "signin" ? "current-password" : "new-password", minLength: 6 }), error && (_jsx("div", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", children: error })), _jsx("button", { type: "submit", disabled: submitting || !isFirebaseConfigured, className: "w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400", children: submitting
                                                ? t("auth.submitting")
                                                : mode === "signin"
                                                    ? t("auth.signIn")
                                                    : t("auth.signUp") })] }), _jsxs("div", { className: "my-4 flex items-center gap-2", children: [_jsx("div", { className: "h-px flex-grow bg-stone-200" }), _jsx("span", { className: "text-xs text-stone-400", children: t("auth.or") }), _jsx("div", { className: "h-px flex-grow bg-stone-200" })] }), _jsxs("button", { type: "button", onClick: handleGoogle, disabled: submitting || !isFirebaseConfigured, className: "flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400", children: [_jsx(GoogleIcon, {}), t("auth.signInGoogle")] }), _jsx("button", { type: "button", onClick: () => setMode(mode === "signin" ? "signup" : "signin"), className: "mt-4 w-full text-center text-xs text-stone-500 hover:text-stone-800", children: mode === "signin" ? t("auth.toggleToSignup") : t("auth.toggleToSignin") })] }), _jsxs("div", { className: "mt-6 rounded-2xl border border-dashed border-stone-300 bg-white/70 p-4 text-center", children: [_jsx("p", { className: "text-xs text-stone-500", children: isFirebaseConfigured ? t("auth.offlineHint") : t("auth.firebaseNotConfigured") }), _jsx("button", { type: "button", onClick: handleOffline, className: "mt-2 text-sm font-medium text-stone-800 underline underline-offset-2 hover:text-amber-700", children: t("auth.continueOffline") })] })] }) }), _jsxs("footer", { className: "pb-4 text-center text-xs text-stone-400", children: ["\u00A9 ", new Date().getFullYear(), " ChampStep"] })] }));
}
// -----------------------------------------------------------------------------
// Role button
// -----------------------------------------------------------------------------
function RoleButton({ selected, onClick, icon, label, desc, }) {
    return (_jsxs("button", { type: "button", onClick: onClick, className: `flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm transition ${selected
            ? "border-stone-900 bg-stone-50 ring-2 ring-stone-900"
            : "border-stone-200 hover:bg-stone-50"}`, children: [_jsx("span", { className: "text-xl", children: icon }), _jsx("span", { className: `font-semibold ${selected ? "text-stone-900" : "text-stone-700"}`, children: label }), _jsx("span", { className: "text-[11px] leading-snug text-stone-500", children: desc })] }));
}
function Field({ id, label, value, onChange, placeholder, type = "text", required, autoComplete, minLength }) {
    return (_jsxs("div", { children: [_jsx("label", { htmlFor: id, className: "mb-1 block text-xs font-medium text-stone-600", children: label }), _jsx("input", { id: id, type: type, value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, required: required, autoComplete: autoComplete, minLength: minLength, className: "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 transition focus:border-stone-900 focus:bg-white focus:outline-none" })] }));
}
// -----------------------------------------------------------------------------
// Google icon
// -----------------------------------------------------------------------------
function GoogleIcon() {
    return (_jsxs("svg", { width: "18", height: "18", viewBox: "0 0 18 18", xmlns: "http://www.w3.org/2000/svg", children: [_jsx("path", { d: "M17.64 9.2a10.34 10.34 0 0 0-.15-1.77H9v3.34h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.55z", fill: "#4285F4" }), _jsx("path", { d: "M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.87-3.06.87-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z", fill: "#34A853" }), _jsx("path", { d: "M3.95 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.71V4.96H.9A9 9 0 0 0 0 9c0 1.45.35 2.82.9 4.04l3.05-2.33z", fill: "#FBBC05" }), _jsx("path", { d: "M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .9 4.96l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z", fill: "#EA4335" })] }));
}
// -----------------------------------------------------------------------------
// Auth error mapping
// -----------------------------------------------------------------------------
function mapAuthError(err, t) {
    const code = err?.code ?? "";
    const msg = err?.message ?? "";
    if (msg === "auth.errors.notConfigured")
        return t("auth.errors.notConfigured");
    if (code.includes("invalid-email"))
        return t("auth.errors.invalidEmail");
    if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential"))
        return t("auth.errors.invalidCredentials");
    if (code.includes("email-already-in-use"))
        return t("auth.errors.emailInUse");
    if (code.includes("weak-password"))
        return t("auth.errors.weakPassword");
    if (code.includes("network"))
        return t("auth.errors.network");
    if (code.includes("popup-closed"))
        return t("auth.errors.popupClosed");
    return t("auth.errors.generic");
}
