// =============================================================================
// AuthProvider v2 — role-based (bagsh/etseg eh), multi-child
// =============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User as FirebaseUser } from "firebase/auth";

import {
  getSubscriptionStatus,
  isFirebaseConfigured,
  onAuthChange,
  signInWithEmail,
  signInWithGoogle as fbSignInWithGoogle,
  signOut as fbSignOut,
  signUpWithEmail,
  getUserDoc,
} from "./firebase";
import {
  loadLocalSubscription,
  loadOfflineUser,
  saveLocalSubscription,
  saveOfflineUser,
  type OfflineUser,
} from "./localStore";
import type { SubscriptionTier, UserRole } from "../types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  /** undefined while users/{uid} has not been read yet — App shows a loader, never a dashboard. */
  role: UserRole | undefined;
  isOffline: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  subscription: SubscriptionTier;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  signInWithGoogle: (role?: UserRole) => Promise<void>;
  signInOffline: (displayName?: string, role?: UserRole) => void;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  /** Зөвхөн offline (Firebase-гүй) горимд локал багц идэвхжүүлнэ. Online-д багц зөвхөн серверээр (QPay / promo) идэвхжинэ. */
  activateSubscription: (tier?: SubscriptionTier) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function fbUserToApp(u: FirebaseUser, role: UserRole | undefined): AppUser {
  return {
    uid: u.uid,
    email: u.email ?? "",
    displayName: u.displayName ?? (u.email ? u.email.split("@")[0] : "Хэрэглэгч"),
    role,
    isOffline: false,
  };
}

function offlineToApp(u: OfflineUser): AppUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    role: (u as OfflineUser & { role?: UserRole }).role ?? "parent",
    isOffline: true,
  };
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionTier>("free");
  // onAuthStateChanged fires BEFORE signUpWithEmail() has finished (updateProfile +
  // ensureUserDoc). The dashboard must not mount until users/{uid}.role exists: mounting
  // earlier made a new teacher look like a parent AND created Firestore listeners during the
  // sign-up token refresh, which were rejected with permission-denied and stayed dead.
  const signingUp = useRef(false);

  async function resolveRole(uid: string): Promise<UserRole | undefined> {
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const data = await getUserDoc(uid);
        const r = data?.role;
        if (r === "parent" || r === "teacher") return r;
      } catch (e) {
        console.error("[champstep] getUserDoc failed:", e);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (signingUp.current) return undefined; // signUp() will set it
    console.warn("[champstep] users doc has no role after 20s; defaulting to parent");
    return "parent";
  }
  /** Set role without creating a new user object when nothing changes (avoids duplicate effects). */
  function applyRole(uid: string, role: UserRole | undefined) {
    setUser((prev) => (prev && prev.uid === uid && prev.role !== role ? { ...prev, role } : prev));
  }

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const offline = loadOfflineUser();
      if (offline) {
        setUser(offlineToApp(offline));
        setSubscription(loadLocalSubscription().status);
      }
      setLoading(false);
      return;
    }

    const unsub = onAuthChange(async (fbUser) => {
      if (fbUser) {
        // Show the loader (role undefined) until users/{uid}.role is known.
        setUser((prev) => (prev && prev.uid === fbUser.uid ? prev : fbUserToApp(fbUser, undefined)));
        setLoading(false);
        const role = await resolveRole(fbUser.uid);
        if (role) applyRole(fbUser.uid, role);

        try {
          const sub = await getSubscriptionStatus(fbUser.uid);
          setSubscription(sub);
        } catch (e) {
          console.error("[champstep] getSubscriptionStatus failed:", e);
          setSubscription("free");
        }
      } else {
        setUser(null);
        setSubscription("free");
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      subscription,

      async signIn(email, password) {
        if (!isFirebaseConfigured) throw new Error("auth.errors.notConfigured");
        await signInWithEmail(email, password);
      },
      async signUp(email, password, displayName, role) {
        if (!isFirebaseConfigured) throw new Error("auth.errors.notConfigured");
        signingUp.current = true;
        try {
          const u = await signUpWithEmail(email, password, displayName, role);
          // profile + users/{uid}.role are written now — safe to mount the dashboard.
          applyRole(u.uid, role);
        } finally {
          signingUp.current = false;
        }
      },
      async signInWithGoogle(role = "parent") {
        if (!isFirebaseConfigured) throw new Error("auth.errors.notConfigured");
        signingUp.current = true;
        try {
          const u = await fbSignInWithGoogle(role);
          const data = await getUserDoc(u.uid);
          const r = data?.role;
          applyRole(u.uid, r === "parent" || r === "teacher" ? r : role);
        } finally {
          signingUp.current = false;
        }
      },

      signInOffline(displayName?: string, role: UserRole = "parent") {
        const offline: OfflineUser & { role: UserRole } = {
          uid: "offline_" + crypto.randomUUID().slice(0, 8),
          email: "offline@champstep.local",
          displayName: displayName?.trim() || "Эцэг эх",
          role,
          createdAt: new Date().toISOString(),
        };
        saveOfflineUser(offline);
        setUser(offlineToApp(offline));
        setSubscription(loadLocalSubscription().status);
      },

      async signOut() {
        if (isFirebaseConfigured) {
          try { await fbSignOut(); } catch (e) {
            console.error("[champstep] signOut failed:", e);
          }
        } else {
          saveOfflineUser(null);
        }
        setUser(null);
        setSubscription("free");
      },

      async refreshSubscription() {
        if (!user) return;
        if (user.isOffline) {
          setSubscription(loadLocalSubscription().status);
          return;
        }
        try {
          const sub = await getSubscriptionStatus(user.uid);
          setSubscription(sub);
        } catch (e) {
          console.error("[champstep] refreshSubscription failed:", e);
        }
      },

      async activateSubscription(tier: SubscriptionTier = "family") {
        if (!user) throw new Error("auth.errors.notSignedIn");
        if (user.isOffline) {
          const now = new Date();
          const exp = new Date(now);
          exp.setMonth(exp.getMonth() + 1);
          saveLocalSubscription({
            status: tier,
            activatedAt: now.toISOString(),
            expiresAt: exp.toISOString(),
          });
          setSubscription(tier);
          return;
        }
        // Online: users/{uid}-ийн багцын талбарыг client бичих эрхгүй (Firestore rules).
        throw new Error("auth.errors.serverOnly");
      },
    }),
    [user, loading, subscription]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
