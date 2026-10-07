// =============================================================================
// promoClient — /api/promo/* serverless endpoint-уудыг дуудах frontend helper.
// promoCodes коллекцод client шууд хандах эрхгүй (Firestore rules).
// =============================================================================

import { auth } from "./firebase";

export interface PromoCode {
  code: string;
  discountMonths: number;
  usedBy: string[];
  maxUses: number;
  expiresAt: string | null;
  active: boolean;
}

export type PromoRejectReason = "not_found" | "inactive" | "expired" | "used" | "exhausted" | "downgrade";

export class PromoError extends Error {
  constructor(public reason: PromoRejectReason | "invalid_code" | "unknown", public status: number) {
    super(reason);
    this.name = "PromoError";
  }
}

async function idToken(): Promise<string> {
  const u = auth?.currentUser;
  if (!u) throw new Error("auth.errors.notSignedIn");
  return u.getIdToken();
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, idToken: await idToken() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const reason = (data.error ?? "unknown") as PromoError["reason"];
    throw new PromoError(reason, res.status);
  }
  return res.json() as Promise<T>;
}

export function applyPromoCode(code: string) {
  return post<{ plan: string; months: number; expiresAt: string }>("/api/promo/apply", { code });
}

// --- admin ---
export async function listPromoCodes(): Promise<PromoCode[]> {
  const r = await post<{ codes: PromoCode[] }>("/api/promo/admin", { action: "list" });
  return r.codes;
}

export function createPromoCode(input: { code: string; discountMonths: number; maxUses: number; expiresAt: string }) {
  return post<{ ok: true }>("/api/promo/admin", { action: "create", ...input });
}

export function togglePromoCode(code: string, active: boolean) {
  return post<{ ok: true }>("/api/promo/admin", { action: "toggle", code, active });
}

export function seedPromoCodes() {
  return post<{ ok: true }>("/api/promo/admin", { action: "seed" });
}
