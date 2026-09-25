// api/_lib/qpay.ts — QPay v2 API client (server only)
//
// Sandbox:    https://merchant-sandbox.qpay.mn
// Production: https://merchant.qpay.mn
// Орчин солихдоо зөвхөн QPAY_BASE_URL / QPAY_USERNAME / QPAY_PASSWORD /
// QPAY_INVOICE_CODE env var-уудыг солино.

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

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new QPayError(`${name} is not set`, 500, null);
  return v;
}

function baseUrl(): string {
  return env("QPAY_BASE_URL").replace(/\/+$/, "");
}

export function isSandbox(): boolean {
  return (process.env.QPAY_BASE_URL ?? "").includes("sandbox");
}

// -----------------------------------------------------------------------------
// Token cache (module scope — warm instance дээр дахин ашиглагдана)
// -----------------------------------------------------------------------------

interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;
const REFRESH_MARGIN_MS = 60 * 1000;

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export async function getToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - REFRESH_MARGIN_MS > now) {
    return tokenCache.token;
  }

  const basic = Buffer.from(`${env("QPAY_USERNAME")}:${env("QPAY_PASSWORD")}`).toString("base64");
  const res = await fetch(`${baseUrl()}/v2/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  const body = await parseBody(res);
  if (!res.ok) {
    throw new QPayError("QPay auth failed", res.status, body);
  }

  const data = body as { access_token?: string; expires_in?: number | string };
  if (!data?.access_token) {
    throw new QPayError("QPay auth returned no access_token", 502, body);
  }

  // QPay `expires_in`-ийг epoch секунд эсвэл хугацааны урт (сек) байдлаар өгч болно.
  const raw = Number(data.expires_in);
  let expiresAt: number;
  if (Number.isFinite(raw) && raw > 0) {
    expiresAt = raw > 1e9 ? raw * 1000 : now + raw * 1000;
  } else {
    expiresAt = now + 60 * 60 * 1000; // мэдэгдэхгүй бол 1 цаг гэж үзнэ
  }

  tokenCache = { token: data.access_token, expiresAt };
  return tokenCache.token;
}

async function authed<T>(path: string, init: RequestInit): Promise<T> {
  const doFetch = async (token: string) =>
    fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

  let res = await doFetch(await getToken());
  if (res.status === 401) {
    // Token хугацаа дууссан / хүчингүй бол нэг удаа шинээр авч давтана
    tokenCache = null;
    res = await doFetch(await getToken());
  }
  const body = await parseBody(res);
  if (!res.ok) {
    throw new QPayError(`QPay ${path} failed`, res.status, body);
  }
  return body as T;
}

// -----------------------------------------------------------------------------
// Invoice
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

export async function createInvoice(input: CreateInvoiceInput): Promise<QPayInvoice> {
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

// -----------------------------------------------------------------------------
// Payment check — callback бол зөвхөн дохио; эх сурвалж нь энэ.
// -----------------------------------------------------------------------------

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

export async function checkPayment(invoiceId: string): Promise<PaymentCheckResult> {
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
  if (paidRows.length === 0) {
    return { paid: false, paidAmount: 0 };
  }
  const paidAmount = paidRows.reduce((sum, r) => sum + (Number(r.payment_amount) || 0), 0);
  return {
    paid: true,
    paidAmount,
    paymentId: paidRows[0].payment_id,
  };
}
