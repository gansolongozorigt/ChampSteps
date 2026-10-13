// api/_lib/qpayCallback.ts — /api/qpay/callback-ийн цөм (deps-ээр тусгаарласан, test:api-д туршигдана).
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
    if (!check.paid || check.paidAmount < payment.amount) {
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
