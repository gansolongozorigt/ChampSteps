// api/_lib/activate.ts — payments/{orderId} → users/{uid} багц идэвхжүүлэх.
// callback болон sandbox simulate-paid хоёулаа энэ нэг функцийг ашиглана.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.js";
import { PLAN_DURATION_MS, type PaidPlan } from "./plans.js";

export interface PaymentDoc {
  uid: string;
  plan: PaidPlan;
  amount: number;
  status: "pending" | "paid";
  provider: "qpay";
  invoiceId: string | null;
  qrText?: string;
  paymentId?: string;
  createdAt?: Timestamp;
  paidAt?: Timestamp;
}

/**
 * users/{uid}-д бичих багцын талбарууд. QPay (activateSubscription) болон
 * promo (api/promo/apply) хоёулаа энэ нэг хэлбэрийг ашиглана.
 */
export function subscriptionFields(
  plan: PaidPlan,
  provider: "qpay" | "promo",
  startedAt: Date,
  expiresAt: Date,
  extra: Record<string, unknown> = {}
) {
  const startTs = Timestamp.fromDate(startedAt);
  const expTs = Timestamp.fromDate(expiresAt);
  return {
    subscriptionTier: plan,
    subscriptionActivatedAt: startTs,
    subscriptionExpiresAt: expTs,
    subscription: { plan, provider, startedAt: startTs, expiresAt: expTs, ...extra },
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export type ActivateResult =
  | { ok: true; alreadyPaid: boolean; expiresAt: Date }
  | { ok: false; reason: "not_found" };

/**
 * Захиалгыг төлсөн гэж тэмдэглээд хэрэглэгчийн багцыг идэвхжүүлнэ.
 * Idempotent: аль хэдийн paid бол юу ч бичихгүй.
 *
 * users/{uid}-ийн одоо байгаа талбарууд (subscriptionTier,
 * subscriptionActivatedAt, subscriptionExpiresAt) шинэчлэгдэж,
 * нэмэлт `subscription` объект merge-ээр нэмэгдэнэ.
 */
export async function activateSubscription(
  orderId: string,
  opts: { paymentId?: string } = {}
): Promise<ActivateResult> {
  const payRef = adminDb.collection("payments").doc(orderId);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(payRef);
    if (!snap.exists) return { ok: false as const, reason: "not_found" as const };

    const payment = snap.data() as PaymentDoc;
    if (payment.status === "paid") {
      const existing = payment.paidAt?.toDate() ?? new Date();
      return {
        ok: true as const,
        alreadyPaid: true,
        expiresAt: new Date(existing.getTime() + PLAN_DURATION_MS),
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PLAN_DURATION_MS);
    tx.update(payRef, {
      status: "paid",
      paymentId: opts.paymentId ?? payment.paymentId ?? null,
      paidAt: Timestamp.fromDate(now),
    });

    const userRef = adminDb.collection("users").doc(payment.uid);
    tx.set(
      userRef,
      subscriptionFields(payment.plan, "qpay", now, expiresAt, { lastOrderId: orderId }),
      { merge: true }
    );

    return { ok: true as const, alreadyPaid: false, expiresAt };
  });
}
