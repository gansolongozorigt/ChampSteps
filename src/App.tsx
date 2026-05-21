// =============================================================================
// App v3 — Slate + Gold design system, mobile-first
// ⚠️  Logic/Firebase/auth бүгд хэвээр — зөвхөн UI шинэчлэгдсэн
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import AddAchievementForm from "./components/AddAchievementForm";
import ChildProfileEditor from "./components/ChildProfileEditor";
import LoginPage from "./components/LoginPage";
import SubscriptionModal from "./components/SubscriptionModal";
import TimelineDashboard from "./components/TimelineDashboard";
import Toast, { type ToastKind } from "./components/Toast";
import { useAchievements } from "./hooks/useAchievements";
import { usePracticeLogs } from "./hooks/usePracticeLogs";
import { useReflections } from "./hooks/useReflections";
import PracticeLogSection from "./components/PracticeLogSection";
import ReflectionSection from "./components/ReflectionSection";
import { TeacherInvitePanel, ParentLinkPanel } from "./components/InviteCode";
import { useAuth } from "./lib/auth";
import {
  createAchievement,
  createChild,
  createPracticeLog,
  createReflection,
  deletePracticeLog,
  deleteReflection,
  createInviteCode,
  useInviteCode,
  deleteAchievement,
  getChildrenForParent,
  getChildrenForTeacher,
  isFirebaseConfigured,
  updateChild as fbUpdateChild,
} from "./lib/firebase";
import {
  loadLocalChild,
  saveLocalAchievements,
  saveLocalChild,
} from "./lib/localStore";
import { exportPortfolio } from "./lib/pdfExport";
import type { Achievement, AchievementDraft, Child, SubscriptionTier } from "./types";
import type { PdfTemplate } from "./lib/pdfExport";
import { TIER_LIMITS } from "./types";

type ToastState = { kind: ToastKind; message: string } | null;
type NavSection = "achievements" | "practice" | "reflection" | "coach" | "pdf";

const makeInitialChild = (parentId: string): Child => ({
  childId: `child_${parentId.slice(0, 8)}_001`,
  parentId,
  teacherIds: [],
  name: "Хүүхэд",
  birthDate: "",
  bio: "",
  avatarUrl: undefined,
});

const seedAchievements: Achievement[] = [];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <FullScreenLoader />;
  if (!user) return <LoginPage />;
  return <Dashboard />;
}

function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, subscription, signOut } = useAuth();

  const [children, setChildren] = useState<Child[]>([]);
  const [activeChildIdx, setActiveChildIdx] = useState(0);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [activeSection, setActiveSection] = useState<NavSection>("achievements");

  const mainRef = useRef<HTMLElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>("official");
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);

  const child = children[activeChildIdx];
  const tierLimits = TIER_LIMITS[subscription as SubscriptionTier] ?? TIER_LIMITS.free;

  const { achievements, loading: loadingAch, error: achError, addLocal } =
    useAchievements(child?.childId ?? "", seedAchievements);
  const { logs: practiceLogs, addLocal: addLocalLog, removeLocal: removeLocalLog } =
    usePracticeLogs(child?.childId ?? "");
  const { reflections, addLocal: addLocalReflection, removeLocal: removeLocalReflection } =
    useReflections(child?.childId ?? "");

  useEffect(() => {
    async function load() {
      if (!user) return;
      if (!isFirebaseConfigured) {
        const localChild = loadLocalChild(makeInitialChild(user.uid));
        setChildren([localChild]);
        setLoadingChildren(false);
        return;
      }
      try {
        let list: Child[] = [];
        if (user.role === "teacher") {
          list = await getChildrenForTeacher(user.uid);
        } else {
          list = await getChildrenForParent(user.uid);
          if (list.length === 0) {
            const initial = makeInitialChild(user.uid);
            await createChild({ ...initial, parentId: user.uid });
            list = [initial];
          }
        }
        setChildren(list);
      } catch (e) {
        console.error("[champstep] load children failed:", e);
      } finally {
        setLoadingChildren(false);
      }
    }
    load();
  }, [user]);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [activeSection]);

  useEffect(() => {
    if (achError) setToast({ kind: "error", message: t("status.errorLoading") });
  }, [achError, t]);

  useEffect(() => {
    if (!showUserMenu) return;
    function handle(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showUserMenu]);

  async function handleAddAchievement(draft: AchievementDraft) {
    if (!child) return;
    if (tierLimits.maxAchievements !== -1 && achievements.length >= tierLimits.maxAchievements) {
      setShowSubscription(true);
      setToast({ kind: "info", message: t("status.freeLimit", { max: tierLimits.maxAchievements }) });
      return;
    }
    if (isFirebaseConfigured) {
      try {
        await createAchievement(child.childId, draft);
        setShowForm(false);
        setToast({ kind: "success", message: t("status.saved") });
      } catch {
        setToast({ kind: "error", message: t("status.errorSaving") });
      }
      return;
    }
    const newItem: Achievement = {
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

  async function handleUpdateChild(next: Child, avatarFile?: File) {
    if (isFirebaseConfigured) {
      try {
        const saved = await fbUpdateChild(next, avatarFile);
        setChildren((prev) => prev.map((c) => c.childId === saved.childId ? saved : c));
        setToast({ kind: "success", message: t("status.savedProfile") });
      } catch {
        setToast({ kind: "error", message: t("status.errorSaving") });
      }
      return;
    }
    let nextWithAvatar = next;
    if (avatarFile) {
      try {
        const dataUrl = await fileToDataUrl(avatarFile);
        nextWithAvatar = { ...next, avatarUrl: dataUrl };
      } catch (e) {
        console.warn("[champstep] avatar read failed:", e);
      }
    }
    setChildren((prev) => prev.map((c) => c.childId === nextWithAvatar.childId ? nextWithAvatar : c));
    saveLocalChild(nextWithAvatar);
    setToast({ kind: "success", message: t("status.savedProfile") });
  }

  async function handleAddNewChild(name: string) {
    if (!user) return;
    if (children.length >= tierLimits.maxChildren) {
      setShowSubscription(true);
      setToast({ kind: "info", message: t("status.childLimit", { max: tierLimits.maxChildren }) });
      return;
    }
    const newChild: Child = {
      childId: `child_${user.uid.slice(0, 8)}_${Date.now()}`,
      parentId: user.uid,
      teacherIds: [],
      name,
      birthDate: "",
      bio: "",
      avatarUrl: undefined,
    };
    if (isFirebaseConfigured) await createChild(newChild);
    setChildren((prev) => [...prev, newChild]);
    setActiveChildIdx(children.length);
    setShowAddChild(false);
    setToast({ kind: "success", message: t("status.childAdded", { name }) });
  }

  async function handleDeleteAchievement(id: string) {
    if (isFirebaseConfigured) {
      try {
        await deleteAchievement(id);
        setToast({ kind: "success", message: t("status.deleted") });
      } catch {
        setToast({ kind: "error", message: t("status.errorSaving") });
      }
      return;
    }
    const updated = achievements.filter((a) => a.id !== id);
    saveLocalAchievements(updated);
    setToast({ kind: "success", message: t("status.deleted") });
  }

  async function handleAddPracticeLog(log: { date: string; duration: number; content: string }) {
    if (!child) return;
    if (isFirebaseConfigured) {
      try { await createPracticeLog(child.childId, log); }
      catch { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    addLocalLog({ id: crypto.randomUUID(), childId: child.childId, ...log, createdAt: new Date().toISOString() });
  }

  async function handleAddReflection(r: { date: string; mood: 1|2|3|4|5; content: string; parentNote?: string }) {
    if (!child) return;
    if (isFirebaseConfigured) {
      try { await createReflection(child.childId, r); }
      catch { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    addLocalReflection({ id: crypto.randomUUID(), childId: child.childId, ...r, createdAt: new Date().toISOString() });
  }

  async function handleDeleteReflection(id: string) {
    if (isFirebaseConfigured) {
      try { await deleteReflection(id); }
      catch { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    removeLocalReflection(id);
  }

  async function handleDeletePracticeLog(id: string) {
    if (isFirebaseConfigured) {
      try { await deletePracticeLog(id); }
      catch { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    removeLocalLog(id);
  }

  async function handleDownloadPdf(template?: PdfTemplate) {
    if (!child) return;
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
    } catch {
      setToast({ kind: "error", message: t("pdf.error") });
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleSignOut() {
    if (!isFirebaseConfigured) saveLocalAchievements([]);
    await signOut();
  }

  if (loadingChildren) return <FullScreenLoader />;
  if (!child) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-500">{t("status.childNotFound")}</p>
      </div>
    );
  }

  const canAddChild = user?.role === "parent" && children.length < tierLimits.maxChildren;
  const isPremium = subscription !== "free";
  const maxAch = tierLimits.maxAchievements;
  const achCount = achievements.length;
  const showLimitWarning = !isPremium && maxAch > 0 && achCount >= Math.floor(maxAch * 0.8);

  const navItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    {
      id: "achievements",
      label: t("nav.achievements") || "Амжилт",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
        </svg>
      ),
    },
    {
      id: "practice",
      label: t("nav.practice") || "Бэлтгэл",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "reflection",
      label: t("nav.reflection") || "Сэтгэл",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      ),
    },
    {
      id: "coach",
      label: t("nav.coach") || "Багш",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
        </svg>
      ),
    },
    {
      id: "pdf",
      label: t("nav.pdf") || "PDF",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-stone-100 font-sans">

      {/* TOP BAR — мобайл + desktop header */}
      <header className="sticky top-0 z-40 bg-stone-950 print:hidden">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Gradient лого */}
            <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706" stopOpacity="0.25"/><stop offset="100%" stopColor="#d97706" stopOpacity="0.12"/></linearGradient>
                <linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706" stopOpacity="0.65"/><stop offset="100%" stopColor="#b45309" stopOpacity="0.5"/></linearGradient>
                <linearGradient id="hg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24"/><stop offset="100%" stopColor="#92400e"/></linearGradient>
              </defs>
              <rect x="4" y="32" width="10" height="12" rx="2.5" fill="url(#hg1)"/>
              <rect x="17" y="22" width="10" height="22" rx="2.5" fill="url(#hg2)"/>
              <rect x="30" y="10" width="10" height="34" rx="2.5" fill="url(#hg3)"/>
              <circle cx="35" cy="7" r="5.5" fill="white" fillOpacity="0.1"/>
              <path d="M35 4.2L36.1 6.7H38.7L36.6 8.2L37.4 10.8L35 9.3L32.6 10.8L33.4 8.2L31.3 6.7H33.9Z" fill="#fbbf24"/>
            </svg>
            <span className="text-[15px] font-bold tracking-tight leading-none">
              <span className="text-white">Champ</span>
              <span style={{ background:"linear-gradient(135deg,#fbbf24 0%,#d97706 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Step</span>
            </span>
            <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
              subscription === "family" ? "bg-blue-950 text-blue-300 border-blue-700" :
              subscription === "master" ? "bg-violet-950 text-violet-300 border-violet-700" :
              subscription === "coach"  ? "bg-amber-950 text-amber-400 border-amber-700" :
              "bg-stone-800 text-stone-500 border-stone-700"
            }`}>
              {subscription === "family" ? t("sub.tierNames.family").toUpperCase() :
               subscription === "master" ? t("sub.tierNames.master").toUpperCase() :
               subscription === "coach"  ? `★ ${t("sub.tierNames.coach").toUpperCase()}` : t("sub.tierNames.free").toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageChip />
            <button onClick={() => setShowSubscription(true)} className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-stone-800 text-amber-400 border border-amber-800/50 hover:bg-stone-700 active:scale-95 transition-all" title={t("nav.subscription")}>★</button>
            <div ref={userMenuRef} className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="relative w-7 h-7 rounded-full overflow-visible border-2 border-stone-700 hover:border-amber-500 transition-colors shrink-0">
                <div className="w-full h-full rounded-full overflow-hidden">
                  {child.avatarUrl ? <img src={child.avatarUrl} alt={child.name} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-amber-600 flex items-center justify-center text-[11px] font-bold text-white">{child.name.slice(0,1).toUpperCase()}</div>}
                </div>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-stone-900 border border-stone-800 shadow-xl z-50 overflow-hidden">
                  {user?.email && (
                    <div className="px-3 py-2.5 border-b border-stone-800">
                      <p className="text-[10px] text-stone-500 truncate">{user.email}</p>
                    </div>
                  )}
                  <button onClick={() => { setShowUserMenu(false); setShowProfile(true); }} className="w-full text-left px-3 py-2.5 text-[12px] text-stone-300 hover:bg-stone-800 transition-colors">
                    {t("profile.edit")}
                  </button>
                  <button onClick={() => { setShowUserMenu(false); handleSignOut(); }} className="w-full text-left px-3 py-2.5 text-[12px] text-red-400 hover:bg-stone-800 transition-colors border-t border-stone-800">
                    {t("auth.signOut")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Child tabs — мобайлд харагдана, desktop-д sidebar-д байна */}
        <div className="md:hidden bg-stone-900 px-3 pb-2 flex items-center gap-2 overflow-x-auto scrollbar-hide border-b border-stone-800">
          {children.map((c, i) => (
            <button key={c.childId} onClick={() => setActiveChildIdx(i)}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-all ${i === activeChildIdx ? "bg-amber-600 text-white" : "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200"}`}>
              {c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} className="w-4 h-4 rounded-full object-cover"/> : <span className="w-4 h-4 rounded-full bg-stone-600 text-[8px] font-bold text-white flex items-center justify-center">{c.name.slice(0,1).toUpperCase()}</span>}
              {c.name}
            </button>
          ))}
          {canAddChild && (
            <button onClick={() => setShowAddChild(true)} className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 text-stone-500 border border-dashed border-stone-700 hover:border-stone-500 hover:text-stone-300 transition-colors">
              + {t("children.addChild")}
            </button>
          )}
        </div>
      </header>

      {!isFirebaseConfigured && (
        <div className="bg-amber-100 px-4 py-2 text-center text-[11px] text-amber-800 print:hidden">⚠️ {t("status.offlineBanner")}</div>
      )}

      {/* ── BODY: мобайл = flex-col, desktop = flex-row ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

        {/* ══ DESKTOP SIDEBAR ══ */}
        <aside className="hidden md:flex flex-col w-56 bg-stone-950 border-r border-stone-800 shrink-0 overflow-y-auto">

          {/* Хүүхдийн жагсаалт */}
          <div className="px-3 pt-4 pb-3 border-b border-stone-800">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-stone-600 mb-2">{t("children.title") || "Хүүхдүүд"}</p>
            <div className="space-y-1">
              {children.map((c, i) => (
                <button key={c.childId} onClick={() => setActiveChildIdx(i)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${i === activeChildIdx ? "bg-amber-600 text-white" : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"}`}>
                  {c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} className="w-6 h-6 rounded-full object-cover shrink-0"/> : <span className="w-6 h-6 rounded-full bg-stone-700 text-[9px] font-bold text-stone-300 flex items-center justify-center shrink-0">{c.name.slice(0,1).toUpperCase()}</span>}
                  <span className="text-[12px] font-medium truncate">{c.name}</span>
                </button>
              ))}
              {canAddChild && (
                <button onClick={() => setShowAddChild(true)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-stone-600 border border-dashed border-stone-800 hover:border-stone-600 hover:text-stone-400 transition-colors text-[11px]">
                  + {t("children.addChild")}
                </button>
              )}
            </div>
          </div>

          {/* Nav items */}
          <nav className="px-3 py-3 flex-1">
            {navItems.map((item) => {
              const active = activeSection === item.id;
              const colors: Record<string, string> = {
                achievements: "bg-amber-600/15 text-amber-400 border-l-2 border-amber-500",
                practice:     "bg-blue-600/15 text-blue-400 border-l-2 border-blue-500",
                reflection:   "bg-rose-600/15 text-rose-400 border-l-2 border-rose-500",
                coach:        "bg-emerald-600/15 text-emerald-400 border-l-2 border-emerald-500",
                pdf:          "bg-violet-600/15 text-violet-400 border-l-2 border-violet-500",
              };
              return (
                <button key={item.id} onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg mb-0.5 text-left transition-all ${active ? colors[item.id] : "text-stone-500 hover:bg-stone-800 hover:text-stone-300"}`}>
                  <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
                  <span className="text-[12px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar доод хэсэг — subscription */}
          <div className="px-3 pb-4 border-t border-stone-800 pt-3 mt-3">
            {isPremium ? (
              <div className="rounded-lg bg-stone-900 border border-stone-800 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-amber-400 mb-1">
                  {subscription === "family" ? `★ ${t("sub.tierNames.family")}` : subscription === "master" ? `★ ${t("sub.tierNames.master")}` : `★ ${t("sub.tierNames.coach")}`}
                </p>
                <p className="text-[10px] text-stone-500">Хязгааргүй амжилт · PDF · AI</p>
              </div>
            ) : (
              <div className="rounded-lg bg-stone-900 border border-stone-800 px-3 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-stone-400 font-medium">{t("sub.tierNames.free").toUpperCase()} · {achCount}/{maxAch}</span>
                </div>
                <div className="h-1 bg-stone-800 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${showLimitWarning ? "bg-gradient-to-r from-amber-500 to-red-500" : "bg-stone-600"}`}
                    style={{ width: `${Math.min(100, (achCount / maxAch) * 100)}%` }}/>
                </div>
                <button onClick={() => setShowSubscription(true)}
                  className="w-full text-[11px] font-bold py-1.5 rounded-md bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors">
                  ⬆ Upgrade
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ══ MAIN CONTENT ══ */}
        <main ref={mainRef} className="flex-1 overflow-y-auto pb-24 md:pb-6 print:p-0">
          {user?.role === "teacher" && (
            <div className="bg-stone-900 px-4 py-2 text-center text-[11px] text-amber-400 print:hidden">
              🏫 {t("status.teacherMode")}
            </div>
          )}
          {activeSection === "achievements" && (
            <TimelineDashboard
              child={child}
              achievements={achievements}
              onAddClick={() => setShowForm(true)}
              onEditProfile={() => setShowProfile(true)}
              onEditAchievement={(a) => setEditingAchievement(a)}
              onDeleteAchievement={handleDeleteAchievement}
            />
          )}
          {activeSection === "practice" && (
            <div className="px-4 py-6 max-w-3xl mx-auto">
              <SectionHeader title={t("practice.title") || "Бэлтгэлийн тэмдэглэл"} subtitle={child.name} />
              <PracticeLogSection childId={child.childId} logs={practiceLogs} onAdd={handleAddPracticeLog} onDelete={handleDeletePracticeLog} />
            </div>
          )}
          {activeSection === "reflection" && (
            <div className="px-4 py-6 max-w-3xl mx-auto">
              <SectionHeader title={t("reflection.title") || "Хүүхдийн сэтгэлзүйн тэмдэглэл"} subtitle={child.name} />
              {user?.role === "parent" ? (
                <ReflectionSection childId={child.childId} reflections={reflections} onAdd={handleAddReflection} onDelete={handleDeleteReflection} />
              ) : (
                <div className="text-center py-12 text-stone-400 text-sm">{t("reflection.parentOnly")}</div>
              )}
            </div>
          )}
          {activeSection === "coach" && (
            <div className="px-4 py-6 max-w-3xl mx-auto">
              <SectionHeader title={t("invite.parent.heading") || "Багштай холбогдох"} subtitle={child.name} />
              <div className="grid gap-4">
                {user?.role === "teacher" && <TeacherInvitePanel teacherId={user.uid} teacherName={user.displayName} onCreateCode={createInviteCode} />}
                {user?.role === "parent" && child && <ParentLinkPanel childId={child.childId} childName={child.name} onUseCode={useInviteCode} />}
              </div>
            </div>
          )}
          {activeSection === "pdf" && (
            <div className="px-4 py-6 max-w-xl mx-auto">
              <SectionHeader title="PDF" subtitle={child.name} />
              <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100">
                  <p className="text-[11px] text-stone-500">{t("pdf.downloadSubtitle", { name: child.name })}</p>
                </div>
                <div className="divide-y divide-stone-100">
                  {([
                    { id: "official" as PdfTemplate, label: t("pdf.official"), desc: t("pdf.officialDesc") },
                    { id: "kids"     as PdfTemplate, label: t("pdf.kids"),     desc: t("pdf.kidsDesc") },
                    { id: "gold"     as PdfTemplate, label: t("pdf.gold"),     desc: t("pdf.goldDesc") },
                    { id: "portfolio" as PdfTemplate, label: t("pdf.portfolio"), desc: t("pdf.portfolioDesc") },
                  ]).map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => { setPdfTemplate(tmpl.id); handleDownloadPdf(tmpl.id); }}
                      disabled={pdfBusy || !tierLimits.hasPdf}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-all hover:bg-stone-50 active:bg-stone-100 disabled:opacity-40"
                    >
                      <div>
                        <span className="text-[13px] font-medium text-stone-800">{tmpl.label}</span>
                        <p className="text-[11px] text-stone-400 mt-0.5">{tmpl.desc}</p>
                      </div>
                      {pdfTemplate === tmpl.id && pdfBusy ? (
                        <svg className="w-4 h-4 animate-spin text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-stone-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-stone-100">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div
                      onClick={() => setIncludeImages(!includeImages)}
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 cursor-pointer ${includeImages ? "bg-amber-500 border-amber-500" : "bg-white border-stone-300"}`}
                    >
                      {includeImages && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                    </div>
                    <span className="text-[12px] text-stone-600">{t("pdf.includeImages")}</span>
                  </label>
                </div>
                {!tierLimits.hasPdf && (
                  <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
                    <button onClick={() => setShowSubscription(true)} className="text-[12px] text-amber-600 font-medium">
                      {t("pdf.premiumMessage")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* BOTTOM NAV — зөвхөн мобайлд */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {!isPremium && (
          <div className="bg-stone-950 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-stone-400">
              {showLimitWarning
                ? <span className="text-amber-400 font-medium">{t("sub.nearLimit", { count: achCount, max: maxAch })}</span>
                : <><span className="font-medium text-stone-300">{t("sub.tierNames.free").toUpperCase()}</span> · {achCount}/{maxAch} {t("summary.entries")}</>}
            </span>
            <button onClick={() => setShowSubscription(true)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-amber-500 text-stone-950 hover:bg-amber-400 active:scale-95 transition-all shrink-0">
              {t("sub.upgrade")}
            </button>
          </div>
        )}
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            const colors: Record<string, string> = { achievements:"text-amber-500", practice:"text-blue-500", reflection:"text-rose-500", coach:"text-emerald-500", pdf:"text-violet-500" };
            const lines: Record<string, string>  = { achievements:"bg-amber-500", practice:"bg-blue-500", reflection:"bg-rose-500", coach:"bg-emerald-500", pdf:"bg-violet-500" };
            return (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${active ? colors[item.id] : "text-stone-400 hover:text-stone-500"}`}>
                <span className={`transition-transform ${active ? "scale-110" : ""}`}>{item.icon}</span>
                <span className={`text-[9px] font-medium leading-none ${active ? colors[item.id] : "text-stone-400"}`}>{item.label}</span>
                {active && <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${lines[item.id]}`}/>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* FAB — мобайлд bottom nav дээр, desktop-д доод баруун */}
      {activeSection === "achievements" && (
        <button type="button" onClick={() => setShowForm(true)} aria-label={t("app.addAchievement")}
          className="fixed z-30 bg-stone-950 text-white rounded-full shadow-lg shadow-stone-900/30 hover:bg-stone-800 active:scale-95 transition-all print:hidden flex items-center justify-center md:bottom-6 md:right-6"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)", right: 16, width: 52, height: 52 }}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      {loadingAch && isFirebaseConfigured && (
        <div className="fixed top-28 inset-x-0 z-30 flex justify-center print:hidden">
          <div className="rounded-full bg-white px-4 py-1.5 text-[11px] text-stone-600 shadow border border-stone-100">
            {t("status.loading")}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 backdrop-blur-sm p-2 sm:items-center sm:p-4 print:hidden" onClick={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
            <AddAchievementForm childId={child.childId} childName={child.name} onCancel={() => setShowForm(false)} onSubmit={handleAddAchievement} />
          </div>
        </div>
      )}
      {editingAchievement && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 backdrop-blur-sm p-2 sm:items-center sm:p-4 print:hidden" onClick={() => setEditingAchievement(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
            <AddAchievementForm
              childId={child.childId}
              childName={child.name}
              initialDraft={editingAchievement}
              onCancel={() => setEditingAchievement(null)}
              onSubmit={async (draft) => {
                if (isFirebaseConfigured) {
                  try {
                    const { updateAchievement } = await import("./lib/firebase");
                    await updateAchievement(editingAchievement.id, { title: draft.title, date: draft.date, location: draft.location, category: draft.category, description: draft.description, awardType: draft.awardType });
                    setEditingAchievement(null);
                    setToast({ kind: "success", message: t("status.entryUpdated") });
                  } catch {
                    setToast({ kind: "error", message: t("status.errorSaving") });
                  }
                } else {
                  setEditingAchievement(null);
                  setToast({ kind: "success", message: t("status.entryUpdated") });
                }
              }}
            />
          </div>
        </div>
      )}
      {showProfile && <ChildProfileEditor child={child} onClose={() => setShowProfile(false)} onSave={handleUpdateChild} />}
      {showSubscription && <SubscriptionModal onClose={() => setShowSubscription(false)} />}
      {showAddChild && <AddChildModal onClose={() => setShowAddChild(false)} onAdd={handleAddNewChild} />}
      {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      {subtitle && <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">{subtitle}</p>}
      <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
    </div>
  );
}

function LanguageChip() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return (
    <button
      onClick={() => i18n.changeLanguage(lang === "mn" ? "en" : "mn")}
      className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700 hover:bg-stone-700 active:scale-95 transition-all"
    >
      {lang === "mn" ? "MN" : "EN"}
    </button>
  );
}

function AddChildModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">{t("children.addChild")}</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onAdd(name.trim())}
          placeholder={t("children.namePlaceholder")}
          className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-[13px] text-stone-900 focus:outline-none focus:border-stone-400 transition-colors"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-stone-500 hover:bg-stone-100 rounded-lg transition-colors">
            {t("form.actions.cancel")}
          </button>
          <button
            onClick={() => name.trim() && onAdd(name.trim())}
            disabled={!name.trim()}
            className="px-4 py-2 text-[13px] font-medium bg-stone-950 text-white rounded-lg hover:bg-stone-800 disabled:opacity-40 active:scale-95 transition-all"
          >
            {t("children.addChild")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="flex items-center gap-3 text-[13px] text-stone-500">
        <svg className="w-4 h-4 animate-spin text-amber-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        ChampStep…
      </div>
    </div>
  );
}