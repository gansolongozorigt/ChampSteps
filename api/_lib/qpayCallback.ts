// api/_lib/qpayCallback.ts — /api/qpay/callback болон /api/qpay/status-ийн цөм (deps-ээр тусгаарласан, test:api-д туршигдана).
//
// QPay-ийн шаардлага: callback бол ЗӨВХӨН дохио. Багц идэвхжүүлэхээс өмнө
// заавал /v2/payment/check-ээр баталгаажуулна. Callback-ийн body / query-д
// байгаа "төлсөн" гэх мэдээлэлд огт итгэхгүй — энд body-г авдаггүй ч.
// Invoice id-г ч query-ээс биш, өөрсдийн payments/{orderId} док-оос авна.

import type { PaymentDoc, ActivateResult } from "./activate.js";
import type { PaymentCheckResult } from "./qpay.js";

/** QPayError without a runtime import (keeps this module loadable by node --test). */
function isQPayError(err: unknown): err is Error & { status: number; body: unknown } {
  return err instanceof Error && err.name === "QPayError";
}

/** payment/check says PAID for at least the order amount (shared with the status-poll fallback). */
export function isFullPayment(check: PaymentCheckResult, payment: Pick<PaymentDoc, "amount">): boolean {
  return check.paid && check.paidAmount >= payment.amount;
}

export interface CallbackDeps {
  /** QPAY_CALLBACK_SECRET; undefined → every callback is refused. */
  secret: string | undefined;
  getPayment(orderId: string): Promise<PaymentDoc | null>;
  /** QPay /v2/payment/check — the only source of truth for "paid". */
  checkPayment(invoiceId: string): Promise<PaymentCheckResult>;
  activate(orderId: string, opts: { paymentId?: string }): Promise<ActivateResult>;
  log?: Pick<Console, "log" | "warn" | "error">;
}

export interface CallbackInput {
  order?: string;
  s?: string;
}

export interface CallbackOutcome {
  status: number;
  body: "SUCCESS" | "PENDING" | "FORBIDDEN" | "MISSING_ORDER" | "NOT_FOUND" | "QPAY_ERROR" | "ERROR";
  /** true only when THIS call activated the subscription. */
  activated: boolean;
}

export async function processCallback(deps: CallbackDeps, input: CallbackInput): Promise<CallbackOutcome> {
  const log = deps.log ?? console;
  const { order, s } = input;

  if (!deps.secret || s !== deps.secret) return { status: 403, body: "FORBIDDEN", activated: false };
  if (!order) return { status: 400, body: "MISSING_ORDER", activated: false };

  try {
    const payment = await deps.getPayment(order);
    if (!payment) return { status: 404, body: "NOT_FOUND", activated: false };
    if (payment.status === "paid") return { status: 200, body: "SUCCESS", activated: false };

    if (!payment.invoiceId) {
      log.warn("[qpay] callback for order without invoiceId:", order);
      return { status: 200, body: "PENDING", activated: false };
    }

    const check = await deps.checkPayment(payment.invoiceId);
    if (!isFullPayment(check, payment)) {
      log.warn("[qpay] callback but not paid/insufficient:", order, JSON.stringify(check));
      return { status: 200, body: "PENDING", activated: false };
    }

    const result = await deps.activate(order, { paymentId: check.paymentId });
    if (!result.ok) return { status: 404, body: "NOT_FOUND", activated: false };

    log.log("[qpay] activated:", order, payment.plan, result.alreadyPaid ? "(already)" : "");
    return { status: 200, body: "SUCCESS", activated: !result.alreadyPaid };
  } catch (err) {
    if (isQPayError(err)) {
      log.error("[qpay] callback check failed:", err.status, JSON.stringify(err.body));
      return { status: 502, body: "QPAY_ERROR", activated: false };
    }
    log.error("[qpay] callback error:", err);
    return { status: 500, body: "ERROR", activated: false };
  }
}

// -----------------------------------------------------------------------------
// /api/qpay/status fallback
// Client 3 секунд тутам poll хийдэг. Ихэнхдээ зөвхөн өөрсдийн payments/{orderId}-г уншина.
// Callback ирэхгүй бол (QPay-ийн алдаа, сүлжээ) хэрэглэгч төлсөн ч pending-д гацна — тиймээс:
//   захиалга pending бөгөөд үүссэнээс CHECK_AFTER_MS өнгөрсөн бол /v2/payment/check-ээр давхар
//   асууж, төлөгдсөн бол callback-тэй ЯГ АДИЛ activate()-г дуудна (activateSubscription нь
//   transaction дотор status-г шалгадаг тул callback хожуу/зэрэг ирсэн ч давхар сунгахгүй).
// QPay-г нэг захиалгад CHECK_GAP_MS-д 1-ээс олон дуудахгүй: claimCheck() нь payments док дээрх
// lastCheckAt-г transaction-оор "захиална" — олон serverless instance-д ч хамаарна.
// -----------------------------------------------------------------------------

export const CHECK_AFTER_MS = 10 * 1000;
export const CHECK_GAP_MS = 5 * 1000;

export interface StatusDeps {
  getPayment(orderId: string): Promise<PaymentDoc | null>;
  /** true → this caller may call QPay now (lastCheckAt was ≥ gapMs ago and is now set to nowMs). */
  claimCheck(orderId: string, nowMs: number, gapMs: number): Promise<boolean>;
  checkPayment(invoiceId: string): Promise<PaymentCheckResult>;
  activate(orderId: string, opts: { paymentId?: string }): Promise<ActivateResult>;
  /** users/{uid} current expiry (renewals extend it), only read for a paid order. */
  getExpiresAt(uid: string): Promise<Date | null>;
  now?: () => number;
  log?: Pick<Console, "log" | "warn" | "error">;
}

export interface StatusOutcome {
  status: number;
  body:
    | { status: "pending" | "paid"; plan: PaymentDoc["plan"]; expiresAt: string | null }
    | { error: string };
  /** "skipped" = no QPay call (too early / throttled / no invoice / already paid). */
  checked: "skipped" | "unpaid" | "activated" | "already_paid" | "error";
}

function createdMs(p: PaymentDoc): number | null {
  const c = p.createdAt as unknown as { toMillis?: () => number } | undefined;
  return typeof c?.toMillis === "function" ? c.toMillis() : null;
}

export async function processStatus(deps: StatusDeps, input: { uid: string; orderId: string }): Promise<StatusOutcome> {
  const log = deps.log ?? console;
  const nowMs = (deps.now ?? Date.now)();
  const { uid, orderId } = input;

  const payment = await deps.getPayment(orderId);
  if (!payment) return { status: 404, body: { error: "Not found" }, checked: "skipped" };
  if (payment.uid !== uid) return { status: 403, body: { error: "Forbidden" }, checked: "skipped" };

  let status = payment.status;
  let checked: StatusOutcome["checked"] = "skipped";

  const created = createdMs(payment);
  const oldEnough = created !== null && nowMs - created >= CHECK_AFTER_MS;
  if (status === "pending" && payment.invoiceId && oldEnough && (await deps.claimCheck(orderId, nowMs, CHECK_GAP_MS))) {
    try {
      const check = await deps.checkPayment(payment.invoiceId);
      if (isFullPayment(check, payment)) {
        const r = await deps.activate(orderId, { paymentId: check.paymentId });
        if (r.ok) {
          status = "paid";
          checked = r.alreadyPaid ? "already_paid" : "activated";
          if (!r.alreadyPaid) log.log("[qpay] activated via status check:", orderId, payment.plan);
        }
      } else {
        checked = "unpaid";
      }
    } catch (err) {
      // the poll keeps answering "pending"; the callback (or the next allowed check) can still activate
      log.error("[qpay] status check failed:", orderId, err instanceof Error ? err.message : err);
      checked = "error";
    }
  }

  const expiresAt = status === "paid" ? ((await deps.getExpiresAt(uid))?.toISOString() ?? null) : null;
  return { status: 200, body: { status, plan: payment.plan, expiresAt }, checked };
}
