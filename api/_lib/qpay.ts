// api/_lib/qpay.ts — QPay v2 API client (server only)
//
// Sandbox:    https://merchant-sandbox.qpay.mn
// Production: https://merchant.qpay.mn
// Орчин солихдоо зөвхөн QPAY_BASE_URL / QPAY_USERNAME / QPAY_PASSWORD /
// QPAY_INVOICE_CODE env var-уудыг солино.
//
// Access token (QPay-ийн шаардлага: хүсэлт бүрт шинээр авахгүй):
//   1. instance-ийн санах ой (warm instance)
//   2. Firestore system/qpayToken (бүх serverless instance хуваалцана)
//   3. хугацаа дуусахаас REFRESH_MARGIN_MS өмнө шинэчилнэ
//   4. зэрэг хүсэлтүүд: нэг instance дотор single-flight promise,
//      instance хооронд Firestore lock (lockedAt) — зөвхөн нэг нь /v2/auth/token дуудна,
//      бусад нь doc-ийг poll хийж хүлээнэ.
// Клиент бүхэлдээ deps-ээр (fetch / now / env / store) дамждаг тул test:api-д
// Firebase болон сүлжээгүйгээр туршиж болно.

export class QPayError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "QPayError";
    this.status = status;
    this.body = body;
  }
}

// -----------------------------------------------------------------------------
// Token cache types + pure helpers
// -----------------------------------------------------------------------------

export interface QPayTokenRecord {
  token: string;
  /** epoch ms */
  expiresAt: number;
}

/** Shared (cross-instance) token store. Firestore in production, in-memory in tests. */
export interface TokenStore {
  load(): Promise<QPayTokenRecord | null>;
  /**
   * Try to take the refresh lock. Returns false when a fresh token already
   * exists (other than `rejectedToken`, which QPay just answered 401 to) or
   * another instance holds a live lock (younger than ttlMs).
   */
  tryLock(nowMs: number, ttlMs: number, rejectedToken?: string | null): Promise<boolean>;
  /** Persist the new token and release the lock. */
  save(rec: QPayTokenRecord): Promise<void>;
}

export interface QPayDeps {
  fetch: typeof fetch;
  now: () => number;
  env: (name: string) => string | undefined;
  /** null → memory-only cache (no cross-instance sharing). */
  store: TokenStore | null;
  sleep: (ms: number) => Promise<void>;
}

/** Refresh this long before the token actually expires. */
export const REFRESH_MARGIN_MS = 60 * 1000;
/** A refresh lock older than this is considered abandoned (instance died). */
export const LOCK_TTL_MS = 15 * 1000;
/** How long a non-leader waits for the leader to publish a token before refreshing itself. */
export const LOCK_WAIT_MS = 10 * 1000;
export const LOCK_POLL_MS = 250;
/** Firestore doc that holds the shared token. Admin SDK only (rules deny everything). */
export const TOKEN_DOC_PATH = "system/qpayToken";

/** Token usable now AND still usable for REFRESH_MARGIN_MS? */
export function isFresh(rec: QPayTokenRecord | null | undefined, nowMs: number): rec is QPayTokenRecord {
  return !!rec && typeof rec.token === "string" && rec.token.length > 0 && rec.expiresAt - REFRESH_MARGIN_MS > nowMs;
}

/**
 * QPay `expires_in` → epoch ms. QPay returns either an epoch (seconds) or a
 * duration (seconds); unknown → 1 hour from now.
 */
export function tokenExpiresAt(expiresIn: unknown, nowMs: number): number {
  const raw = Number(expiresIn);
  if (Number.isFinite(raw) && raw > 0) {
    return raw > 1e9 ? raw * 1000 : nowMs + raw * 1000;
  }
  return nowMs + 60 * 60 * 1000;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

// -----------------------------------------------------------------------------
// Invoice / payment types
// -----------------------------------------------------------------------------

export interface QPayBankUrl {
  name: string;
  description: string;
  logo: string;
  link: string;
}

export interface QPayInvoice {
  invoice_id: string;
  qr_text: string;
  qr_image: string; // base64 PNG
  qPay_shortUrl?: string;
  urls: QPayBankUrl[];
}

export interface CreateInvoiceInput {
  orderId: string;
  amount: number;
  description: string;
  receiverCode: string;
}

export interface PaymentCheckResult {
  paid: boolean;
  paidAmount: number;
  paymentId?: string;
}

interface PaymentRow {
  payment_id?: string;
  payment_status?: string;
  payment_amount?: number | string;
}

// -----------------------------------------------------------------------------
// Client factory
// -----------------------------------------------------------------------------

export function createQPayClient(deps: QPayDeps) {
  let memory: QPayTokenRecord | null = null;
  let inflight: Promise<string> | null = null;

  const env = (name: string): string => {
    const v = deps.env(name);
    if (!v) throw new QPayError(`${name} is not set`, 500, null);
    return v;
  };
  const baseUrl = () => env("QPAY_BASE_URL").replace(/\/+$/, "");

  function isConfigured(): boolean {
    return ["QPAY_BASE_URL", "QPAY_USERNAME", "QPAY_PASSWORD", "QPAY_INVOICE_CODE"].every((k) => !!deps.env(k));
  }
  function isSandbox(): boolean {
    return (deps.env("QPAY_BASE_URL") ?? "").includes("sandbox");
  }

  async function fetchNewToken(): Promise<QPayTokenRecord> {
    const basic = Buffer.from(`${env("QPAY_USERNAME")}:${env("QPAY_PASSWORD")}`).toString("base64");
    const res = await deps.fetch(`${baseUrl()}/v2/auth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    });
    const body = await parseBody(res);
    if (!res.ok) throw new QPayError("QPay auth failed", res.status, body);
    const data = body as { access_token?: string; expires_in?: number | string };
    if (!data?.access_token) throw new QPayError("QPay auth returned no access_token", 502, body);
    return { token: data.access_token, expiresAt: tokenExpiresAt(data.expires_in, deps.now()) };
  }

  /** Store calls never take the payment path down: on failure fall back to memory-only. */
  async function storeSafe<T>(label: string, fn: (s: TokenStore) => Promise<T>, fallback: T): Promise<T> {
    if (!deps.store) return fallback;
    try {
      return await fn(deps.store);
    } catch (err) {
      console.warn(`[qpay] token store ${label} failed:`, err instanceof Error ? err.message : err);
      return fallback;
    }
  }

  /**
   * Resolve a usable token. `rejected` = a token QPay just answered 401 to:
   * neither the memory nor the shared copy of it may be reused.
   */
  async function acquireToken(rejected: string | null): Promise<string> {
    const usable = (rec: QPayTokenRecord | null | undefined): rec is QPayTokenRecord =>
      isFresh(rec, deps.now()) && rec.token !== rejected;
    if (usable(memory)) return memory.token;

    if (deps.store) {
      const shared = await storeSafe("load", (s) => s.load(), null);
      if (usable(shared)) {
        memory = shared;
        return shared.token;
      }

      const leader = await storeSafe("lock", (s) => s.tryLock(deps.now(), LOCK_TTL_MS, rejected), true);
      if (!leader) {
        // Another instance is refreshing (or just published): wait for its token.
        const deadline = deps.now() + LOCK_WAIT_MS;
        while (deps.now() < deadline) {
          await deps.sleep(LOCK_POLL_MS);
          const again = await storeSafe("load", (s) => s.load(), null);
          if (usable(again)) {
            memory = again;
            return again.token;
          }
        }
        console.warn("[qpay] token refresh lock timed out; refreshing locally");
      }

      const rec = await fetchNewToken();
      memory = rec;
      await storeSafe("save", (s) => s.save(rec), undefined);
      return rec.token;
    }

    const rec = await fetchNewToken();
    memory = rec;
    return rec.token;
  }

  /** Single-flight: concurrent callers on one instance share one refresh. */
  function getToken(opts: { rejected?: string | null } = {}): Promise<string> {
    const rejected = opts.rejected ?? null;
    if (isFresh(memory, deps.now()) && memory.token !== rejected) return Promise.resolve(memory.token);
    if (!inflight) {
      inflight = acquireToken(rejected).finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  async function authed<T>(path: string, init: RequestInit): Promise<T> {
    const doFetch = async (token: string) =>
      deps.fetch(`${baseUrl()}${path}`, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

    const token = await getToken();
    let res = await doFetch(token);
    if (res.status === 401) {
      // Token expired / revoked server-side: refuse this token from both caches, refresh once.
      if (memory?.token === token) memory = null;
      res = await doFetch(await getToken({ rejected: token }));
    }
    const body = await parseBody(res);
    if (!res.ok) throw new QPayError(`QPay ${path} failed`, res.status, body);
    return body as T;
  }

  async function createInvoice(input: CreateInvoiceInput): Promise<QPayInvoice> {
    const appUrl = env("APP_URL").replace(/\/+$/, "");
    const secret = env("QPAY_CALLBACK_SECRET");
    const callbackUrl =
      `${appUrl}/api/qpay/callback?order=${encodeURIComponent(input.orderId)}` +
      `&s=${encodeURIComponent(secret)}`;

    const body = {
      invoice_code: env("QPAY_INVOICE_CODE"),
      sender_invoice_no: input.orderId,
      invoice_receiver_code: input.receiverCode,
      invoice_description: input.description,
      amount: input.amount,
      callback_url: callbackUrl,
    };

    const data = await authed<Partial<QPayInvoice>>("/v2/invoice", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!data?.invoice_id) {
      throw new QPayError("QPay invoice response missing invoice_id", 502, data);
    }
    return {
      invoice_id: data.invoice_id,
      qr_text: data.qr_text ?? "",
      qr_image: data.qr_image ?? "",
      qPay_shortUrl: data.qPay_shortUrl,
      urls: Array.isArray(data.urls) ? data.urls : [],
    };
  }

  /** Payment check — callback бол зөвхөн дохио; эх сурвалж нь энэ. */
  async function checkPayment(invoiceId: string): Promise<PaymentCheckResult> {
    const data = await authed<{ count?: number; paid_amount?: number | string; rows?: PaymentRow[] }>(
      "/v2/payment/check",
      {
        method: "POST",
        body: JSON.stringify({
          object_type: "INVOICE",
          object_id: invoiceId,
          offset: { page_number: 1, page_limit: 100 },
        }),
      }
    );

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const paidRows = rows.filter((r) => r.payment_status === "PAID");
    if (paidRows.length === 0) return { paid: false, paidAmount: 0 };
    const paidAmount = paidRows.reduce((sum, r) => sum + (Number(r.payment_amount) || 0), 0);
    return { paid: true, paidAmount, paymentId: paidRows[0].payment_id };
  }

  return { getToken, createInvoice, checkPayment, isConfigured, isSandbox };
}

export type QPayClient = ReturnType<typeof createQPayClient>;

// -----------------------------------------------------------------------------
// Firestore-backed shared token store (production)
// -----------------------------------------------------------------------------

/**
 * system/qpayToken: { token, expiresAt (epoch ms), lockedAt? (epoch ms), updatedAt }.
 * firebaseAdmin is imported lazily so this module stays importable without
 * FIREBASE_SERVICE_ACCOUNT_B64 (tests, lint).
 */
export function firestoreTokenStore(): TokenStore {
  const ref = async () => {
    const { adminDb } = await import("./firebaseAdmin.js");
    const [col, id] = TOKEN_DOC_PATH.split("/");
    return { adminDb, doc: adminDb.collection(col).doc(id) };
  };
  return {
    async load() {
      const { doc } = await ref();
      const d = (await doc.get()).data();
      if (!d || typeof d.token !== "string" || typeof d.expiresAt !== "number") return null;
      return { token: d.token, expiresAt: d.expiresAt };
    },
    async tryLock(nowMs, ttlMs, rejectedToken) {
      const { adminDb, doc } = await ref();
      return adminDb.runTransaction(async (tx) => {
        const d = (await tx.get(doc)).data() ?? {};
        if (isFresh({ token: d.token, expiresAt: d.expiresAt }, nowMs) && d.token !== rejectedToken) return false;
        if (typeof d.lockedAt === "number" && nowMs - d.lockedAt < ttlMs) return false;
        tx.set(doc, { lockedAt: nowMs }, { merge: true });
        return true;
      });
    },
    async save(rec) {
      const { doc } = await ref();
      const { FieldValue, Timestamp } = await import("firebase-admin/firestore");
      await doc.set(
        { token: rec.token, expiresAt: rec.expiresAt, lockedAt: FieldValue.delete(), updatedAt: Timestamp.now() },
        { merge: true }
      );
    },
  };
}

// -----------------------------------------------------------------------------
// Default (process.env + global fetch + Firestore) client — what the API routes use
// -----------------------------------------------------------------------------

let defaultClient: QPayClient | null = null;
function client(): QPayClient {
  if (!defaultClient) {
    defaultClient = createQPayClient({
      fetch: (input, init) => fetch(input, init),
      now: () => Date.now(),
      env: (name) => process.env[name],
      store: firestoreTokenStore(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
  }
  return defaultClient;
}

/** All four QPay env vars present? Production runs WITHOUT them until the merchant contract is signed. */
export function isConfigured(): boolean {
  return client().isConfigured();
}
export function isSandbox(): boolean {
  return client().isSandbox();
}
export function getToken(): Promise<string> {
  return client().getToken();
}
export function createInvoice(input: CreateInvoiceInput): Promise<QPayInvoice> {
  return client().createInvoice(input);
}
export function checkPayment(invoiceId: string): Promise<PaymentCheckResult> {
  return client().checkPayment(invoiceId);
}
