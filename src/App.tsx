// =============================================================================
// App v4 — forest green / graphite / white (docs/BRAND.md), mobile-first
// Logic / Firebase / auth unchanged — only the shell markup and classes.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check, Clock, Download, FileText, Globe, GraduationCap, Heart, Info, Loader2, LogOut,
  Pencil, Plus, ScrollText, Settings, Star, Trophy, X, type LucideIcon,
} from "lucide-react";
import Logo, { LogoMark } from "./components/Logo";

import AddAchievementForm from "./components/AddAchievementForm";
import AboutPage from "./components/AboutPage";
import AdminPage from "./components/AdminPage";
import CoachNotes from "./components/CoachNotes";
import TermsPage from "./components/TermsPage";
import ChildProfileEditor from "./components/ChildProfileEditor";
import LoginPage from "./components/LoginPage";
import SubscriptionModal from "./components/SubscriptionModal";
import SubscriptionPage from "./components/SubscriptionPage";
import ExpiryBanner from "./components/ExpiryBanner";
import PdfPreviewModal from "./components/PdfPreviewModal";
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
  subscribeChildrenForTeacher,
  isFirebaseConfigured,
  updateChild as fbUpdateChild,
} from "./lib/firebase";
import {
  loadLocalChild,
  saveLocalAchievements,
  saveLocalChild,
} from "./lib/localStore";
import { celebrate } from "./lib/celebrate";
import type { Achievement, AchievementDraft, Child, SubscriptionTier } from "./types";
import type { PdfTemplate } from "./lib/pdfExport";
import { TIER_LIMITS } from "./types";

type ToastState = { kind: ToastKind; message: string } | null;
type NavSection = "achievements" | "practice" | "reflection" | "coach" | "pdf" | "about" | "terms" | "subscription";

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
/** "Upgrade" strip dismissal (mobile bottom bar): hidden for 7 days unless a limit is ≥90 % used. */
const UPGRADE_BAR_KEY = "champstep.upgradeBarDismissedAt";
const UPGRADE_BAR_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

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
  // users/{uid}.role not read yet → keep loading; never render a parent dashboard by default
  if (!user.role) return <FullScreenLoader />;
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
  const [upgradeBarDismissed, setUpgradeBarDismissed] = useState<boolean>(() => {
    try { const at = Number(localStorage.getItem(UPGRADE_BAR_KEY) ?? 0); return Date.now() - at < UPGRADE_BAR_SNOOZE_MS; } catch { return false; }
  });
  const [modalTier, setModalTier] = useState<SubscriptionTier | undefined>(undefined);
  const openSubscription = (tier?: SubscriptionTier) => { setModalTier(tier); setShowSubscription(true); };
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>("official");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  // const [champMood, setChampMood] = useState<"idle" | "happy" | "excited" | "streak" | "sleeping">("idle");

  const child = children[activeChildIdx];
  const tierLimits = TIER_LIMITS[subscription as SubscriptionTier] ?? TIER_LIMITS.free;

  const { achievements, loading: loadingAch, error: achError, addLocal } =
    useAchievements(child?.childId ?? "", seedAchievements);
  const { logs: practiceLogs, error: logsError, addLocal: addLocalLog, removeLocal: removeLocalLog } =
    usePracticeLogs(child?.childId ?? "");
  const { reflections, error: reflectionsError, addLocal: addLocalReflection, removeLocal: removeLocalReflection } =
    useReflections(child?.childId ?? "", user?.role !== "teacher");

  useEffect(() => {
    if (user && isFirebaseConfigured && user.role === "teacher") {
      // Teacher roster is live: a newly linked student appears without a reload.
      return subscribeChildrenForTeacher(
        user.uid,
        (list) => { setChildren(list); setLoadingChildren(false); },
        (e) => { console.error("[champstep] teacher children failed:", e); setLoadingChildren(false); setToast({ kind: "error", message: t("status.errorLoading") }); }
      );
    }
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
        if (user.role === "parent") {
          list = await getChildrenForParent(user.uid);
          // Only a PARENT ever gets an auto-created first child (never a teacher uid).
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
    if (achError || logsError || reflectionsError) setToast({ kind: "error", message: t("status.errorLoading") });
  }, [achError, logsError, reflectionsError, t]);

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
        celebrate({ mega: draft.awardType === "Gold" });
        // setChampMood("excited");
        // setTimeout(() => setChampMood("idle"), 3000);
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
    celebrate({ mega: draft.awardType === "Gold" });
    // setChampMood("excited");
    // setTimeout(() => setChampMood("idle"), 3000);
  }

  async function handleUpdateChild(next: Child, avatarFile?: File) {
    if (isFirebaseConfigured) {
      try {
        const saved = await fbUpdateChild(next, avatarFile);
        setChildren((prev) => prev.map((c) => c.childId === saved.childId ? saved : c));
        setToast({ kind: "success", message: t("status.savedProfile") });
      } catch (e) {
        setToast({ kind: "error", message: t("status.errorSaving") });
        throw e; // editor stays open with the draft
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
    if (isFirebaseConfigured) {
      try { await createChild(newChild); }
      catch { setToast({ kind: "error", message: t("status.errorSaving") }); return; }
    }
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
      catch (e) { setToast({ kind: "error", message: t("status.errorSaving") }); throw e; } // form keeps the text
      return;
    }
    addLocalLog({ id: crypto.randomUUID(), childId: child.childId, ...log, createdAt: new Date().toISOString() });
  }

  async function handleAddReflection(r: { date: string; mood: 1|2|3|4|5; content: string; parentNote?: string }) {
    if (!child) return;
    if (isFirebaseConfigured) {
      try { await createReflection(child.childId, r); }
      catch (e) { setToast({ kind: "error", message: t("status.errorSaving") }); throw e; } // form keeps the text
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

  function openPdfPreview(template: PdfTemplate) {
    if (!child) return;
    if (!tierLimits.hasPdf) {
      setShowSubscription(true);
      setToast({ kind: "info", message: t("pdf.premiumRequired") });
      return;
    }
    setPdfTemplate(template);
    setPreviewOpen(true);
  }

  async function handleSignOut() {
    if (!isFirebaseConfigured) saveLocalAchievements([]);
    await signOut();
  }

  if (loadingChildren) return <FullScreenLoader />;
  if (!child) {
    if (user?.role === "teacher") {
      // A teacher with no linked students yet: show the invite panel instead of a dead end.
      return (
        <div className="min-h-screen supports-[height:100dvh]:min-h-dvh bg-bg font-sans">
          <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <Logo size={22} />
            <div className="flex items-center gap-1">
              <LanguageChip />
              <button type="button" onClick={handleSignOut} className="cs-btn cs-btn-outline cs-btn-sm">
                {t("auth.signOut")}
              </button>
            </div>
          </header>
          <TeacherBanner label={t("status.teacherMode")} />
          <main className="mx-auto max-w-2xl px-4 py-8">
            <h1 className="t-h1">{t("invite.teacher.noStudentsTitle")}</h1>
            <p className="mt-2 t-body text-ink-2">{t("invite.teacher.noStudentsHint")}</p>
            <div className="mt-6">
              <TeacherInvitePanel teacherId={user.uid} teacherName={user.displayName} onCreateCode={createInviteCode} />
            </div>
          </main>
          {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="t-body text-ink-3">{t("status.childNotFound")}</p>
      </div>
    );
  }

  const canAddChild = user?.role === "parent" && children.length < tierLimits.maxChildren;
  // Багш: хүүхдийн өгөгдлийг зөвхөн уншина (Firestore rules-тэй нийцнэ), coach notes л бичнэ
  const isTeacher = user?.role === "teacher";
  const isPremium = subscription !== "free";
  const maxAch = tierLimits.maxAchievements;
  const achCount = achievements.length;
  const showLimitWarning = !isPremium && maxAch > 0 && achCount >= Math.floor(maxAch * 0.8);
  // ≥90 % of a limit: the upgrade bar comes back even if dismissed. The child limit only
  // counts when it can actually be approached (free = 1 child would otherwise pin the bar forever).
  const achNear = !isPremium && maxAch > 0 && achCount >= Math.ceil(maxAch * 0.9);
  const childNear = !isPremium && tierLimits.maxChildren > 1 && children.length >= tierLimits.maxChildren;
  const nearLimit = achNear || childNear;
  const showUpgradeBar = !isPremium && (!upgradeBarDismissed || nearLimit);
  function dismissUpgradeBar() {
    try { localStorage.setItem(UPGRADE_BAR_KEY, String(Date.now())); } catch { /* private mode */ }
    setUpgradeBarDismissed(true);
  }

  const navItems: { id: NavSection; label: string; Icon: LucideIcon }[] = [
    { id: "achievements", label: t("nav.achievements"), Icon: Trophy },
    { id: "practice", label: t("nav.practice"), Icon: Clock },
    { id: "reflection", label: t("nav.reflection"), Icon: Heart },
    { id: "coach", label: t("nav.coach"), Icon: GraduationCap },
    { id: "pdf", label: t("nav.pdf"), Icon: FileText },
    { id: "about", label: t("nav.about"), Icon: Info },
    { id: "terms", label: t("nav.terms"), Icon: ScrollText },
  ];

  const tierLabel =
    subscription === "family" ? t("sub.tierNames.family") :
    subscription === "master" ? t("sub.tierNames.master") :
    subscription === "coach" ? t("sub.tierNames.coach") : t("sub.tierNames.free");

  return (
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-dvh bg-bg font-sans text-ink">

      {/* TOP BAR — мобайл + desktop header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line print:hidden cs-app-header pt-[env(safe-area-inset-top)]">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo size={22} />
            <span className={`cs-badge-tier ${isPremium ? "cs-badge-tier-paid" : "cs-badge-tier-free"}`}>
              {tierLabel.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageChip />
            <button
              type="button"
              onClick={() => setShowSubscription(true)}
              className="cs-icon-btn cs-icon-btn-sm bg-primary-soft text-primary-soft-ink hover:bg-primary-soft"
              title={t("nav.subscription")}
              aria-label={t("nav.subscription")}
            >
              <Star size={18} strokeWidth={2.2} fill="currentColor" />
            </button>
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="ml-1 w-9 h-9 rounded-full overflow-hidden border border-line-strong hover:border-primary transition-colors shrink-0"
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
              >
                {child.avatarUrl
                  ? <img src={child.avatarUrl} alt={child.name} className="w-full h-full object-cover" />
                  : <span className="w-full h-full bg-primary-soft text-primary-soft-ink flex items-center justify-center text-[13px] font-extrabold">{child.name.slice(0, 1).toUpperCase()}</span>}
              </button>
              {showUserMenu && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-56 cs-card shadow-float z-50 overflow-hidden py-1 cs-menu-in">
                  {user?.email && (
                    <div className="px-3 py-2 border-b border-line">
                      <p className="t-caption truncate">{user.email}</p>
                    </div>
                  )}
                  {!isTeacher && (
                    <MenuItem onClick={() => { setShowUserMenu(false); setShowProfile(true); }} Icon={Pencil} label={t("profile.edit")} />
                  )}
                  <MenuItem onClick={() => { setShowUserMenu(false); setActiveSection("about"); }} Icon={Info} label={t("nav.about")} />
                  <MenuItem onClick={() => { setShowUserMenu(false); setActiveSection("subscription"); }} Icon={Star} label={t("nav.subscriptionPage")} />
                  <MenuItem onClick={() => { setShowUserMenu(false); setActiveSection("terms"); }} Icon={ScrollText} label={t("nav.terms")} />
                  {user?.email === "gansolongozorigt7@gmail.com" && (
                    <MenuItem onClick={() => { setShowUserMenu(false); setShowAdmin(true); }} Icon={Settings} label={t("nav.admin")} />
                  )}
                  <div className="border-t border-line mt-1 pt-1">
                    <MenuItem onClick={() => { setShowUserMenu(false); handleSignOut(); }} Icon={LogOut} label={t("auth.signOut")} tone="danger" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Child switcher — мобайлд харагдана, desktop-д sidebar-д байна */}
        <div className="md:hidden px-4 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <ChildSwitcher children={children} activeIdx={activeChildIdx} onSelect={setActiveChildIdx} />
          {canAddChild && (
            <button
              type="button"
              onClick={() => setShowAddChild(true)}
              className="cs-icon-btn cs-icon-btn-sm border border-dashed border-line-strong text-ink-3 shrink-0"
              title={t("children.addChild")}
              aria-label={t("children.addChild")}
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </header>

      {!isFirebaseConfigured && (
        <div className="bg-warn-soft px-4 py-2 text-center t-caption text-warn print:hidden">{t("status.offlineBanner")}</div>
      )}

      {/* ── BODY: мобайл = flex-col, desktop = flex-row ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

        {/* ══ DESKTOP SIDEBAR ══ */}
        <aside className="hidden md:flex flex-col w-60 bg-surface border-r border-line shrink-0 overflow-y-auto cs-app-sidebar">

          {/* Хүүхдийн жагсаалт */}
          <div className="px-3 pt-5 pb-3 border-b border-line">
            <p className="t-label mb-2 px-2">{t("children.title")}</p>
            <div className="space-y-1">
              {children.map((c, i) => {
                const active = i === activeChildIdx;
                return (
                  <button
                    key={c.childId}
                    type="button"
                    onClick={() => setActiveChildIdx(i)}
                    aria-pressed={active}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-input text-left transition-colors min-h-[44px] ${active ? "bg-primary-soft text-primary-soft-ink" : "text-ink-2 hover:bg-surface-muted"}`}
                  >
                    <ChildDot child={c} size={28} />
                    <span className="text-[14px] font-bold truncate">{c.name}</span>
                  </button>
                );
              })}
              {canAddChild && (
                <button
                  type="button"
                  onClick={() => setShowAddChild(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-input text-[13px] font-bold text-ink-3 border border-dashed border-line-strong hover:border-primary hover:text-primary transition-colors min-h-[44px]"
                >
                  {t("children.addChild")}
                </button>
              )}
            </div>
          </div>

          {/* Nav items */}
          <nav className="px-3 py-3 flex-1">
            {navItems.map(({ id, label, Icon }) => {
              const active = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  aria-current={active ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-input mb-0.5 text-left transition-colors min-h-[44px] ${active ? "bg-primary-soft text-primary-soft-ink" : "text-ink-2 hover:bg-surface-muted hover:text-ink"}`}
                >
                  <Icon size={20} strokeWidth={2} className="shrink-0" />
                  <span className="text-[14px] font-bold">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar доод хэсэг — subscription */}
          <div className="px-3 pb-4 pt-3 border-t border-line">
            {isPremium ? (
              <div className="cs-card-soft px-3 py-3">
                <p className="t-label text-primary-soft-ink mb-1">{tierLabel}</p>
                <p className="t-caption">{t("sub.premiumFeatures")}</p>
              </div>
            ) : (
              <div className="cs-card-soft px-3 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="t-label">{t("sub.tierNames.free")} · <span className="tabular-nums">{achCount}/{maxAch}</span></span>
                </div>
                <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all ${showLimitWarning ? "bg-warn" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, (achCount / maxAch) * 100)}%` }} />
                </div>
                <button type="button" onClick={() => setShowSubscription(true)} className="cs-btn cs-btn-primary cs-btn-sm w-full">
                  {t("sub.upgrade")}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ══ MAIN CONTENT ══ */}
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-bg pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6 print:p-0">
          <ExpiryBanner onRenew={openSubscription} />
          {user?.role === "teacher" && <TeacherBanner label={t("status.teacherMode")} />}
          <div key={activeSection} className="cs-section-in">
          {activeSection === "achievements" && (
            <TimelineDashboard
              child={child}
              achievements={achievements}
              loading={loadingAch && isFirebaseConfigured}
              readOnly={isTeacher}
              onAddClick={() => setShowForm(true)}
              onEditProfile={() => setShowProfile(true)}
              onEditAchievement={(a) => setEditingAchievement(a)}
              onDeleteAchievement={handleDeleteAchievement}
              onToast={(kind, message) => setToast({ kind, message })}
            />
          )}
          {activeSection === "practice" && (
            <div className="px-4 py-6 max-w-3xl mx-auto">
              <SectionHeader title={t("practice.title")} subtitle={child.name} />
              <PracticeLogSection childId={child.childId} logs={practiceLogs} onAdd={handleAddPracticeLog} onDelete={handleDeletePracticeLog} readOnly={isTeacher} />
            </div>
          )}
          {activeSection === "reflection" && (
            <div className="px-4 py-6 max-w-3xl mx-auto">
              <SectionHeader title={t("reflection.title")} subtitle={child.name} />
              {user?.role === "parent" ? (
                <ReflectionSection childId={child.childId} reflections={reflections} onAdd={handleAddReflection} onDelete={handleDeleteReflection} />
              ) : (
                <div className="cs-card-soft text-center py-12 t-body text-ink-3">{t("reflection.parentOnly")}</div>
              )}
            </div>
          )}
          {activeSection === "coach" && (
            <div className="px-4 py-6 max-w-3xl mx-auto">
              <SectionHeader title={t("invite.parent.heading")} subtitle={child.name} />
              <div className="grid gap-4">
                {user?.role === "teacher" && <TeacherInvitePanel teacherId={user.uid} teacherName={user.displayName} onCreateCode={createInviteCode} />}
                {user?.role === "parent" && child && <ParentLinkPanel childId={child.childId} childName={child.name} onUseCode={useInviteCode} />}
                {user && isFirebaseConfigured && (
                  <CoachNotes
                    childId={child.childId}
                    childName={child.name}
                    teacherId={user.uid}
                    teacherName={user.displayName}
                    isTeacher={isTeacher}
                    teacherIds={child.teacherIds ?? []}
                  />
                )}
              </div>
            </div>
          )}
          {activeSection === "about" && (
            <div className="px-4 py-6 max-w-2xl mx-auto">
              <AboutPage />
            </div>
          )}
          {activeSection === "terms" && (
            <div className="px-4 py-6 max-w-2xl mx-auto">
              <TermsPage />
            </div>
          )}
          {activeSection === "subscription" && (
            <div className="px-4 py-6 max-w-2xl mx-auto">
              <SectionHeader title={t("nav.subscriptionPage")} subtitle={user?.displayName} />
              <SubscriptionPage onOpenModal={openSubscription} onToast={(kind, message) => setToast({ kind, message })} />
            </div>
          )}
          {activeSection === "pdf" && (
            <div className="px-4 py-6 max-w-xl mx-auto">
              <SectionHeader title="PDF" subtitle={child.name} />
              <div className="cs-card overflow-hidden">
                <div className="px-4 py-3 border-b border-line">
                  <p className="t-caption">{t("pdf.downloadSubtitle", { name: child.name })}</p>
                </div>
                <div className="divide-y divide-line">
                  {([
                    { id: "official" as PdfTemplate, label: t("pdf.official"), desc: t("pdf.officialDesc") },
                    { id: "gold"     as PdfTemplate, label: t("pdf.gold"),     desc: t("pdf.goldDesc") },
                    { id: "portfolio" as PdfTemplate, label: t("pdf.portfolio"), desc: t("pdf.portfolioDesc") },
                    { id: "framed" as PdfTemplate, label: t("pdf.framed"), desc: t("pdf.framedDesc") },
                  ]).map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => openPdfPreview(tmpl.id)}
                      disabled={pdfBusy || !tierLimits.hasPdf}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-bg-soft active:bg-surface-muted disabled:opacity-40 min-h-[56px]"
                    >
                      <div className="min-w-0">
                        <span className="t-body-strong text-ink">{tmpl.label}</span>
                        <p className="t-caption mt-0.5">{tmpl.desc}</p>
                      </div>
                      {pdfTemplate === tmpl.id && pdfBusy
                        ? <Loader2 size={20} className="animate-spin text-ink-3 shrink-0" />
                        : <span className="cs-badge cs-badge-primary"><Download size={18} /></span>}
                    </button>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-line">
                  <label className="flex items-center gap-3 cursor-pointer select-none min-h-[44px]">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={includeImages}
                      onClick={() => setIncludeImages(!includeImages)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${includeImages ? "bg-primary border-primary text-white" : "bg-surface border-line-strong"}`}
                    >
                      {includeImages && <Check size={14} strokeWidth={3} />}
                    </button>
                    <span className="t-body text-ink-2">{t("pdf.includeImages")}</span>
                  </label>
                </div>
                {!tierLimits.hasPdf && (
                  <div className="px-4 py-3 bg-bg-soft border-t border-line">
                    <button type="button" onClick={() => setShowSubscription(true)} className="t-body-strong text-primary">
                      {t("pdf.premiumMessage")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </main>
      </div>

      {/* BOTTOM NAV — зөвхөн мобайлд */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {showUpgradeBar && (
          <div className="bg-bg-soft border-b border-line px-3 py-2 flex items-center justify-between gap-2" data-testid="upgrade-bar">
            <span className="t-caption text-ink-2 min-w-0 truncate">
              {achNear || showLimitWarning
                ? <span className="text-warn font-bold">{t("sub.nearLimit", { count: achCount, max: maxAch })}</span>
                : childNear
                ? <span className="text-warn font-bold">{t("status.childLimit", { max: tierLimits.maxChildren })}</span>
                : <><span className="font-bold text-ink">{t("sub.tierNames.free").toUpperCase()}</span> · <span className="tabular-nums">{achCount}/{maxAch}</span> {t("summary.entries")}</>}
            </span>
            {!nearLimit && (
              <button type="button" onClick={dismissUpgradeBar} aria-label={t("sub.upgradeBarDismiss")} className="cs-icon-btn cs-icon-btn-sm ml-auto text-ink-3"><X size={16} /></button>
            )}
            <button type="button" onClick={() => setShowSubscription(true)} className="cs-btn cs-btn-primary cs-btn-xs shrink-0">
              {t("sub.upgrade")}
            </button>
          </div>
        )}
        <div className="flex items-stretch">
          {navItems.filter((item) => item.id !== "about" && item.id !== "terms").map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors ${active ? "text-primary" : "text-ink-3 hover:text-ink-2"}`}
              >
                <Icon size={24} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-bold leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* FAB — мобайлд bottom nav дээр, desktop-д доод баруун */}
      {activeSection === "achievements" && !isTeacher && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          aria-label={t("app.addAchievement")}
          className="cs-fab fixed z-30 print:hidden md:bottom-6 md:right-6"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)", right: 16 }}
        >
          <Plus size={22} strokeWidth={2.5} />
          <span>{t("app.addAchievement")}</span>
        </button>
      )}


      {/* MODALS */}
      {showForm && (
        <div className="cs-modal-backdrop cs-backdrop-in print:hidden" onClick={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-2xl">
            <div className="cs-handle" />
            <AddAchievementForm childId={child.childId} childName={child.name} onCancel={() => setShowForm(false)} onSubmit={handleAddAchievement} onError={(m) => setToast({ kind: "error", message: m })} />
          </div>
        </div>
      )}
      {editingAchievement && (
        <div className="cs-modal-backdrop cs-backdrop-in print:hidden" onClick={() => setEditingAchievement(null)}>
          <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-2xl">
            <div className="cs-handle" />
            <AddAchievementForm
              childId={child.childId}
              childName={child.name}
              initialDraft={editingAchievement}
              onError={(m) => setToast({ kind: "error", message: m })}
              onCancel={() => setEditingAchievement(null)}
              onSubmit={async (draft) => {
                if (isFirebaseConfigured) {
                  try {
                    const { updateAchievementWithImages } = await import("./lib/firebase");
                    await updateAchievementWithImages(editingAchievement.id, child.childId, draft, editingAchievement.imageURLs ?? []);
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
      {showProfile && <ChildProfileEditor child={child} onClose={() => setShowProfile(false)} onSave={handleUpdateChild} onError={(m) => setToast({ kind: "error", message: m })} />}
      {showSubscription && <SubscriptionModal initialTier={modalTier} onClose={() => { setShowSubscription(false); setModalTier(undefined); }} />}
      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        child={child}
        achievements={achievements}
        template={pdfTemplate}
        includeImages={includeImages}
      />
      {showAddChild && <AddChildModal onClose={() => setShowAddChild(false)} onAdd={handleAddNewChild} />}
      {showAdmin && <AdminPage onClose={() => setShowAdmin(false)} />}
      {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      {subtitle && <p className="t-label mb-1">{subtitle}</p>}
      <h2 className="t-h1">{title}</h2>
    </div>
  );
}

function TeacherBanner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 bg-bg-soft border-b border-line px-4 py-2 t-caption text-primary-soft-ink print:hidden">
      <GraduationCap size={16} strokeWidth={2.2} />
      <span>{label}</span>
    </div>
  );
}

function MenuItem({ onClick, Icon, label, tone }: { onClick: () => void; Icon: LucideIcon; label: string; tone?: "danger" }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-3 text-left px-3 py-2.5 min-h-[44px] text-[14px] font-bold transition-colors hover:bg-surface-muted ${tone === "danger" ? "text-error" : "text-ink"}`}
    >
      <Icon size={18} strokeWidth={2} className={tone === "danger" ? "text-error" : "text-ink-2"} />
      <span>{label}</span>
    </button>
  );
}

/** Round child avatar (image or initial) — header, switcher, sidebar. */
function ChildDot({ child, size = 24 }: { child: Child; size?: number }) {
  return child.avatarUrl ? (
    <img src={child.avatarUrl} alt={child.name} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
  ) : (
    <span style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} className="rounded-full bg-primary-soft text-primary-soft-ink font-extrabold flex items-center justify-center shrink-0">
      {child.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** ≤3 children: segmented control; 4+: scrollable pills. */
function ChildSwitcher({ children, activeIdx, onSelect }: { children: Child[]; activeIdx: number; onSelect: (i: number) => void }) {
  const segmented = children.length <= 3;
  if (segmented) {
    return (
      <div className="cs-segment" role="group">
        {children.map((c, i) => (
          <button key={c.childId} type="button" onClick={() => onSelect(i)} aria-pressed={i === activeIdx} className="cs-segment-item">
            <ChildDot child={c} size={22} />
            <span className="max-w-[88px] truncate">{c.name}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2" role="group">
      {children.map((c, i) => {
        const active = i === activeIdx;
        return (
          <button key={c.childId} type="button" onClick={() => onSelect(i)} aria-pressed={active}
            className={`cs-chip ${active ? "" : "cs-chip-outline"} h-9 pl-1.5 pr-3 shrink-0`}>
            <ChildDot child={c} size={24} />
            <span className="max-w-[88px] truncate">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function FlagMN() {
  return (
    <svg viewBox="0 0 30 20" className="w-full h-full block" preserveAspectRatio="xMidYMid slice">
      <rect width="30" height="20" fill="#fff" />
      <rect width="10" height="20" fill="#C4272E" />
      <rect x="10" width="10" height="20" fill="#015197" />
      <rect x="20" width="10" height="20" fill="#C4272E" />
      <g fill="#F9CF02">
        <circle cx="5" cy="4.2" r="1.05" />
        <rect x="4.3" y="6" width="1.4" height="9.5" rx="0.35" />
        <path d="M3.5 5.4 L5 8 L6.5 5.4 Z" />
      </g>
    </svg>
  );
}

function FlagEN() {
  return (
    <svg viewBox="0 0 30 20" className="w-full h-full block" preserveAspectRatio="xMidYMid slice">
      <rect width="30" height="20" fill="#012169" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" strokeWidth="4" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="2" />
      <path d="M15,0 V20 M0,10 H30" stroke="#fff" strokeWidth="6" />
      <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3.5" />
    </svg>
  );
}

function FlagRU() {
  return (
    <svg viewBox="0 0 30 20" className="w-full h-full block" preserveAspectRatio="xMidYMid slice">
      <rect width="30" height="20" fill="#fff" />
      <rect y="6.67" width="30" height="6.67" fill="#0039A6" />
      <rect y="13.33" width="30" height="6.66" fill="#D52B1E" />
    </svg>
  );
}

const LANGS = [
  { code: "mn", name: "Монгол", Flag: FlagMN },
  { code: "en", name: "English", Flag: FlagEN },
  { code: "ru", name: "Русский", Flag: FlagRU },
];

/** Icon-only language picker (36px) with a flag list. */
function LanguageChip() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = (i18n.resolvedLanguage ?? i18n.language ?? "mn").slice(0, 2);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="cs-icon-btn cs-icon-btn-sm"
        aria-label={t("app.language")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe size={20} strokeWidth={2} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-44 cs-card shadow-float overflow-hidden cs-menu-in origin-top-right z-50 py-1">
          {LANGS.map((l) => {
            const active = l.code === current;
            const Flag = l.Flag;
            return (
              <button
                key={l.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { i18n.changeLanguage(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-[14px] font-bold text-left transition-colors ${active ? "bg-primary-soft text-primary-soft-ink" : "text-ink hover:bg-surface-muted"}`}
              >
                <span className="w-[22px] h-[15px] rounded-[3px] overflow-hidden ring-1 ring-line-strong shrink-0">
                  <Flag />
                </span>
                <span className="flex-1">{l.name}</span>
                {active && <Check size={16} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddChildModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void | Promise<void> }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try { await onAdd(name.trim()); } finally { setSubmitting(false); }
  }
  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-sm">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          <h2 className="t-h1 mb-4">{t("children.addChild")}</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            placeholder={t("children.namePlaceholder")}
            className="cs-input"
            autoFocus
          />
          <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost">
              {t("form.actions.cancel")}
            </button>
            <button type="button" onClick={() => void submit()} disabled={!name.trim() || submitting} className="cs-btn cs-btn-primary">
              {t("children.addChild")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <LogoMark size={36} />
        <div className="flex items-center gap-2 t-caption">
          <Loader2 size={16} className="animate-spin text-primary" />
          ChampStep…
        </div>
      </div>
    </div>
  );
}
