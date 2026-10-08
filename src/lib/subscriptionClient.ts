// src/lib/subscriptionClient.ts — /api/subscription/status (server decides expiry).
import { auth } from "./firebase";
import { infoFromDoc, type SubscriptionInfo } from "./subscription";

export interface SubscriptionStatusResponse {
  tier: "free" | "family" | "master" | "coach";
  expiresAt: string | null;
  expiredFrom: string | null;
  expiredAt: string | null;
  legacy: boolean;
  justExpired: boolean;
}

/** Ask the server for the current subscription; an expired paid plan is downgraded to free there. */
export async function fetchSubscriptionStatus(): Promise<(SubscriptionInfo & { justExpired: boolean; legacy: boolean }) | null> {
  const u = auth?.currentUser;
  if (!u) return null;
  const res = await fetch("/api/subscription/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: await u.getIdToken() }),
  });
  if (!res.ok) throw new Error(`subscription status HTTP ${res.status}`);
  const data = (await res.json()) as SubscriptionStatusResponse;
  return {
    ...infoFromDoc({ subscriptionTier: data.tier, subscriptionExpiresAt: data.expiresAt, expiredFrom: data.expiredFrom, expiredAt: data.expiredAt }),
    justExpired: data.justExpired,
    legacy: data.legacy,
  };
}
