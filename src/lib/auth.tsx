// =============================================================================
// AuthProvider v2 — role-based (bagsh/etseg eh), multi-child
// =============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User as FirebaseUser } from "firebase/auth";

import {
  activatePremium,
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
  role: UserRole;
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
  activateSubscription: (tier?: SubscriptionTier) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function fbUserToApp(u: FirebaseUser, role: UserRole = "parent"): AppUser {
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
        // Firestore-с role унших
        let role: UserRole = "parent";
        try {
          const userData = await getUserDoc(fbUser.uid);
          role = (userData?.role as UserRole) ?? "parent";
        } catch (e) {
          console.error("[champstep] getUserDoc failed:", e);
        }

        const appUser = fbUserToApp(fbUser, role);
        setUser(appUser);

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
        await signUpWithEmail(email, password, displayName, role);
      },

      async signInWithGoogle(role = "parent") {
        if (!isFirebaseConfigured) throw new Error("auth.errors.notConfigured");
        await fbSignInWithGoogle(role);
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
        await activatePremium(user.uid, tier);
        setSubscription(tier);
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
