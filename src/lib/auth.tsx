// =============================================================================
// AuthProvider — Single source of truth for "who is logged in".
// Works in three modes depending on config + user choice:
//   1) Firebase mode + signed-in → real Firebase user
//   2) Firebase mode + not signed-in → user=null, show LoginPage
//   3) Offline mode → mock user kept in localStorage
//
// Anything that needs user info (navbar avatar, subscription, PDF gating)
// should call useAuth(). Don't read from Firebase directly elsewhere.
// =============================================================================

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
} from "./firebase";
import {
  loadLocalSubscription,
  loadOfflineUser,
  saveLocalSubscription,
  saveOfflineUser,
  type OfflineUser,
} from "./localStore";
import type { SubscriptionStatus } from "../types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  isOffline: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  subscription: SubscriptionStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInOffline: (displayName?: string) => void;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  /** Demo: flip to premium (wires to QPay webhook in production). */
  activateSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function fbUserToApp(u: FirebaseUser): AppUser {
  return {
    uid: u.uid,
    email: u.email ?? "",
    displayName: u.displayName ?? (u.email ? u.email.split("@")[0] : "Parent"),
    isOffline: false,
  };
}

function offlineToApp(u: OfflineUser): AppUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    isOffline: true,
  };
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus>("free");

  // Subscribe to Firebase auth state OR rehydrate offline user.
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
        const appUser = fbUserToApp(fbUser);
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

      async signUp(email, password, displayName) {
        if (!isFirebaseConfigured) throw new Error("auth.errors.notConfigured");
        await signUpWithEmail(email, password, displayName);
      },

      async signInWithGoogle() {
        if (!isFirebaseConfigured) throw new Error("auth.errors.notConfigured");
        await fbSignInWithGoogle();
      },

      signInOffline(displayName?: string) {
        const offline: OfflineUser = {
          uid: "offline_" + crypto.randomUUID().slice(0, 8),
          email: "offline@champstep.local",
          displayName: displayName?.trim() || "Эцэг эх",
          createdAt: new Date().toISOString(),
        };
        saveOfflineUser(offline);
        setUser(offlineToApp(offline));
        setSubscription(loadLocalSubscription().status);
      },

      async signOut() {
        if (isFirebaseConfigured) {
          try {
            await fbSignOut();
          } catch (e) {
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

      async activateSubscription() {
        if (!user) throw new Error("auth.errors.notSignedIn");
        if (user.isOffline) {
          const now = new Date();
          const exp = new Date(now);
          exp.setMonth(exp.getMonth() + 1);
          saveLocalSubscription({
            status: "premium",
            activatedAt: now.toISOString(),
            expiresAt: exp.toISOString(),
          });
          setSubscription("premium");
          return;
        }
        await activatePremium(user.uid, 1);
        setSubscription("premium");
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
