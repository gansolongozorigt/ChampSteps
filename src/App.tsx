// =============================================================================
// App v2 — multi-child, role-based dashboard
// =============================================================================

import { useEffect, useState } from "react";
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
  ensureChildDoc,
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

type ToastState = { kind: ToastKind; message: string } | null;

export default function App() {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <FullScreenLoader />;
  if (!user) return <LoginPage />;
  return <Dashboard />;
}

// =============================================================================
// Dashboard
// =============================================================================

function Dashboard() {
  const { t } = useTranslation();
  const { user, subscription, signOut } = useAuth();

  const [children, setChildren] = useState<Child[]>([]);
  const [activeChildIdx, setActiveChildIdx] = useState(0);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>("official");
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
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
    if (achError) setToast({ kind: "error", message: t("status.errorLoading") });
  }, [achError, t]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleAddAchievement(draft: AchievementDraft) {
    if (!child) return;
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
      } catch (e) {
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
      } catch (e) {
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
      setToast({ kind: "info", message: `Таны эрхэд ${tierLimits.maxChildren} хүүхэд хүртэл боломжтой.` });
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
    setToast({ kind: "success", message: `${name}-г нэмлээ.` });
  }

  async function handleDeleteAchievement(id: string) {
    if (isFirebaseConfigured) {
      try {
        await deleteAchievement(id);
        setToast({ kind: "success", message: "Бичлэг устгагдлаа." });
      } catch (e) {
        setToast({ kind: "error", message: t("status.errorSaving") });
      }
      return;
    }
    const updated = achievements.filter((a) => a.id !== id);
    saveLocalAchievements(updated);
    setToast({ kind: "success", message: "Бичлэг устгагдлаа." });
  }

  async function handleAddPracticeLog(log: { date: string; duration: number; content: string }) {
    if (!child) return;
    if (isFirebaseConfigured) {
      try { await createPracticeLog(child.childId, log); }
      catch (e) { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    addLocalLog({ id: crypto.randomUUID(), childId: child.childId, ...log, createdAt: new Date().toISOString() });
  }

  async function handleAddReflection(r: { date: string; mood: 1|2|3|4|5; content: string; parentNote?: string }) {
    if (!child) return;
    if (isFirebaseConfigured) {
      try { await createReflection(child.childId, r); }
      catch (e) { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    addLocalReflection({ id: crypto.randomUUID(), childId: child.childId, ...r, createdAt: new Date().toISOString() });
  }

  async function handleDeleteReflection(id: string) {
    if (isFirebaseConfigured) {
      try { await deleteReflection(id); }
      catch (e) { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    removeLocalReflection(id);
  }

  async function handleDeletePracticeLog(id: string) {
    if (isFirebaseConfigured) {
      try { await deletePracticeLog(id); }
      catch (e) { setToast({ kind: "error", message: t("status.errorSaving") }); }
      return;
    }
    removeLocalLog(id);
  }

  async function handleDownloadPdf() {
    if (!child) return;
    if (!tierLimits.hasPdf) {
      setShowSubscription(true);
      setToast({ kind: "info", message: t("pdf.premiumRequired") });
      return;
    }
    setPdfBusy(true);
    try {
      await exportPortfolio(child, achievements, { t, template: pdfTemplate });
      setToast({ kind: "success", message: t("pdf.success") });
    } catch (e) {
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
        <p className="text-stone-500">Хүүхэд олдсонгүй.</p>
      </div>
    );
  }

  const isPremium = subscription !== "free";
  const canAddChild = user?.role === "parent" && children.length < tierLimits.maxChildren;

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 font-sans">
      {/* ================================================================
          NAVBAR
      ================================================================ */}
      <nav className="sticky top-0 z-40 border-b border-stone-200 bg-white/80 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-stone-900 overflow-hidden">
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                <defs>
                  <linearGradient id="nl1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d97706" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#d97706" stopOpacity="0.1"/>
                  </linearGradient>
                  <linearGradient id="nl2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24"/>
                    <stop offset="100%" stopColor="#d97706"/>
                  </linearGradient>
                </defs>
                <rect x="4" y="32" width="10" height="12" rx="2" fill="url(#nl1)"/>
                <rect x="17" y="22" width="10" height="22" rx="2" fill="#d97706" opacity="0.6"/>
                <rect x="30" y="10" width="10" height="34" rx="2" fill="url(#nl2)"/>
                <circle cx="35" cy="7" r="5" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <h1 className="font-bold tracking-tight text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              Champ<span style={{ background: "linear-gradient(135deg, #d97706, #92400e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Step</span>
            </h1>
            {isPremium && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                {subscription.toUpperCase()}
              </span>
            )}
          </div>

          {/* Child switcher — desktop only */}
          {children.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 p-1">
              {children.map((c, i) => (
                <button
                  key={c.childId}
                  onClick={() => setActiveChildIdx(i)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    i === activeChildIdx
                      ? "bg-stone-900 text-white"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {c.name}
                </button>
              ))}
              {canAddChild && (
                <button
                  onClick={() => setShowAddChild(true)}
                  className="rounded-full px-2 py-1 text-xs text-stone-400 hover:text-stone-700"
                  title={t("children.addChild")}
                >
                  +
                </button>
              )}
            </div>
          )}

          {/* Nav actions */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="relative">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={pdfBusy}
                  className="text-xs font-medium text-stone-500 transition-colors hover:text-stone-900 disabled:opacity-50"
                >
                  {pdfBusy ? "..." : "PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  ▾
                </button>
              </div>
              {showTemplateMenu && (
                <div className="absolute right-0 top-6 z-50 w-40 rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden">
                  {([
                    { id: "official", label: "📄 Албан ёсны" },
                    { id: "kids", label: "🎨 Хүүхэдлэг" },
                    { id: "gold", label: "✨ Алтлаг" },
                  ] as { id: PdfTemplate; label: string }[]).map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => { setPdfTemplate(tmpl.id); setShowTemplateMenu(false); }}
                      className={`w-full px-3 py-2 text-left text-xs transition hover:bg-stone-50 ${pdfTemplate === tmpl.id ? "font-semibold text-stone-900" : "text-stone-600"}`}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowSubscription(true)}
              className="hidden sm:block text-xs font-medium text-stone-500 transition-colors hover:text-stone-900"
            >
              {t("nav.subscription")}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden sm:block text-xs font-medium text-stone-500 transition-colors hover:text-stone-900"
            >
              {t("auth.signOut")}
            </button>
            <button
              type="button"
              onClick={() => setShowProfile(true)}
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

        {/* ============================================================
            MOBILE CHILD TAB BAR — navbar-ын доор
        ============================================================ */}
        <div className="sm:hidden border-t border-stone-100 bg-white px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {children.map((c, i) => (
            <button
              key={c.childId}
              onClick={() => setActiveChildIdx(i)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition shrink-0 ${
                i === activeChildIdx
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt={c.name} className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-stone-300 text-[9px] font-bold text-stone-600">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              {c.name}
            </button>
          ))}
          {canAddChild && (
            <button
              onClick={() => setShowAddChild(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-xs text-stone-400 hover:border-stone-400 hover:text-stone-600 whitespace-nowrap shrink-0 transition"
            >
              + {t("children.addChild")}
            </button>
          )}
        </div>
      </nav>

      {/* Offline banner */}
      {!isFirebaseConfigured && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-800 print:hidden">
          ⚠️ {t("status.offlineBanner")}
        </div>
      )}

      {/* Teacher banner */}
      {user?.role === "teacher" && (
        <div className="bg-blue-50 px-4 py-2 text-center text-xs text-blue-700 print:hidden">
          🏫 Багшийн горим — шавь нарын бүртгэлийг удирдаж байна
        </div>
      )}

      {/* Main */}
      <main className="flex-grow print:p-0">
        <TimelineDashboard
          child={child}
          achievements={achievements}
          onAddClick={() => setShowForm(true)}
          onEditProfile={() => setShowProfile(true)}
          onEditAchievement={(a) => setEditingAchievement(a)}
          onDeleteAchievement={handleDeleteAchievement}
        />
      </main>

      {/* Practice Log */}
      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <PracticeLogSection
          childId={child.childId}
          logs={practiceLogs}
          onAdd={handleAddPracticeLog}
          onDelete={handleDeletePracticeLog}
        />
      </div>

      {/* Reflection */}
      {user?.role === "parent" && (
        <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
          <ReflectionSection
            childId={child.childId}
            reflections={reflections}
            onAdd={handleAddReflection}
            onDelete={handleDeleteReflection}
          />
        </div>
      )}

      {/* Invite section */}
      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <div className="mt-2 mb-6">
          <h2 className="font-serif text-xl text-stone-900 mb-4">{t("invite.parent.heading")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {user?.role === "teacher" && (
              <TeacherInvitePanel
                teacherId={user.uid}
                teacherName={user.displayName}
                onCreateCode={createInviteCode}
              />
            )}
            {user?.role === "parent" && child && (
              <ParentLinkPanel
                childId={child.childId}
                childName={child.name}
                onUseCode={useInviteCode}
              />
            )}
          </div>
        </div>
      </div>

      {loadingAch && isFirebaseConfigured && (
        <div className="fixed inset-x-0 top-16 z-40 flex justify-center p-2 print:hidden">
          <div className="rounded-full bg-white/90 px-4 py-1.5 text-xs text-stone-600 shadow ring-1 ring-stone-200 backdrop-blur">
            {t("status.loading")}
          </div>
        </div>
      )}

      {/* Add Achievement modal */}
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

      {/* Edit Achievement modal */}
      {editingAchievement && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-2 backdrop-blur-sm sm:items-center sm:p-4 print:hidden"
          onClick={() => setEditingAchievement(null)}
        >
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
                    await updateAchievement(editingAchievement.id, {
                      title: draft.title,
                      date: draft.date,
                      location: draft.location,
                      category: draft.category,
                      description: draft.description,
                      awardType: draft.awardType,
                    });
                    setEditingAchievement(null);
                    setToast({ kind: "success", message: "Бичлэг шинэчлэгдлээ." });
                  } catch (e) {
                    setToast({ kind: "error", message: t("status.errorSaving") });
                  }
                } else {
                  setEditingAchievement(null);
                  setToast({ kind: "success", message: "Бичлэг шинэчлэгдлээ." });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfile && (
        <ChildProfileEditor
          child={child}
          onClose={() => setShowProfile(false)}
          onSave={handleUpdateChild}
        />
      )}

      {/* Subscription modal */}
      {showSubscription && <SubscriptionModal onClose={() => setShowSubscription(false)} />}

      {/* Add child modal */}
      {showAddChild && (
        <AddChildModal
          onClose={() => setShowAddChild(false)}
          onAdd={handleAddNewChild}
        />
      )}

      {toast && (
        <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Add child modal
// -----------------------------------------------------------------------------

function AddChildModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="font-serif text-xl text-stone-900">{t("children.addChild")}</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Хүүхдийн нэр"
          className="mt-4 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-500 hover:bg-stone-100">
            {t("form.actions.cancel")}
          </button>
          <button
            onClick={() => name.trim() && onAdd(name.trim())}
            disabled={!name.trim()}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {t("children.addChild")}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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
