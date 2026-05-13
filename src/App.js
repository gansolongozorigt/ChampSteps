import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// =============================================================================
// App v3 — Slate + Gold design system, mobile-first
// ⚠️  Logic/Firebase/auth бүгд хэвээр — зөвхөн UI шинэчлэгдсэн
// =============================================================================
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AddAchievementForm from "./components/AddAchievementForm";
import ChildProfileEditor from "./components/ChildProfileEditor";
import LoginPage from "./components/LoginPage";
import SubscriptionModal from "./components/SubscriptionModal";
import TimelineDashboard from "./components/TimelineDashboard";
import Toast from "./components/Toast";
import { useAchievements } from "./hooks/useAchievements";
import { usePracticeLogs } from "./hooks/usePracticeLogs";
import { useReflections } from "./hooks/useReflections";
import PracticeLogSection from "./components/PracticeLogSection";
import ReflectionSection from "./components/ReflectionSection";
import { TeacherInvitePanel, ParentLinkPanel } from "./components/InviteCode";
import CoachNotes from "./components/CoachNotes";
import { useAuth } from "./lib/auth";
import { createAchievement, createChild, createPracticeLog, createReflection, deletePracticeLog, deleteReflection, createInviteCode, useInviteCode, deleteAchievement, getChildrenForParent, getChildrenForTeacher, isFirebaseConfigured, updateChild as fbUpdateChild, } from "./lib/firebase";
import { loadLocalChild, saveLocalAchievements, saveLocalChild, } from "./lib/localStore";
import { exportPortfolio } from "./lib/pdfExport";
import { TIER_LIMITS } from "./types";
const makeInitialChild = (parentId) => ({
    childId: `child_${parentId.slice(0, 8)}_001`,
    parentId,
    teacherIds: [],
    name: "Хүүхэд",
    birthDate: "",
    bio: "",
    avatarUrl: undefined,
});
const seedAchievements = [];
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
export default function App() {
    const { user, loading: authLoading } = useAuth();
    if (authLoading)
        return _jsx(FullScreenLoader, {});
    if (!user)
        return _jsx(LoginPage, {});
    return _jsx(Dashboard, {});
}
function Dashboard() {
    const { t, i18n } = useTranslation();
    const { user, subscription, signOut } = useAuth();
    const [children, setChildren] = useState([]);
    const [activeChildIdx, setActiveChildIdx] = useState(0);
    const [loadingChildren, setLoadingChildren] = useState(true);
    const [activeSection, setActiveSection] = useState("achievements");
    const [showForm, setShowForm] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showSubscription, setShowSubscription] = useState(false);
    const [showAddChild, setShowAddChild] = useState(false);
    const [showPdfMenu, setShowPdfMenu] = useState(false);
    const [includeImages, setIncludeImages] = useState(true);
    const [toast, setToast] = useState(null);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [pdfTemplate, setPdfTemplate] = useState("official");
    const [editingAchievement, setEditingAchievement] = useState(null);
    const child = children[activeChildIdx];
    const tierLimits = TIER_LIMITS[subscription] ?? TIER_LIMITS.free;
    const { achievements, loading: loadingAch, error: achError, addLocal } = useAchievements(child?.childId ?? "", seedAchievements);
    const { logs: practiceLogs, addLocal: addLocalLog, removeLocal: removeLocalLog } = usePracticeLogs(child?.childId ?? "");
    const { reflections, addLocal: addLocalReflection, removeLocal: removeLocalReflection } = useReflections(child?.childId ?? "");
    useEffect(() => {
        async function load() {
            if (!user) {
                setLoadingChildren(false);
                return;
            }
            if (!isFirebaseConfigured) {
                const localChild = loadLocalChild(makeInitialChild(user.uid));
                setChildren([localChild]);
                setLoadingChildren(false);
                return;
            }
            try {
                let list = [];
                if (user.role === "teacher") {
                    list = await getChildrenForTeacher(user.uid);
                }
                else {
                    list = await getChildrenForParent(user.uid);
                    if (list.length === 0) {
                        const initial = makeInitialChild(user.uid);
                        await createChild({ ...initial, parentId: user.uid });
                        list = [initial];
                    }
                }
                setChildren(list);
            }
            catch (e) {
                console.error("[champstep] load children failed:", e);
            }
            finally {
                setLoadingChildren(false);
            }
        }
        load();
    }, [user]);
    useEffect(() => {
        if (achError)
            setToast({ kind: "error", message: t("status.errorLoading") });
    }, [achError, t]);
    async function handleAddAchievement(draft) {
        if (!child)
            return;
        if (tierLimits.maxAchievements !== -1 && achievements.length >= tierLimits.maxAchievements) {
            setShowSubscription(true);
            setToast({ kind: "info", message: `Үнэгүй эрхэд ${tierLimits.maxAchievements} бүртгэл хүртэл боломжтой.` });
            return;
        }
        if (isFirebaseConfigured) {
            try {
                await createAchievement(child.childId, draft);
                setShowForm(false);
                setToast({ kind: "success", message: t("status.saved") });
            }
            catch {
                setToast({ kind: "error", message: t("status.errorSaving") });
            }
            return;
        }
        const newItem = {
            id: crypto.randomUUID(),
            childId: child.childId,
            title: draft.title,
            date: draft.date,
            location: draft.location,
            category: draft.category,
            description: draft.description,
            awardType: draft.awardType,
            imageURLs: draft.images.map((f) => URL.createObjectURL(f)),
            createdAt: new Date().toISOString(),
        };
        addLocal(newItem);
        setShowForm(false);
        setToast({ kind: "success", message: t("status.saved") });
    }
    async function handleUpdateChild(next, avatarFile) {
        if (isFirebaseConfigured) {
            try {
                const saved = await fbUpdateChild(next, avatarFile);
                setChildren((prev) => prev.map((c) => c.childId === saved.childId ? saved : c));
                setToast({ kind: "success", message: t("status.savedProfile") });
            }
            catch {
                setToast({ kind: "error", message: t("status.errorSaving") });
            }
            return;
        }
        let nextWithAvatar = next;
        if (avatarFile) {
            try {
                const dataUrl = await fileToDataUrl(avatarFile);
                nextWithAvatar = { ...next, avatarUrl: dataUrl };
            }
            catch (e) {
                console.warn("[champstep] avatar read failed:", e);
            }
        }
        setChildren((prev) => prev.map((c) => c.childId === nextWithAvatar.childId ? nextWithAvatar : c));
        saveLocalChild(nextWithAvatar);
        setToast({ kind: "success", message: t("status.savedProfile") });
    }
    async function handleAddNewChild(name) {
        if (!user)
            return;
        if (children.length >= tierLimits.maxChildren) {
            setShowSubscription(true);
            setToast({ kind: "info", message: `Таны эрхэд ${tierLimits.maxChildren} хүүхэд хүртэл боломжтой.` });
            return;
        }
        const newChild = {
            childId: `child_${user.uid.slice(0, 8)}_${Date.now()}`,
            parentId: user.uid,
            teacherIds: [],
            name,
            birthDate: "",
            bio: "",
            avatarUrl: undefined,
        };
        if (isFirebaseConfigured)
            await createChild(newChild);
        setChildren((prev) => [...prev, newChild]);
        setActiveChildIdx(children.length);
        setShowAddChild(false);
        setToast({ kind: "success", message: `${name}-г нэмлээ.` });
    }
    async function handleDeleteAchievement(id) {
        if (isFirebaseConfigured) {
            try {
                await deleteAchievement(id);
                setToast({ kind: "success", message: "Бичлэг устгагдлаа." });
            }
            catch {
                setToast({ kind: "error", message: t("status.errorSaving") });
            }
            return;
        }
        const updated = achievements.filter((a) => a.id !== id);
        saveLocalAchievements(updated);
        setToast({ kind: "success", message: "Бичлэг устгагдлаа." });
    }
    async function handleAddPracticeLog(log) {
        if (!child)
            return;
        if (isFirebaseConfigured) {
            try {
                await createPracticeLog(child.childId, log);
            }
            catch {
                setToast({ kind: "error", message: t("status.errorSaving") });
            }
            return;
        }
        addLocalLog({ id: crypto.randomUUID(), childId: child.childId, ...log, createdAt: new Date().toISOString() });
    }
    async function handleAddReflection(r) {
        if (!child)
            return;
        if (isFirebaseConfigured) {
            try {
                await createReflection(child.childId, r);
            }
            catch {
                setToast({ kind: "error", message: t("status.errorSaving") });
            }
            return;
        }
        addLocalReflection({ id: crypto.randomUUID(), childId: child.childId, ...r, createdAt: new Date().toISOString() });
    }
    async function handleDeleteReflection(id) {
        if (isFirebaseConfigured) {
            try {
                await deleteReflection(id);
            }
            catch {
                setToast({ kind: "error", message: t("status.errorSaving") });
            }
            return;
        }
        removeLocalReflection(id);
    }
    async function handleDeletePracticeLog(id) {
        if (isFirebaseConfigured) {
            try {
                await deletePracticeLog(id);
            }
            catch {
                setToast({ kind: "error", message: t("status.errorSaving") });
            }
            return;
        }
        removeLocalLog(id);
    }
    async function handleDownloadPdf(template) {
        if (!child)
            return;
        if (!tierLimits.hasPdf) {
            setShowSubscription(true);
            setToast({ kind: "info", message: t("pdf.premiumRequired") });
            return;
        }
        setPdfBusy(true);
        try {
            const lang = i18n.language?.startsWith("en") ? "en" : "mn";
            await exportPortfolio(child, achievements, { t, template: template ?? pdfTemplate, language: lang, includeImages });
            setToast({ kind: "success", message: t("pdf.success") });
        }
        catch {
            setToast({ kind: "error", message: t("pdf.error") });
        }
        finally {
            setPdfBusy(false);
        }
    }
    async function handleSignOut() {
        if (!isFirebaseConfigured)
            saveLocalAchievements([]);
        await signOut();
    }
    if (loadingChildren)
        return _jsx(FullScreenLoader, {});
    if (!child) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-stone-50", children: _jsx("p", { className: "text-stone-500", children: "\u0425\u04AF\u04AF\u0445\u044D\u0434 \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439." }) }));
    }
    const canAddChild = user?.role === "parent" && children.length < tierLimits.maxChildren;
    const isPremium = subscription !== "free";
    const maxAch = tierLimits.maxAchievements;
    const achCount = achievements.length;
    const showLimitWarning = !isPremium && maxAch > 0 && achCount >= Math.floor(maxAch * 0.8);
    const navItems = [
        {
            id: "achievements",
            label: t("nav.achievements") || "Амжилт",
            icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" }) })),
        },
        {
            id: "practice",
            label: t("nav.practice") || "Бэлтгэл",
            icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" }) })),
        },
        {
            id: "reflection",
            label: t("nav.reflection") || "Сэтгэл",
            icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" }) })),
        },
        {
            id: "coach",
            label: t("nav.coach") || "Багш",
            icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" }) })),
        },
        {
            id: "ai",
            label: "AI",
            icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21a48.309 48.309 0 01-8.135-1.587c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" }) })),
        },
    ];
    // Хүүхэд байхгүй үед — энгийн хуудас
    if (!loadingChildren && !child) {
        return (_jsxs("div", { className: "min-h-screen bg-stone-100 flex flex-col items-center justify-center gap-4 p-8 text-center", children: [_jsx("div", { className: "w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center", children: _jsx("svg", { className: "w-6 h-6 text-white", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2.5, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 13h4v8H3v-8zm6-6h4v14H9V7zm6-4h4v18h-4V3z" }) }) }), _jsxs("p", { className: "text-[20px] font-bold text-stone-900", children: ["Champ", _jsx("span", { className: "text-amber-500", children: "Step" })] }), _jsx("p", { className: "text-stone-500 text-sm max-w-xs", children: user?.role === "teacher"
                        ? "Одоогоор шавь байхгүй байна. Эцэг эхэд урилгын код илгээгээрэй."
                        : "Хүүхэд олдсонгүй." }), _jsx("button", { onClick: signOut, className: "mt-2 px-6 py-2.5 rounded-xl bg-stone-800 text-white text-sm hover:bg-red-900 transition", children: "\u21AA \u0413\u0430\u0440\u0430\u0445" })] }));
    }
    return (_jsxs("div", { className: "flex flex-col min-h-screen bg-stone-100 font-sans", children: [_jsxs("header", { className: "sticky top-0 z-40 bg-stone-950 print:hidden", children: [_jsxs("div", { className: "px-4 py-2.5 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("svg", { width: "22", height: "22", viewBox: "0 0 48 48", fill: "none", "aria-hidden": "true", children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "hg1", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#d97706", stopOpacity: "0.25" }), _jsx("stop", { offset: "100%", stopColor: "#d97706", stopOpacity: "0.12" })] }), _jsxs("linearGradient", { id: "hg2", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#d97706", stopOpacity: "0.65" }), _jsx("stop", { offset: "100%", stopColor: "#b45309", stopOpacity: "0.5" })] }), _jsxs("linearGradient", { id: "hg3", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#fbbf24" }), _jsx("stop", { offset: "100%", stopColor: "#92400e" })] })] }), _jsx("rect", { x: "4", y: "32", width: "10", height: "12", rx: "2.5", fill: "url(#hg1)" }), _jsx("rect", { x: "17", y: "22", width: "10", height: "22", rx: "2.5", fill: "url(#hg2)" }), _jsx("rect", { x: "30", y: "10", width: "10", height: "34", rx: "2.5", fill: "url(#hg3)" }), _jsx("circle", { cx: "35", cy: "7", r: "5.5", fill: "white", fillOpacity: "0.1" }), _jsx("path", { d: "M35 4.2L36.1 6.7H38.7L36.6 8.2L37.4 10.8L35 9.3L32.6 10.8L33.4 8.2L31.3 6.7H33.9Z", fill: "#fbbf24" })] }), _jsxs("span", { className: "text-[15px] font-bold tracking-tight leading-none", children: [_jsx("span", { className: "text-white", children: "Champ" }), _jsx("span", { style: { background: "linear-gradient(135deg,#fbbf24 0%,#d97706 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }, children: "Step" })] }), _jsx("span", { className: `text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${subscription === "family" ? "bg-blue-950 text-blue-300 border-blue-700" :
                                            subscription === "master" ? "bg-violet-950 text-violet-300 border-violet-700" :
                                                subscription === "coach" ? "bg-amber-950 text-amber-400 border-amber-700" :
                                                    "bg-stone-800 text-stone-500 border-stone-700"}`, children: subscription === "family" ? "ГЭР БҮЛ" :
                                            subscription === "master" ? "МАСТЕР" :
                                                subscription === "coach" ? "★ БАГШ" : "ҮНЭГҮЙ" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(LanguageChip, {}), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setShowPdfMenu(!showPdfMenu), disabled: pdfBusy, className: "flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700 hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-50", children: [pdfBusy ? (_jsxs("svg", { className: "w-3 h-3 animate-spin", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })] })) : (_jsx("svg", { className: "w-3 h-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" }) })), "PDF"] }), showPdfMenu && (_jsxs("div", { className: "absolute right-0 top-9 z-50 w-48 rounded-xl border border-stone-200 bg-white shadow-xl overflow-hidden", children: [[
                                                        { id: "official", label: "📄 Албан ёсны" },
                                                        { id: "kids", label: "🎨 Хүүхэдлэг" },
                                                        { id: "gold", label: "✨ Алтлаг" },
                                                    ].map((tmpl) => (_jsx("button", { onClick: () => { setPdfTemplate(tmpl.id); setShowPdfMenu(false); handleDownloadPdf(tmpl.id); }, className: `w-full px-4 py-2.5 text-left text-[12px] transition hover:bg-stone-50 ${pdfTemplate === tmpl.id ? "font-semibold text-stone-900 bg-amber-50" : "text-stone-600"}`, children: tmpl.label }, tmpl.id))), _jsx("div", { className: "border-t border-stone-100 px-4 py-2.5", children: _jsxs("label", { className: "flex items-center gap-2 cursor-pointer select-none", onClick: () => setIncludeImages(!includeImages), children: [_jsx("div", { className: `w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${includeImages ? "bg-amber-500 border-amber-500" : "bg-white border-stone-300"}`, children: includeImages && _jsx("svg", { className: "w-2.5 h-2.5 text-white", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 3, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) }) }), _jsx("span", { className: "text-[11px] text-stone-600", children: "\u0417\u0443\u0440\u0430\u0433 \u043E\u0440\u0443\u0443\u043B\u0430\u0445" })] }) })] }))] }), _jsx("button", { onClick: () => setShowSubscription(true), className: "text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-stone-800 text-amber-400 border border-amber-800/50 hover:bg-stone-700 active:scale-95 transition-all", title: t("nav.subscription"), children: "\u2605" }), _jsx("button", { onClick: () => setShowProfile(true), className: "relative w-7 h-7 rounded-full overflow-visible border-2 border-stone-700 hover:border-amber-500 transition-colors shrink-0", children: _jsx("div", { className: "w-full h-full rounded-full overflow-hidden", children: child.avatarUrl ? _jsx("img", { src: child.avatarUrl, alt: child.name, className: "w-full h-full object-cover" }) : _jsx("div", { className: "w-full h-full bg-amber-600 flex items-center justify-center text-[11px] font-bold text-white", children: child.name.slice(0, 1).toUpperCase() }) }) }), _jsx("button", { onClick: signOut, className: "text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700 hover:bg-red-900/50 hover:text-red-400 active:scale-95 transition-all", children: "\u0413\u0430\u0440\u0430\u0445" })] })] }), _jsxs("div", { className: "md:hidden bg-stone-900 px-3 pb-2 flex items-center gap-2 overflow-x-auto scrollbar-hide border-b border-stone-800", children: [children.map((c, i) => (_jsxs("button", { onClick: () => setActiveChildIdx(i), className: `flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-all ${i === activeChildIdx ? "bg-amber-600 text-white" : "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200"}`, children: [c.avatarUrl ? _jsx("img", { src: c.avatarUrl, alt: c.name, className: "w-4 h-4 rounded-full object-cover" }) : _jsx("span", { className: "w-4 h-4 rounded-full bg-stone-600 text-[8px] font-bold text-white flex items-center justify-center", children: c.name.slice(0, 1).toUpperCase() }), c.name] }, c.childId))), canAddChild && (_jsxs("button", { onClick: () => setShowAddChild(true), className: "flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 text-stone-500 border border-dashed border-stone-700 hover:border-stone-500 hover:text-stone-300 transition-colors", children: ["+ ", t("children.addChild")] }))] })] }), !isFirebaseConfigured && (_jsxs("div", { className: "bg-amber-100 px-4 py-2 text-center text-[11px] text-amber-800 print:hidden", children: ["\u26A0\uFE0F ", t("status.offlineBanner")] })), _jsxs("div", { className: "flex flex-col md:flex-row flex-1 overflow-hidden", children: [_jsxs("aside", { className: "hidden md:flex flex-col w-56 bg-stone-950 border-r border-stone-800 shrink-0", children: [_jsxs("div", { className: "px-3 pt-4 pb-3 border-b border-stone-800", children: [_jsx("p", { className: "text-[9px] font-semibold uppercase tracking-widest text-stone-600 mb-2", children: t("children.title") || "Хүүхдүүд" }), _jsxs("div", { className: "space-y-1", children: [children.map((c, i) => (_jsxs("button", { onClick: () => setActiveChildIdx(i), className: `w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${i === activeChildIdx ? "bg-amber-600 text-white" : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"}`, children: [c.avatarUrl ? _jsx("img", { src: c.avatarUrl, alt: c.name, className: "w-6 h-6 rounded-full object-cover shrink-0" }) : _jsx("span", { className: "w-6 h-6 rounded-full bg-stone-700 text-[9px] font-bold text-stone-300 flex items-center justify-center shrink-0", children: c.name.slice(0, 1).toUpperCase() }), _jsx("span", { className: "text-[12px] font-medium truncate", children: c.name })] }, c.childId))), canAddChild && (_jsxs("button", { onClick: () => setShowAddChild(true), className: "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-stone-600 border border-dashed border-stone-800 hover:border-stone-600 hover:text-stone-400 transition-colors text-[11px]", children: ["+ ", t("children.addChild")] }))] })] }), _jsx("nav", { className: "px-3 py-3 flex-1", children: navItems.map((item) => {
                                    const active = activeSection === item.id;
                                    const colors = {
                                        achievements: "bg-amber-600/15 text-amber-400 border-l-2 border-amber-500",
                                        practice: "bg-blue-600/15 text-blue-400 border-l-2 border-blue-500",
                                        reflection: "bg-rose-600/15 text-rose-400 border-l-2 border-rose-500",
                                        coach: "bg-emerald-600/15 text-emerald-400 border-l-2 border-emerald-500",
                                        ai: "bg-violet-600/15 text-violet-400 border-l-2 border-violet-500",
                                    };
                                    return (_jsxs("button", { onClick: () => setActiveSection(item.id), className: `w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg mb-0.5 text-left transition-all ${active ? colors[item.id] : "text-stone-500 hover:bg-stone-800 hover:text-stone-300"}`, children: [_jsx("span", { className: "w-5 h-5 flex items-center justify-center shrink-0", children: item.icon }), _jsx("span", { className: "text-[12px] font-medium", children: item.label })] }, item.id));
                                }) }), _jsx("div", { className: "px-3 pb-4 border-t border-stone-800 pt-3", children: isPremium ? (_jsxs("div", { className: "rounded-lg bg-stone-900 border border-stone-800 px-3 py-2.5", children: [_jsx("p", { className: "text-[10px] font-semibold text-amber-400 mb-1", children: subscription === "family" ? "★ Гэр бүл" : subscription === "master" ? "★ Мастер" : "★ Багш" }), _jsx("p", { className: "text-[10px] text-stone-500", children: "\u0425\u044F\u0437\u0433\u0430\u0430\u0440\u0433\u04AF\u0439 \u0430\u043C\u0436\u0438\u043B\u0442 \u00B7 PDF \u00B7 AI" })] })) : (_jsxs("div", { className: "rounded-lg bg-stone-900 border border-stone-800 px-3 py-2.5", children: [_jsx("div", { className: "flex items-center justify-between mb-1.5", children: _jsxs("span", { className: "text-[10px] text-stone-400 font-medium", children: ["\u04AE\u041D\u042D\u0413\u04AE\u0419 \u00B7 ", achCount, "/", maxAch] }) }), _jsx("div", { className: "h-1 bg-stone-800 rounded-full overflow-hidden mb-2", children: _jsx("div", { className: `h-full rounded-full transition-all ${showLimitWarning ? "bg-gradient-to-r from-amber-500 to-red-500" : "bg-stone-600"}`, style: { width: `${Math.min(100, (achCount / maxAch) * 100)}%` } }) }), _jsx("button", { onClick: () => setShowSubscription(true), className: "w-full text-[11px] font-bold py-1.5 rounded-md bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors", children: "\u2B06 Upgrade" })] })) })] }), !loadingChildren && !child && (_jsxs("div", { className: "flex flex-col items-center justify-center flex-grow gap-4 p-8 text-center", children: [_jsx("div", { className: "text-4xl", children: "\uD83C\uDFEB" }), _jsx("p", { className: "text-stone-600 text-sm", children: user?.role === "teacher"
                                    ? "Одоогоор шавь байхгүй байна. Эцэг эхэд урилгын код илгээгээрэй."
                                    : "Хүүхэд олдсонгүй." }), _jsx("button", { onClick: signOut, className: "mt-4 px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-sm hover:bg-red-900/50 hover:text-red-400 transition", children: "\u21AA \u0413\u0430\u0440\u0430\u0445" })] })), _jsxs("main", { className: "flex-1 overflow-y-auto pb-20 md:pb-6 print:p-0", children: [user?.role === "teacher" && (_jsx("div", { className: "bg-stone-900 px-4 py-2 text-center text-[11px] text-amber-400 print:hidden", children: "\uD83C\uDFEB \u0411\u0430\u0433\u0448\u0438\u0439\u043D \u0433\u043E\u0440\u0438\u043C \u2014 \u0448\u0430\u0432\u044C \u043D\u0430\u0440\u044B\u043D \u0431\u04AF\u0440\u0442\u0433\u044D\u043B\u0438\u0439\u0433 \u0443\u0434\u0438\u0440\u0434\u0430\u0436 \u0431\u0430\u0439\u043D\u0430" })), activeSection === "achievements" && (_jsx(TimelineDashboard, { child: child, achievements: achievements, onAddClick: () => setShowForm(true), onEditProfile: () => setShowProfile(true), onEditAchievement: (a) => setEditingAchievement(a), onDeleteAchievement: handleDeleteAchievement })), activeSection === "practice" && (_jsxs("div", { className: "px-4 py-6 max-w-3xl mx-auto", children: [_jsx(SectionHeader, { title: t("practice.title") || "Бэлтгэлийн тэмдэглэл", subtitle: child.name }), _jsx(PracticeLogSection, { childId: child.childId, logs: practiceLogs, onAdd: handleAddPracticeLog, onDelete: handleDeletePracticeLog })] })), activeSection === "reflection" && (_jsxs("div", { className: "px-4 py-6 max-w-3xl mx-auto", children: [_jsx(SectionHeader, { title: t("reflection.title") || "Хүүхдийн сэтгэлзүйн тэмдэглэл", subtitle: child.name }), user?.role === "parent" ? (_jsx(ReflectionSection, { childId: child.childId, reflections: reflections, onAdd: handleAddReflection, onDelete: handleDeleteReflection })) : (_jsx("div", { className: "text-center py-12 text-stone-400 text-sm", children: "\u042D\u043D\u044D \u0445\u044D\u0441\u044D\u0433 \u0437\u04E9\u0432\u0445\u04E9\u043D \u044D\u0446\u044D\u0433 \u044D\u0445\u044D\u0434 \u0445\u0430\u0440\u0430\u0433\u0434\u0430\u043D\u0430." }))] })), activeSection === "coach" && (_jsxs("div", { className: "px-4 py-6 max-w-3xl mx-auto", children: [_jsx(SectionHeader, { title: "\u0411\u0430\u0433\u0448\u0438\u0439\u043D \u0437\u04E9\u0432\u043B\u04E9\u0433\u04E9\u04E9", subtitle: child.name }), _jsxs("div", { className: "grid gap-4", children: [_jsx(CoachNotes, { childId: child.childId, childName: child.name, teacherId: user?.uid ?? "", teacherName: user?.displayName ?? "Багш", isTeacher: user?.role === "teacher" }), _jsxs("div", { className: "border-t border-stone-100 pt-4", children: [user?.role === "teacher" && (_jsx(TeacherInvitePanel, { teacherId: user.uid, teacherName: user.displayName, onCreateCode: createInviteCode })), user?.role === "parent" && child && (_jsx(ParentLinkPanel, { childId: child.childId, childName: child.name, onUseCode: useInviteCode }))] })] })] })), activeSection === "ai" && (_jsxs("div", { className: "px-4 py-6 max-w-3xl mx-auto", children: [_jsx(SectionHeader, { title: t("ai.title"), subtitle: child.name }), _jsxs("div", { className: "bg-indigo-50 rounded-2xl p-6 border border-indigo-100 text-center", children: [_jsx("div", { className: "w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3", children: _jsx("svg", { className: "w-6 h-6 text-indigo-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" }) }) }), _jsx("p", { className: "text-[13px] font-medium text-indigo-900 mb-1", children: t("ai.title") }), _jsx("p", { className: "text-[12px] text-indigo-500 mb-4 leading-relaxed", children: t("ai.subtitle") }), _jsx("button", { onClick: () => setActiveSection("achievements"), className: "text-[12px] font-medium px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all", children: t("ai.viewAchievements") })] })] }))] })] }), _jsxs("nav", { className: "md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 print:hidden", style: { paddingBottom: "env(safe-area-inset-bottom)" }, children: [!isPremium && (_jsxs("div", { className: "bg-stone-950 px-3 py-2 flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-[10px] text-stone-400", children: showLimitWarning
                                    ? _jsxs("span", { className: "text-amber-400 font-medium", children: ["\u26A0\uFE0F ", achCount, "/", maxAch, " \u2014 \u0445\u044F\u0437\u0433\u0430\u0430\u0440\u0442 \u043E\u0439\u0440\u0442\u043B\u043E\u043E"] })
                                    : _jsxs(_Fragment, { children: [_jsx("span", { className: "font-medium text-stone-300", children: "\u04AE\u041D\u042D\u0413\u04AE\u0419" }), " \u00B7 ", achCount, "/", maxAch, " \u0430\u043C\u0436\u0438\u043B\u0442"] }) }), _jsx("button", { onClick: () => setShowSubscription(true), className: "text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-amber-500 text-stone-950 hover:bg-amber-400 active:scale-95 transition-all shrink-0", children: "\u2B06 Upgrade" })] })), _jsx("div", { className: "flex items-stretch", children: navItems.map((item) => {
                            const active = activeSection === item.id;
                            const colors = { achievements: "text-amber-500", practice: "text-blue-500", reflection: "text-rose-500", coach: "text-emerald-500", ai: "text-violet-500" };
                            const lines = { achievements: "bg-amber-500", practice: "bg-blue-500", reflection: "bg-rose-500", coach: "bg-emerald-500", ai: "bg-violet-500" };
                            return (_jsxs("button", { onClick: () => setActiveSection(item.id), className: `relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${active ? colors[item.id] : "text-stone-400 hover:text-stone-500"}`, children: [_jsx("span", { className: `transition-transform ${active ? "scale-110" : ""}`, children: item.icon }), _jsx("span", { className: `text-[9px] font-medium leading-none ${active ? colors[item.id] : "text-stone-400"}`, children: item.label }), active && _jsx("span", { className: `absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${lines[item.id]}` })] }, item.id));
                        }) })] }), activeSection === "achievements" && (_jsx("button", { type: "button", onClick: () => setShowForm(true), "aria-label": t("app.addAchievement"), className: "fixed z-30 bg-stone-950 text-white rounded-full shadow-lg shadow-stone-900/30 hover:bg-stone-800 active:scale-95 transition-all print:hidden flex items-center justify-center md:bottom-6 md:right-6", style: { bottom: "calc(env(safe-area-inset-bottom) + 72px)", right: 16, width: 52, height: 52 }, children: _jsx("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2.5, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.5v15m7.5-7.5h-15" }) }) })), loadingAch && isFirebaseConfigured && (_jsx("div", { className: "fixed top-28 inset-x-0 z-30 flex justify-center print:hidden", children: _jsx("div", { className: "rounded-full bg-white px-4 py-1.5 text-[11px] text-stone-600 shadow border border-stone-100", children: t("status.loading") }) })), showForm && (_jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 backdrop-blur-sm p-2 sm:items-center sm:p-4 print:hidden", onClick: () => setShowForm(false), children: _jsx("div", { onClick: (e) => e.stopPropagation(), className: "w-full max-w-2xl", children: _jsx(AddAchievementForm, { childId: child.childId, childName: child.name, onCancel: () => setShowForm(false), onSubmit: handleAddAchievement }) }) })), editingAchievement && (_jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 backdrop-blur-sm p-2 sm:items-center sm:p-4 print:hidden", onClick: () => setEditingAchievement(null), children: _jsx("div", { onClick: (e) => e.stopPropagation(), className: "w-full max-w-2xl", children: _jsx(AddAchievementForm, { childId: child.childId, childName: child.name, initialDraft: editingAchievement, onCancel: () => setEditingAchievement(null), onSubmit: async (draft) => {
                            if (isFirebaseConfigured) {
                                try {
                                    const { updateAchievement } = await import("./lib/firebase");
                                    await updateAchievement(editingAchievement.id, { title: draft.title, date: draft.date, location: draft.location, category: draft.category, description: draft.description, awardType: draft.awardType });
                                    setEditingAchievement(null);
                                    setToast({ kind: "success", message: "Бичлэг шинэчлэгдлээ." });
                                }
                                catch {
                                    setToast({ kind: "error", message: t("status.errorSaving") });
                                }
                            }
                            else {
                                setEditingAchievement(null);
                                setToast({ kind: "success", message: "Бичлэг шинэчлэгдлээ." });
                            }
                        } }) }) })), showProfile && _jsx(ChildProfileEditor, { child: child, onClose: () => setShowProfile(false), onSave: handleUpdateChild }), showSubscription && _jsx(SubscriptionModal, { onClose: () => setShowSubscription(false) }), showAddChild && _jsx(AddChildModal, { onClose: () => setShowAddChild(false), onAdd: handleAddNewChild }), showPdfMenu && _jsx("div", { className: "fixed inset-0 z-30", onClick: () => setShowPdfMenu(false) }), toast && _jsx(Toast, { kind: toast.kind, message: toast.message, onClose: () => setToast(null) })] }));
}
function SectionHeader({ title, subtitle }) {
    return (_jsxs("div", { className: "mb-5", children: [subtitle && _jsx("p", { className: "text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1", children: subtitle }), _jsx("h2", { className: "text-xl font-semibold text-stone-900", children: title })] }));
}
function LanguageChip() {
    const { i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? i18n.language;
    return (_jsx("button", { onClick: () => i18n.changeLanguage(lang === "mn" ? "en" : "mn"), className: "text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700 hover:bg-stone-700 active:scale-95 transition-all", children: lang === "mn" ? "MN" : "EN" }));
}
function AddChildModal({ onClose, onAdd }) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4", onClick: onClose, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), className: "w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl", children: [_jsx("h2", { className: "text-lg font-semibold text-stone-900 mb-4", children: t("children.addChild") }), _jsx("input", { value: name, onChange: (e) => setName(e.target.value), onKeyDown: (e) => e.key === "Enter" && name.trim() && onAdd(name.trim()), placeholder: "\u0425\u04AF\u04AF\u0445\u0434\u0438\u0439\u043D \u043D\u044D\u0440", className: "w-full rounded-xl border border-stone-200 px-4 py-2.5 text-[13px] text-stone-900 focus:outline-none focus:border-stone-400 transition-colors", autoFocus: true }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-[13px] text-stone-500 hover:bg-stone-100 rounded-lg transition-colors", children: t("form.actions.cancel") }), _jsx("button", { onClick: () => name.trim() && onAdd(name.trim()), disabled: !name.trim(), className: "px-4 py-2 text-[13px] font-medium bg-stone-950 text-white rounded-lg hover:bg-stone-800 disabled:opacity-40 active:scale-95 transition-all", children: t("children.addChild") })] })] }) }));
}
function FullScreenLoader() {
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-stone-50", children: _jsxs("div", { className: "flex items-center gap-3 text-[13px] text-stone-500", children: [_jsxs("svg", { className: "w-4 h-4 animate-spin text-amber-600", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })] }), "ChampStep\u2026"] }) }));
}
