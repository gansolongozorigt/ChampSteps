// =============================================================================
// App — Root shell.
// Routing is intentionally simple (no react-router): if the user is not signed
// in, we render <LoginPage />. Once signed in, we render the Dashboard shell
// with the custom navbar (logo, PDF download, Subscription, avatar, sign out).
//
// Data modes:
//   • Firebase mode  → Firestore + Storage + Auth.
//   • Offline mode   → React state + localStorage (so changes persist on reload).
// =============================================================================

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";

import AddAchievementForm from "./components/AddAchievementForm";
import ChildProfileEditor from "./components/ChildProfileEditor";
import LoginPage from "./components/LoginPage";
import SubscriptionModal from "./components/SubscriptionModal";
import TimelineDashboard from "./components/TimelineDashboard";
import Toast, { type ToastKind } from "./components/Toast";
import { useAchievements } from "./hooks/useAchievements";
import { useAuth } from "./lib/auth";
import {
  createAchievement,
  db,
  ensureChildDoc,
  isFirebaseConfigured,
  updateChild as fbUpdateChild,
} from "./lib/firebase";
import {
  loadLocalChild,
  saveLocalAchievements,
  saveLocalChild,
} from "./lib/localStore";
import { exportPortfolio } from "./lib/pdfExport";
import type { Achievement, AchievementDraft, Child } from "./types";

// -----------------------------------------------------------------------------
// Seed data (used as starter in Firebase mode, initial values in offline mode)
// -----------------------------------------------------------------------------

const initialChild: Child = {
  childId: "child_001",
  parentId: "user_001",
  name: "Туяа",
  birthDate: "2015-09-12",
  bio: "11 настай · шатар, усан будагны шүтэн бишрэгч",
  avatarUrl: undefined,
};

const seedAchievements: Achievement[] = [
  {
    id: "a1",
    childId: "child_001",
    title: "Улсын математикийн олимпиад — 2-р үе шат",
    date: "2026-04-12",
    location: "Улаанбаатар",
    category: "Academic",
    description: "Бүсийн сонгон шалгаруулалтад 240 сурагчаас эхний 10-т багтсан.",
    awardType: "Gold",
    imageURLs: [],
  },
];

type ToastState = { kind: ToastKind; message: string } | null;

// -----------------------------------------------------------------------------

export default function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard />;
}

// =============================================================================
// Dashboard — Only rendered when a user is signed in (real or offline).
// =============================================================================

function Dashboard() {
  const { t } = useTranslation();
  const { user, subscription, signOut } = useAuth();

  // Child profile — offline mode persists through localStorage.
  const [child, setChild] = useState<Child>(() =>
    isFirebaseConfigured ? initialChild : loadLocalChild(initialChild)
  );

  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const {
    achievements,
    loading: loadingAch,
    error: achError,
    addLocal,
  } = useAchievements(child.childId, seedAchievements);

  // Load child profile from Firestore once on mount (Firebase mode only).
  useEffect(() => {
    async function loadChildData() {
      if (!isFirebaseConfigured || !db) return;
      try {
        await ensureChildDoc({ ...initialChild, parentId: user?.uid ?? initialChild.parentId });
        const snap = await getDoc(doc(db, "children", initialChild.childId));
        if (snap.exists()) {
          const data = snap.data() as Partial<Child> & { avatarUrl?: string | null };
          setChild({
            ...initialChild,
            ...data,
            avatarUrl: data.avatarUrl ?? undefined,
          } as Child);
        }
      } catch (e) {
        console.error("[champstep] loadChildData failed:", e);
      }
    }
    loadChildData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface subscription errors as toast.
  useEffect(() => {
    if (achError) setToast({ kind: "error", message: t("status.errorLoading") });
  }, [achError, t]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleAddAchievement(draft: AchievementDraft) {
    if (isFirebaseConfigured) {
      try {
        await createAchievement(child.childId, draft);
        setShowForm(false);
        setToast({ kind: "success", message: t("status.saved") });
      } catch (e) {
        console.error("[champstep] createAchievement failed:", e);
        setToast({ kind: "error", message: t("status.errorSaving") });
      }
      return;
    }

    // Offline mode — persist to localStorage via the hook.
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
        setChild(saved);
        setToast({ kind: "success", message: t("status.savedProfile") });
      } catch (e) {
        console.error("[champstep] updateChild failed:", e);
        setToast({ kind: "error", message: t("status.errorSaving") });
      }
      return;
    }

    // Offline: if they attached an avatar file, convert to a stable data URL
    // so it survives reload (object URLs die with the page).
    let nextWithAvatar = next;
    if (avatarFile) {
      try {
        const dataUrl = await fileToDataUrl(avatarFile);
        nextWithAvatar = { ...next, avatarUrl: dataUrl };
      } catch (e) {
        console.warn("[champstep] avatar read failed:", e);
      }
    }
    setChild(nextWithAvatar);
    saveLocalChild(nextWithAvatar);
    setToast({ kind: "success", message: t("status.savedProfile") });
  }

  async function handleDownloadPdf() {
    if (subscription !== "premium") {
      setShowSubscription(true);
      setToast({ kind: "info", message: t("pdf.premiumRequired") });
      return;
    }
    setPdfBusy(true);
    try {
      await exportPortfolio(child, achievements, { t });
      setToast({ kind: "success", message: t("pdf.success") });
    } catch (e) {
      console.error("[champstep] pdf export failed:", e);
      setToast({ kind: "error", message: t("pdf.error") });
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleSignOut() {
    if (!isFirebaseConfigured) {
      // In offline mode, signing out clears the profile cache too so the next
      // person on the device starts fresh.
      saveLocalAchievements([]);
      saveLocalChild(initialChild);
    }
    await signOut();
  }

  // ---------------------------------------------------------------------------

  const isPremium = subscription === "premium";

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 font-sans">
      {/* 1. Navbar */}
      <nav className="sticky top-0 z-40 border-b border-stone-200 bg-white/80 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-stone-900">
              <span className="text-xs font-bold text-white">C</span>
            </div>
            <h1 className="font-bold tracking-tight text-stone-900">ChampStep</h1>
            {isPremium && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                {t("subscription.premium")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              className="text-xs font-medium text-stone-500 transition-colors hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pdfBusy ? t("pdf.generating") : t("nav.pdfDownload")}
            </button>

            <button
              type="button"
              onClick={() => setShowSubscription(true)}
              className="text-xs font-medium text-stone-500 transition-colors hover:text-stone-900"
            >
              {t("nav.subscription")}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-medium text-stone-500 transition-colors hover:text-stone-900"
            >
              {t("auth.signOut")}
            </button>

            <button
              type="button"
              onClick={() => setShowProfile(true)}
              aria-label={t("app.editProfile")}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-stone-100"
            >
              {child.avatarUrl ? (
                <img src={child.avatarUrl} alt={child.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold uppercase text-stone-500">
                  {child.name.slice(0, 1)}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {!isFirebaseConfigured && <OfflineBanner />}

      {/* 2. Dashboard */}
      <main className="flex-grow print:p-0">
        <TimelineDashboard
          child={child}
          achievements={achievements}
          onAddClick={() => setShowForm(true)}
          onEditProfile={() => setShowProfile(true)}
        />
      </main>

      {loadingAch && isFirebaseConfigured && <LoadingOverlay message={t("status.loading")} />}

      {/* 3. Add Achievement modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-2 backdrop-blur-sm sm:items-center sm:p-4 print:hidden"
          onClick={() => setShowForm(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
            <AddAchievementForm
              childId={child.childId}
              childName={child.name}
              onCancel={() => setShowForm(false)}
              onSubmit={handleAddAchievement}
            />
          </div>
        </div>
      )}

      {/* 4. Profile modal — ChildProfileEditor renders its own backdrop. */}
      {showProfile && (
        <ChildProfileEditor
          child={child}
          onClose={() => setShowProfile(false)}
          onSave={handleUpdateChild}
        />
      )}

      {/* 5. Subscription modal */}
      {showSubscription && <SubscriptionModal onClose={() => setShowSubscription(false)} />}

      {toast && (
        <Toast
          kind={toast.kind}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function OfflineBanner() {
  const { t } = useTranslation();
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-800 print:hidden">
      ⚠️ {t("status.offlineBanner")}
    </div>
  );
}

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-x-0 top-16 z-40 flex justify-center p-2 print:hidden">
      <div className="rounded-full bg-white/90 px-4 py-1.5 text-xs text-stone-600 shadow ring-1 ring-stone-200 backdrop-blur">
        {message}
      </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="flex items-center gap-3 text-sm text-stone-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
        ChampStep…
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
