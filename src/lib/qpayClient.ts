// =============================================================================
// qpayClient — /api/qpay/* serverless endpoint-уудыг дуудах frontend helper
// =============================================================================

import { auth } from "./firebase";

export interface QPayBankUrl {
  name: string;
  description: string;
  logo: string;
  link: string;
}

export interface CreateInvoiceResponse {
  orderId: string;
  invoiceId: string;
  qrImage: string; // base64 PNG
  qrText: string;
  urls: QPayBankUrl[];
}

export interface PaymentStatusResponse {
  status: "pending" | "paid";
  plan: string;
  expiresAt: string | null;
}

export const QPAY_SANDBOX = import.meta.env.VITE_QPAY_SANDBOX === "true";

async function idToken(): Promise<string> {
  const u = auth?.currentUser;
  if (!u) throw new Error("auth.errors.notSignedIn");
  return u.getIdToken();
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface QPayConfig { enabled: boolean; sandbox: boolean }
/** Whether the payment provider is configured on the server (no auth). Network errors → assume enabled. */
export async function getQPayConfig(): Promise<QPayConfig> {
  try {
    const res = await fetch("/api/qpay/config", { cache: "no-store" });
    if (!res.ok) return { enabled: true, sandbox: false };
    return (await res.json()) as QPayConfig;
  } catch {
    return { enabled: true, sandbox: false };
  }
}
export const PAYMENTS_DISABLED = "payments_disabled";

export async function createQPayInvoice(plan: string): Promise<CreateInvoiceResponse> {
  return post<CreateInvoiceResponse>("/api/qpay/create-invoice", { idToken: await idToken(), plan });
}

export async function getQPayStatus(orderId: string): Promise<PaymentStatusResponse> {
  return post<PaymentStatusResponse>("/api/qpay/status", { idToken: await idToken(), orderId });
}

/** Зөвхөн sandbox: серверт production үед 404 буцаана. */
export async function simulateQPayPaid(orderId: string): Promise<PaymentStatusResponse> {
  return post<PaymentStatusResponse>("/api/qpay/simulate-paid", { idToken: await idToken(), orderId });
}
