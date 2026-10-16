// =============================================================================
// App v4 — forest green / graphite / white (docs/BRAND.md), mobile-first
// Logic / Firebase / auth unchanged — only the shell markup and classes.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, ArrowUp, CalendarCheck, Check, Clock, Download, FileText, Globe, GraduationCap, Heart, Info, Loader2, Lock, LogOut,
  Pencil, Plus, ScrollText, Settings, Star, Trophy, UserCog, UserPlus, X, type LucideIcon,
} from "lucide-react";
import Logo, { LogoMark } from "./components/Logo";

import AddAchievementForm from "./components/AddAchievementForm";
import AboutPage from "./components/AboutPage";
import AccountSettingsModal from "./components/AccountSettingsModal";
import DeleteChildModal from "./components/DeleteChildModal";
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
import { useGoals } from "./hooks/useGoals";
import GoalForm from "./components/GoalForm";
import GoalDetailModal from "./components/GoalDetailModal";
import { activeGoals, goalStats, nextGoal as pickNextGoal, prepFromStats } from "./lib/goals";
import { localDateKey } from "./lib/streak";
import { useReflections } from "./hooks/useReflections";
import PracticeLogSection from "./components/PracticeLogSection";
import TodayPage, { type SaveOutcome } from "./components/TodayPage";
import OfflineBanner from "./components/OfflineBanner";
import { InstallBanner, InstallGuideModal } from "./components/InstallBanner";
import { bumpOpenCount, installBannerKind, onInstallPromptChange, promptInstall, snoozeInstall, type InstallKind } from "./lib/install";
import { onForegroundPush, refreshPushToken } from "./lib/push";
import ReflectionSection from "./components/ReflectionSection";
import { TeacherInvitePanel, ParentLinkPanel } from "./components/InviteCode";
import { useAuth } from "./lib/auth";
import {
  createAchievement,
  createChild,
  createPracticeLog,
  createGoal,
  updateGoal,
  currentIdToken,
  createReflection,
  deletePracticeLog,
  deleteReflection,
  createInviteCode,
  markGuestMigrated,
  useInviteCode,
  deleteAchievement,
  getChildrenForParent,
  subscribeChildrenForTeacher,
  isFirebaseConfigured,
  updateChild as fbUpdateChild,
} from "./lib/firebase";
import {
  LOGIN_MODE_KEY,
  clearLocalData,
  loadLocalChild,
  loadLocalData,
  saveLocalAchievements,
  saveLocalChild,
} from "./lib/localStore";
import { celebrate } from "./lib/celebrate";
import { DeleteError, deleteAccountRemote, deleteChildRemote } from "./lib/deleteClient";
import type { Achievement, AchievementDraft, Child, Goal, GoalDraft, SubscriptionTier } from "./types";
import { PDF_TEMPLATES, isPaidTemplate, type PdfTemplate } from "./lib/pdfTemplates";
import { TIER_LIMITS } from "./types";

type ToastState = { kind: ToastKind; message: string } | null;
type NavSection = "today" | "achievements" | "practice" | "reflection" | "coach" | "pdf" | "about" | "terms" | "subscription";

/** Deep links: /today (manifest shortcut, notification click) opens the Today screen. */
function initialSection(): NavSection {
  try { return window.location.pathname === "/today" ? "today" : "achievements"; } catch { return "achievements"; }
}
/** ?action=add-achievement (manifest shortcut) opens the add form once the dashboard is ready. */
function pendingAction(): string | null {
  try { return new URLSearchParams(window.location.search).get("action"); } catch { return null; }
}
/** Firestore write promises resolve only after the server acknowledges: offline we must not wait. */
const WRITE_WAIT_MS = 8000;
function raceWrite<T>(write: Promise<T>, onLateError: (e: unknown) => void): Promise<SaveOutcome> {
  if (!navigator.onLine) {
    // Queued in the persistent cache; a later rejection (e.g. rules) still surfaces as a toast.
    write.catch(onLateError);
    return Promise.resolve("queued");
  }
  let timedOut = false;
  write.catch((e) => { if (timedOut) onLateError(e); });
  return Promise.race([
    write.then((): SaveOutcome => "saved"),
    new Promise<SaveOutcome>((resolve) => window.setTimeout(() => { timedOut = true; resolve("queued"); }, WRITE_WAIT_MS)),
  ]);
}

const seedAchievements: Achievement[] = [];
/** First run: the "add child" modal opens by itself once per parent (per device) when they have no child yet. */
const FIRST_RUN_KEY = (uid: string) => `champstep.firstRunAddChild.${uid}`;
function firstRunPending(uid: string): boolean {
  try { return localStorage.getItem(FIRST_RUN_KEY(uid)) !== "1"; } catch { return true; }
}
function markFirstRunShown(uid: string) {
  try { localStorage.setItem(FIRST_RUN_KEY(uid), "1"); } catch { /* private mode */ }
}
/** Sign-up migration prompt ("move your trial data?") is asked once per account per device. */
const MIGRATE_ASKED_KEY = (uid: string) => `champstep.migrateAsked.${uid}`;
function migrateAsked(uid: string): boolean {
  try { return localStorage.getItem(MIGRATE_ASKED_KEY(uid)) === "1"; } catch { return true; }
}
function markMigrateAsked(uid: string) {
  try { localStorage.setItem(MIGRATE_ASKED_KEY(uid), "1"); } catch { /* private mode */ }
}
/** "Upgrade" strip dismissal (mobile bottom bar): hidden for 7 days unless a limit is >=90 % used. */
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
  // users/{uid}.role not read yet -> keep loading; never render a parent dashboard by default
  if (!user.role) return <FullScreenLoader />;
  return <Dashboard />;
}

function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, subscription, subscriptionInfo, signOut } = useAuth();
  // Local mode = everything stays in localStorage, Firestore is never touched:
  // Firebase not configured (dev) OR a guest / trial user ("continue without an account") in production.
  const localMode = !isFirebaseConfigured || !!user?.isOffline;
  const isGuest = isFirebaseConfigured && !!user?.isOffline;

  const [children, setChildren] = useState<Child[]>([]);
  const [activeChildIdx, setActiveChildIdx] = useState(0);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [activeSection, setActiveSectionState] = useState<NavSection>(initialSection);
  // Keep the URL in step so a reload / "add to home screen" of /today stays on the Today screen.
  function setActiveSection(id: NavSection) {
    setActiveSectionState(id);
    try { window.history.replaceState(null, "", id === "today" ? "/today" : "/"); } catch { /* sandboxed */ }
  }
  const [installKind, setInstallKind] = useState<InstallKind>("none");
  const [showInstallGuide, setShowInstallGuide] = useState(false);

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
  const [showMigrate, setShowMigrate] = useState<number | null>(null); // number = local achievements to move
  const [migrating, setMigrating] = useState(false);
  const [showDeleteChild, setShowDeleteChild] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>("official");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  // Goals: form (create / edit), detail modal, and the goal whose result is being recorded.
  const [goalForm, setGoalForm] = useState<{ open: boolean; goal?: Goal }>({ open: false });
  const [goalDetail, setGoalDetail] = useState<Goal | null>(null);
  const [resultGoal, setResultGoal] = useState<Goal | null>(null);
  // const [champMood, setChampMood] = useState<"idle" | "happy" | "excited" | "streak" | "sleeping">("idle");

  const child = children[activeChildIdx];
  const tierLimits = TIER_LIMITS[subscription as SubscriptionTier] ?? TIER_LIMITS.free;

  const { achievements, loading: loadingAch, error: achError, addLocal, replaceLocal, removeLocal } =
    useAchievements(child?.childId ?? "", seedAchievements, localMode);
  const { logs: practiceLogs, error: logsError, addLocal: addLocalLog, removeLocal: removeLocalLog } =
    usePracticeLogs(child?.childId ?? "", localMode);
  const { reflections, error: reflectionsError, addLocal: addLocalReflection, removeLocal: removeLocalReflection } =
    useReflections(child?.childId ?? "", user?.role !== "teacher", localMode);
  const { goals, upsertLocal: upsertLocalGoal } = useGoals(child?.childId ?? "", localMode);

  // Install nudge (iOS guide / Android prompt) from the 2nd open on; see src/lib/install.ts.
  useEffect(() => {
    const n = bumpOpenCount();
    setInstallKind(installBannerKind(n));
    return onInstallPromptChange(() => setInstallKind(installBannerKind(n)));
  }, []);

  // Notification click while the app is already open: the service worker posts { type: "navigate" }.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "navigate" && e.data.url === "/today") setActiveSection("today");
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push: refresh an existing token at start (lastSeenAt) and show foreground pushes as a toast.
  useEffect(() => {
    if (!user || localMode) return;
    void refreshPushToken(currentIdToken, i18n.language);
    let off: (() => void) | undefined;
    void onForegroundPush((d) => { if (d.body) setToast({ kind: "info", message: d.body }); }).then((fn) => { off = fn; });
    return () => { off?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, localMode]);

  // Manifest shortcut "Амжилт нэмэх": open the add form once a child is ready (parents only).
  useEffect(() => {
    if (!child || pendingAction() !== "add-achievement" || user?.role === "teacher") return;
    setShowForm(true);
    try { window.history.replaceState(null, "", "/"); } catch { /* sandboxed */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.childId, user?.role]);

  useEffect(() => {
    if (user && !localMode && user.role === "teacher") {
      // Teacher roster is live: a newly linked student appears without a reload.
      return subscribeChildrenForTeacher(
        user.uid,
        (list) => { setChildren(list); setLoadingChildren(false); },
        (e) => { console.error("[champstep] teacher children failed:", e); setLoadingChildren(false); setToast({ kind: "error", message: t("status.errorLoading") }); }
      );
    }
    async function load() {
      if (!user) return;
      if (localMode) {
        const localChild = loadLocalChild();
        setChildren(localChild ? [localChild] : []);
        if (!localChild && user.role === "parent" && firstRunPending(user.uid)) { markFirstRunShown(user.uid); setShowAddChild(true); }
        setLoadingChildren(false);
        return;
      }
      try {
        let list: Child[] = [];
        if (user.role === "parent") {
          list = await getChildrenForParent(user.uid);
          const trial = list.length === 0 && !migrateAsked(user.uid) ? loadLocalData() : null;
          if (trial) {
            // Fresh account on a device that holds trial (guest) data: offer to move it over, once.
            markMigrateAsked(user.uid);
            markFirstRunShown(user.uid);
            setShowMigrate(trial.achievements.length);
          } else if (list.length === 0 && firstRunPending(user.uid)) {
            // No child is ever created automatically: a new parent gets the add-child
            // modal once; closing it leaves the empty state with its own "add" button.
            markFirstRunShown(user.uid); setShowAddChild(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** Goal result saved as an achievement: close the goal and link the two. */
  async function finishGoal(goalId: string, achievementId: string) {
    if (localMode) {
      const g = goals.find((x) => x.id === goalId);
      if (g) upsertLocalGoal({ ...g, status: "done", linkedAchievementId: achievementId, updatedAt: new Date().toISOString() });
      return;
    }
    try { await updateGoal(goalId, { status: "done", linkedAchievementId: achievementId }); }
    catch (e) { console.warn("[goals] could not close goal:", e); }
  }

  async function handleAddAchievement(draft: AchievementDraft) {
    if (!child) return;
    if (tierLimits.maxAchievements !== -1 && achievements.length >= tierLimits.maxAchievements) {
      setShowSubscription(true);
      setToast({ kind: "info", message: t("status.freeLimit", { max: tierLimits.maxAchievements }) });
      return;
    }
    const goalId = draft.prep?.goalId;
    if (!localMode) {
      // Offline v1: photos cannot be uploaded, so the achievement is saved without them
      // (an IndexedDB upload queue is a later version). Text is queued by Firestore.
      const offline = !navigator.onLine;
      const payload = offline && draft.images.length > 0 ? { ...draft, images: [] } : draft;
      try {
        const write = createAchievement(child.childId, payload);
        if (goalId) void write.then((id) => finishGoal(goalId, id));
        const outcome = await raceWrite(write, () => setToast({ kind: "error", message: t("status.errorSaving") }));
        setShowForm(false);
        setResultGoal(null);
        if (outcome === "queued" || offline) {
          setToast({ kind: "info", message: t(draft.images.length > 0 && offline ? "offline.photosLater" : "offline.queuedAchievement") });
          return;
        }
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
      imageURLs: [], // local mode: photos are not stored (blob: URLs would not survive a reload)
      ...(draft.prep ? { prep: draft.prep } : {}),
      createdAt: new Date().toISOString(),
    };
    addLocal(newItem);
    if (goalId) void finishGoal(goalId, newItem.id);
    setShowForm(false);
    setResultGoal(null);
    setToast({ kind: "success", message: t("status.saved") });
    celebrate({ mega: draft.awardType === "Gold" });
    // setChampMood("excited");
    // setTimeout(() => setChampMood("idle"), 3000);
  }

  async function handleUpdateChild(next: Child, avatarFile?: File) {
    if (!localMode) {
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

  async function handleAddNewChild(name: string, birthDate: string) {
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
      birthDate,
      bio: "",
      avatarUrl: undefined,
    };
    if (!localMode) {
      try { await createChild(newChild); }
      catch { setToast({ kind: "error", message: t("status.errorSaving") }); return; }
    } else {
      saveLocalChild(newChild);
    }
    setChildren((prev) => [...prev, newChild]);
    setActiveChildIdx(children.length);
    setShowAddChild(false);
    setToast({ kind: "success", message: t("status.childAdded", { name }) });
  }

  async function handleDeleteAchievement(id: string) {
    if (!localMode) {
      try {
        await deleteAchievement(id);
        setToast({ kind: "success", message: t("status.deleted") });
      } catch {
        setToast({ kind: "error", message: t("status.errorSaving") });
      }
      return;
    }
    removeLocal(id);
    setToast({ kind: "success", message: t("status.deleted") });
  }

  async function handleAddPracticeLog(log: { date: string; duration: number; content: string; goalId?: string }): Promise<SaveOutcome> {
    if (!child) return "saved";
    if (!localMode) {
      // Offline (or a stalled connection): the write sits in Firestore's queue and the
      // listener already shows it (hasPendingWrites); don't block the form on the server ack.
      try { return await raceWrite(createPracticeLog(child.childId, log), () => setToast({ kind: "error", message: t("status.errorSaving") })); }
      catch (e) { setToast({ kind: "error", message: t("status.errorSaving") }); throw e; } // form keeps the text
    }
    addLocalLog({ id: crypto.randomUUID(), childId: child.childId, ...log, createdAt: new Date().toISOString() });
    return "saved";
  }

  async function handleAddReflection(r: { date: string; mood: 1|2|3|4|5; content: string; parentNote?: string }) {
    if (!child) return;
    if (!localMode) {
      try { await createReflection(child.childId, r); }
      catch (e) { setToast({ kind: "error", message: t("status.errorSaving") }); throw e; } // form keeps the text
      return;
    }
    addLocalReflection({ id: crypto.randomUUID(), childId: child.childId, ...r, createdAt: new Date().toISOString() });
  }

  async function handleDeleteReflection(id: string) {
    if (!localMode) {
      try { await deleteReflection(id); }
      catch { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    removeLocalReflection(id);
  }

  async function handleDeletePracticeLog(id: string) {
    if (!localMode) {
      try { await deletePracticeLog(id); }
      catch { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    removeLocalLog(id);
  }

  // ---- goals -----------------------------------------------------------------
  const todayKey = localDateKey(new Date());
  const activeGoalCount = activeGoals(goals).length;
  const goalLimitReached = tierLimits.maxActiveGoals !== -1 && activeGoalCount >= tierLimits.maxActiveGoals;

  async function handleSaveGoal(draft: GoalDraft) {
    if (!child || !user) return;
    const editing = goalForm.goal;
    try {
      if (localMode) {
        const now = new Date().toISOString();
        upsertLocalGoal(editing
          ? { ...editing, ...draft, updatedAt: now }
          : { id: crypto.randomUUID(), childId: child.childId, parentId: user.uid, ...draft, status: "active", createdAt: now, updatedAt: now });
      } else if (editing) {
        await updateGoal(editing.id, draft);
      } else {
        await createGoal(child.childId, user.uid, draft);
      }
      setGoalForm({ open: false });
      setGoalDetail(null);
      setToast({ kind: "success", message: t("status.saved") });
    } catch {
      setToast({ kind: "error", message: t("status.errorSaving") });
    }
  }

  async function handleCancelGoal(goal: Goal) {
    try {
      if (localMode) upsertLocalGoal({ ...goal, status: "cancelled", updatedAt: new Date().toISOString() });
      else await updateGoal(goal.id, { status: "cancelled" });
      setGoalDetail(null);
    } catch {
      setToast({ kind: "error", message: t("status.errorSaving") });
    }
  }

  /** "Record the result": the achievement form opens prefilled with the goal + its practice stats. */
  function openGoalResult(goal: Goal) {
    setGoalDetail(null);
    setResultGoal(goal);
  }
  function openGoalForm(goal?: Goal) {
    setGoalDetail(null);
    setShowProfile(false);
    setGoalForm({ open: true, goal });
  }

  // "official" is open to every plan; "framed" / "portfolio" need hasPdf (Family+).
  function openPdfPreview(template: PdfTemplate) {
    if (!child) return;
    if (isPaidTemplate(template) && !tierLimits.hasPdf) {
      setShowSubscription(true);
      setToast({ kind: "info", message: t("pdf.premiumRequired") });
      return;
    }
    setPdfTemplate(template);
    setPreviewOpen(true);
  }

  async function handleSignOut() {
    if (!isFirebaseConfigured) saveLocalAchievements([]);
    await signOut(); // guest: child / achievements stay on this device (see the banner)
  }

  /** Guest banner: go to the sign-up form; the local data stays for the migration prompt after sign-up. */
  async function handleGuestSignUp() {
    try { sessionStorage.setItem(LOGIN_MODE_KEY, "signup"); } catch { /* private mode */ }
    await signOut();
  }

  /** Copy the trial (guest) data of this device into the new account, once, then clear it. Photos are not moved (none are stored locally). */
  async function handleMigrate() {
    const data = loadLocalData();
    if (!user || !data) { setShowMigrate(null); return; }
    setMigrating(true);
    try {
      const newChild: Child = {
        childId: `child_${user.uid.slice(0, 8)}_${Date.now()}`,
        parentId: user.uid,
        teacherIds: [],
        name: data.child.name,
        birthDate: data.child.birthDate,
        bio: data.child.bio ?? "",
        avatarUrl: undefined,
      };
      await createChild(newChild);
      for (const a of [...data.achievements].reverse()) {
        await createAchievement(newChild.childId, { title: a.title, date: a.date, location: a.location, category: a.category, description: a.description, awardType: a.awardType, images: [] });
      }
      for (const l of [...data.practiceLogs].reverse()) await createPracticeLog(newChild.childId, { date: l.date, duration: l.duration, content: l.content });
      for (const g of data.goals ?? []) if (g.status === "active") await createGoal(newChild.childId, user!.uid, { title: g.title, date: g.date, category: g.category, targetSessionsPerWeek: g.targetSessionsPerWeek, targetMinutes: g.targetMinutes });
      for (const r of [...data.reflections].reverse()) await createReflection(newChild.childId, { date: r.date, mood: r.mood, content: r.content, parentNote: r.parentNote });
      clearLocalData();
      void markGuestMigrated(user.uid);
      setChildren([newChild]);
      setActiveChildIdx(0);
      setShowMigrate(null);
      setToast({ kind: "success", message: t("guest.migrated", { name: newChild.name }) });
    } catch (e) {
      console.error("[champstep] migrate failed:", e);
      setToast({ kind: "error", message: t("status.errorSaving") });
    } finally {
      setMigrating(false);
    }
  }
  function handleMigrateDecline() {
    setShowMigrate(null);
    setShowAddChild(true);
  }

  /** Server error -> translated message (empty = use the caller's generic one). */
  function deleteErrorMessage(e: unknown): string {
    if (e instanceof DeleteError && e.reason === "rate_limited") return t("danger.account.rateLimited");
    return "";
  }

  /**
   * Delete the ACTIVE child (the one open in the profile editor). All data goes
   * server-side (/api/child/delete); the client only updates its own state.
   * Throws a translated message for the modal to display.
   */
  async function handleDeleteChild() {
    if (!child) return;
    const victim = child;
    if (!localMode) {
      try { await deleteChildRemote(victim.childId); }
      catch (e) { throw new Error(deleteErrorMessage(e) || t("danger.child.error")); }
    } else {
      clearLocalData();
    }
    const remaining = children.filter((c) => c.childId !== victim.childId);
    setChildren(remaining);
    setActiveChildIdx((i) => Math.min(i, Math.max(0, remaining.length - 1)));
    setShowDeleteChild(false);
    setShowProfile(false);
    setActiveSection("achievements");
    setToast({ kind: "success", message: t("danger.child.done", { name: victim.name }) });
  }

  /** Delete the signed-in account (/api/account/delete), then sign out -> login page shows a notice. */
  async function handleDeleteAccount() {
    if (!user) return;
    if (!localMode) {
      try { await deleteAccountRemote(user.email); }
      catch (e) { throw new Error(deleteErrorMessage(e) || t("danger.account.error")); }
    } else {
      clearLocalData();
    }
    try { sessionStorage.setItem("champstep.notice", "accountDeleted"); } catch { /* private mode */ }
    setShowAccount(false);
    await handleSignOut();
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
              <button type="button" onClick={() => setShowAccount(true)} className="cs-icon-btn" aria-label={t("danger.account.menu")} title={t("danger.account.menu")}>
                <UserCog size={20} strokeWidth={2} />
              </button>
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
          {showAccount && <AccountSettingsModal user={user} subscriptionInfo={subscriptionInfo} childrenCount={0} onClose={() => setShowAccount(false)} onDeleteAccount={handleDeleteAccount} />}
          {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
        </div>
      );
    }
    // A parent with no child (e.g. right after deleting the last one): empty state, not a dead end.
    return (
      <div className="min-h-screen supports-[height:100dvh]:min-h-dvh bg-bg font-sans">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <Logo size={22} />
          <div className="flex items-center gap-1">
            <LanguageChip />
            <button type="button" onClick={() => setShowAccount(true)} className="cs-icon-btn" aria-label={t("danger.account.menu")} title={t("danger.account.menu")}>
              <UserCog size={20} strokeWidth={2} />
            </button>
            <button type="button" onClick={handleSignOut} className="cs-btn cs-btn-outline cs-btn-sm">
              {t("auth.signOut")}
            </button>
          </div>
        </header>
        {isGuest && <GuestBanner onSignUp={handleGuestSignUp} />}
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="cs-card border-dashed p-8">
            <UserPlus size={40} strokeWidth={1.75} className="mx-auto text-ink-3" aria-hidden="true" />
            <h1 className="t-h1 mt-4">{t("children.empty.title")}</h1>
            <p className="t-body text-ink-2 mt-2">{t("children.empty.hint")}</p>
            <button type="button" onClick={() => setShowAddChild(true)} className="cs-btn cs-btn-primary mt-6">
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
              {t("children.empty.add")}
            </button>
          </div>
        </main>
        {showMigrate !== null && <MigrateModal count={showMigrate} busy={migrating} onConfirm={handleMigrate} onDecline={handleMigrateDecline} />}
        {showAddChild && showMigrate === null && <AddChildModal onClose={() => setShowAddChild(false)} onAdd={handleAddNewChild} />}
        {showAccount && user && <AccountSettingsModal user={user} subscriptionInfo={subscriptionInfo} childrenCount={0} onClose={() => setShowAccount(false)} onDeleteAccount={handleDeleteAccount} />}
        {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
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
  // >=90 % of a limit: the upgrade bar comes back even if dismissed. The child limit only
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
    { id: "today", label: t("nav.today"), Icon: CalendarCheck },
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
                aria-expanded={showUserMenu}
              >
                {child.avatarUrl
                  ? <img src={child.avatarUrl} alt={child.name} className="w-full h-full object-cover" />
                  : <span className="w-full h-full bg-primary-soft text-primary-soft-ink flex items-center justify-center text-[13px] font-extrabold">{child.name.slice(0, 1).toUpperCase()}</span>}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 cs-card shadow-float z-50 overflow-hidden py-1 cs-menu-in">
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
                  <MenuItem onClick={() => { setShowUserMenu(false); setShowAccount(true); }} Icon={UserCog} label={t("danger.account.menu")} />
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
      {isGuest && <GuestBanner onSignUp={handleGuestSignUp} />}
      {!localMode && <OfflineBanner />}

      {/* -- BODY: мобайл = flex-col, desktop = flex-row -- */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

        {/* == DESKTOP SIDEBAR == */}
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
                  <ArrowUp size={16} strokeWidth={2.5} aria-hidden="true" />{t("sub.upgrade")}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* == MAIN CONTENT == */}
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-bg pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6 print:p-0">
          <ExpiryBanner onRenew={openSubscription} />
          {user?.role === "teacher" && <TeacherBanner label={t("status.teacherMode")} />}
          <div key={activeSection} className="cs-section-in">
          {activeSection === "today" && (
            <div className="px-4 py-6 max-w-3xl mx-auto">
              <SectionHeader title={t("today.title")} subtitle={child.name} />
              <TodayPage
                kids={children}
                activeIdx={activeChildIdx}
                onSelectChild={setActiveChildIdx}
                logs={practiceLogs}
                onAdd={handleAddPracticeLog}
                onDelete={handleDeletePracticeLog}
                readOnly={isTeacher}
                goals={goals}
                onAddGoal={() => openGoalForm()}
                onOpenGoal={(g) => setGoalDetail(g)}
                onEditGoal={(g) => openGoalForm(g)}
                onGoalResult={openGoalResult}
              />
            </div>
          )}
          {activeSection === "achievements" && (
            <TimelineDashboard
              child={child}
              achievements={achievements}
              loading={loadingAch && !localMode}
              readOnly={isTeacher}
              onAddClick={() => setShowForm(true)}
              onTodayClick={() => setActiveSection("today")}
              nextGoal={(() => { const g = pickNextGoal(goals, todayKey); return g ? { title: g.title, daysLeft: goalStats(g, practiceLogs, todayKey).daysLeft } : null; })()}
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
                {user?.role === "parent" && child && !localMode && <ParentLinkPanel childId={child.childId} childName={child.name} onUseCode={useInviteCode} />}
                {user && !localMode && (
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
                  {PDF_TEMPLATES.map((id) => {
                    const locked = isPaidTemplate(id) && !tierLimits.hasPdf;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => openPdfPreview(id)}
                        disabled={pdfBusy}
                        data-testid={`pdf-template-${id}`}
                        data-locked={locked ? "true" : undefined}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-bg-soft active:bg-surface-muted disabled:opacity-40 min-h-[56px]"
                      >
                        <div className="min-w-0">
                          <span className={`t-body-strong ${locked ? "text-ink-2" : "text-ink"}`}>{t(`pdf.${id}`)}</span>
                          <p className="t-caption mt-0.5">{t(`pdf.${id}Desc`)}</p>
                          {locked && (
                            <span className="t-caption mt-1 inline-flex items-center gap-1 text-primary-soft-ink">
                              <Lock size={12} strokeWidth={2.5} aria-hidden />{t("pdf.lockedCaption")}
                            </span>
                          )}
                        </div>
                        {pdfTemplate === id && pdfBusy
                          ? <Loader2 size={20} className="animate-spin text-ink-3 shrink-0" />
                          : locked
                          ? <span className="cs-badge"><Lock size={16} aria-hidden /></span>
                          : <span className="cs-badge cs-badge-primary"><Download size={18} /></span>}
                      </button>
                    );
                  })}
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
                    <button type="button" onClick={() => setShowSubscription(true)} className="t-body-strong text-primary inline-flex items-center gap-2">
                      <Lock size={16} strokeWidth={2.5} aria-hidden />{t("pdf.premiumMessage")}
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
                ? <span className="text-warn font-bold inline-flex items-center gap-1"><AlertTriangle size={14} strokeWidth={2.5} aria-hidden />{t("sub.nearLimit", { count: achCount, max: maxAch })}</span>
                : childNear
                ? <span className="text-warn font-bold">{t("status.childLimit", { max: tierLimits.maxChildren })}</span>
                : <><span className="font-bold text-ink">{t("sub.tierNames.free").toUpperCase()}</span> · <span className="tabular-nums">{achCount}/{maxAch}</span> {t("summary.entries")}</>}
            </span>
            {!nearLimit && (
              <button type="button" onClick={dismissUpgradeBar} aria-label={t("sub.upgradeBarDismiss")} className="cs-icon-btn cs-icon-btn-sm ml-auto text-ink-3"><X size={16} /></button>
            )}
            <button type="button" onClick={() => setShowSubscription(true)} className="cs-btn cs-btn-primary cs-btn-xs shrink-0">
              <ArrowUp size={16} strokeWidth={2.5} aria-hidden="true" />{t("sub.upgrade")}
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
            <AddAchievementForm childId={child.childId} childName={child.name} allowPhotos={!localMode} onCancel={() => setShowForm(false)} onSubmit={handleAddAchievement} onError={(m) => setToast({ kind: "error", message: m })} />
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
              allowPhotos={!localMode}
              onError={(m) => setToast({ kind: "error", message: m })}
              onCancel={() => setEditingAchievement(null)}
              onSubmit={async (draft) => {
                if (!localMode) {
                  try {
                    const { updateAchievementWithImages } = await import("./lib/firebase");
                    await updateAchievementWithImages(editingAchievement.id, child.childId, draft, editingAchievement.imageURLs ?? []);
                    setEditingAchievement(null);
                    setToast({ kind: "success", message: t("status.entryUpdated") });
                  } catch {
                    setToast({ kind: "error", message: t("status.errorSaving") });
                  }
                } else {
                  replaceLocal({
                    ...editingAchievement,
                    title: draft.title, date: draft.date, location: draft.location, category: draft.category,
                    description: draft.description, awardType: draft.awardType,
                    imageURLs: draft.keptImageURLs ?? editingAchievement.imageURLs ?? [],
                    updatedAt: new Date().toISOString(),
                  });
                  setEditingAchievement(null);
                  setToast({ kind: "success", message: t("status.entryUpdated") });
                }
              }}
            />
          </div>
        </div>
      )}
      {showProfile && (
        <ChildProfileEditor
          child={child}
          onClose={() => setShowProfile(false)}
          onSave={handleUpdateChild}
          onError={(m) => setToast({ kind: "error", message: m })}
          onRequestDelete={isTeacher ? undefined : () => setShowDeleteChild(true)}
          onAddGoal={isTeacher ? undefined : () => openGoalForm()}
        />
      )}
      {goalForm.open && (
        <GoalForm
          childName={child.name}
          initial={goalForm.goal}
          limitReached={goalLimitReached}
          onUpgrade={() => { setGoalForm({ open: false }); setShowSubscription(true); }}
          onSubmit={handleSaveGoal}
          onCancel={() => setGoalForm({ open: false })}
        />
      )}
      {goalDetail && (
        <GoalDetailModal
          goal={goals.find((g) => g.id === goalDetail.id) ?? goalDetail}
          logs={practiceLogs}
          today={todayKey}
          readOnly={isTeacher}
          onClose={() => setGoalDetail(null)}
          onEdit={() => openGoalForm(goals.find((g) => g.id === goalDetail.id) ?? goalDetail)}
          onCancelGoal={() => handleCancelGoal(goals.find((g) => g.id === goalDetail.id) ?? goalDetail)}
          onResult={() => openGoalResult(goals.find((g) => g.id === goalDetail.id) ?? goalDetail)}
        />
      )}
      {resultGoal && (
        <div className="cs-modal-backdrop cs-backdrop-in print:hidden" onClick={() => setResultGoal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-2xl">
            <div className="cs-handle" />
            <AddAchievementForm
              childId={child.childId}
              childName={child.name}
              allowPhotos={!localMode}
              editing={false}
              initialDraft={{
                title: resultGoal.title,
                date: resultGoal.date,
                category: resultGoal.category,
                awardType: "Participant",
                prep: prepFromStats(resultGoal.id, goalStats(resultGoal, practiceLogs, todayKey)),
              }}
              onCancel={() => setResultGoal(null)}
              onSubmit={handleAddAchievement}
              onError={(m) => setToast({ kind: "error", message: m })}
            />
          </div>
        </div>
      )}
      {showDeleteChild && !isTeacher && (
        <DeleteChildModal
          child={child}
          counts={{
            achievements: achievements.length,
            photos: achievements.reduce((n, a) => n + a.imageURLs.length, 0),
            practiceLogs: practiceLogs.length,
            reflections: reflections.length,
          }}
          onCancel={() => setShowDeleteChild(false)}
          onPdf={() => { setShowDeleteChild(false); setShowProfile(false); openPdfPreview(pdfTemplate); }}
          onConfirm={handleDeleteChild}
        />
      )}
      {showAccount && user && (
        <AccountSettingsModal
          user={user}
          subscriptionInfo={subscriptionInfo}
          childrenCount={isTeacher ? 0 : children.length}
          onClose={() => setShowAccount(false)}
          onDeleteAccount={handleDeleteAccount}
          onShowInstall={() => setShowInstallGuide(true)}
        />
      )}
      {installKind !== "none" && !showInstallGuide && (
        <InstallBanner
          kind={installKind}
          bottomOffset={showUpgradeBar ? 116 : 72}
          onHow={() => setShowInstallGuide(true)}
          onInstall={() => { void promptInstall().then((r) => { if (r === "accepted") setInstallKind("none"); }); }}
          onLater={() => { snoozeInstall(); setInstallKind("none"); }}
        />
      )}
      {showInstallGuide && <InstallGuideModal onClose={() => { setShowInstallGuide(false); if (installKind !== "none") { snoozeInstall(); setInstallKind("none"); } }} />}
      {showSubscription && <SubscriptionModal initialTier={modalTier} onClose={() => { setShowSubscription(false); setModalTier(undefined); }} />}
      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        child={child}
        achievements={achievements}
        template={pdfTemplate}
        onTemplateChange={setPdfTemplate}
        canUsePaidTemplates={tierLimits.hasPdf}
        onUpgrade={() => { setPreviewOpen(false); setShowSubscription(true); }}
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

/** <=3 children: segmented control; 4+: scrollable pills. */
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
        aria-expanded={open}
      >
        <Globe size={20} strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 cs-card shadow-float overflow-hidden cs-menu-in origin-top-right z-50 py-1">
          {LANGS.map((l) => {
            const active = l.code === current;
            const Flag = l.Flag;
            return (
              <button
                key={l.code}
                type="button"
                aria-pressed={active}
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

/** YYYY-MM-DD, not in the future, not absurdly old. */
function isValidBirthDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  return y >= 1990 && d.getTime() <= Date.now();
}

/** Thin strip for guest / trial users: data lives on this device only; sign up to keep it. */
function GuestBanner({ onSignUp }: { onSignUp: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line bg-bg-soft px-4 py-1.5 text-center t-caption text-ink-2 print:hidden" data-testid="guest-banner">
      <span>{t("guest.banner")}</span>
      <button type="button" onClick={onSignUp} className="min-h-[32px] font-bold text-primary underline underline-offset-2 hover:text-primary-hover" data-testid="guest-signup">
        {t("guest.signUpSave")}
      </button>
    </div>
  );
}

/** After sign-up on a device with trial data: move it into the new account (once) or start empty. */
function MigrateModal({ count, busy, onConfirm, onDecline }: { count: number; busy: boolean; onConfirm: () => void; onDecline: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="cs-modal-backdrop cs-backdrop-in">
      <div className="cs-modal cs-panel-in sm:max-w-sm" role="dialog" aria-modal="true" aria-labelledby="migrate-title">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          <h2 id="migrate-title" className="t-h1 mb-1">{t("guest.migrateTitle")}</h2>
          <p className="t-body text-ink-2 mb-5">{t("guest.migrateBody", { count })}</p>
          <div className="flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={onDecline} disabled={busy} className="cs-btn cs-btn-ghost" data-testid="migrate-no">
              {t("guest.migrateNo")}
            </button>
            <button type="button" onClick={onConfirm} disabled={busy} className="cs-btn cs-btn-primary" data-testid="migrate-yes">
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {t("guest.migrateYes")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddChildModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, birthDate: string) => void | Promise<void> }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = name.trim().length > 0 && isValidBirthDate(birthDate);
  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try { await onAdd(name.trim(), birthDate); } finally { setSubmitting(false); }
  }
  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-sm" role="dialog" aria-modal="true" aria-labelledby="add-child-title">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          <h2 id="add-child-title" className="t-h1 mb-1">{t("children.addChild")}</h2>
          <p className="t-caption mb-4">{t("children.empty.hint")}</p>
          <label className="block">
            <span className="cs-field-label">{t("profile.fields.name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              placeholder={t("children.namePlaceholder")}
              className="cs-input"
              autoFocus
            />
          </label>
          <label className="mt-4 block">
            <span className="cs-field-label">{t("profile.fields.birthDate")}</span>
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              className="cs-input"
              data-testid="add-child-birthdate"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost">
              {t("form.actions.cancel")}
            </button>
            <button type="button" onClick={() => void submit()} disabled={!valid || submitting} className="cs-btn cs-btn-primary" data-testid="add-child-submit">
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
