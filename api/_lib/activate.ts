// api/_lib/activate.ts — payments/{orderId} → users/{uid} багц идэвхжүүлэх.
// callback болон sandbox simulate-paid хоёулаа энэ нэг функцийг ашиглана.
// Сунгалт / дээш шилжих тооцоолол: subscriptionMath.planNextSubscription().

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.js";
import { PLAN_DURATION_MS, type PaidPlan } from "./plans.js";
import { PLANS } from "../../shared/plans.js";
import { currentFromUserDoc, planNextSubscription, DAY_MS } from "./subscriptionMath.js";

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
  /** Set when the paid plan was applied differently (e.g. a downgrade converted into days of the active tier). */
  appliedAs?: { tier: PaidPlan; days: number } | null;
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
    // a renewed/upgraded plan is no longer "expired"
    expiredFrom: FieldValue.delete(),
    expiredAt: FieldValue.delete(),
    subscription: { plan, provider, startedAt: startTs, expiresAt: expTs, ...extra },
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export type ActivateResult =
  | { ok: true; alreadyPaid: boolean; expiresAt: Date; plan: PaidPlan }
  | { ok: false; reason: "not_found" };

/**
 * Захиалгыг төлсөн гэж тэмдэглээд хэрэглэгчийн багцыг идэвхжүүлнэ.
 * Idempotent: аль хэдийн paid бол юу ч бичихгүй.
 *  - same tier → extends from the current expiry
 *  - higher tier → now + 30d + remaining days converted at the price ratio
 *  - lower tier while a higher one is active (blocked at invoice time; if it
 *    still happens) → the money becomes days of the ACTIVE tier instead.
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
    const userRef = adminDb.collection("users").doc(payment.uid);
    const userSnap = await tx.get(userRef);
    const current = currentFromUserDoc(userSnap.data());

    if (payment.status === "paid") {
      return {
        ok: true as const,
        alreadyPaid: true,
        plan: current.tier === "free" ? payment.plan : (current.tier as PaidPlan),
        expiresAt: current.expiresAt ?? new Date((payment.paidAt?.toDate() ?? new Date()).getTime() + PLAN_DURATION_MS),
      };
    }

    const now = new Date();
    let plan: PaidPlan = payment.plan;
    let expiresAt: Date;
    let appliedAs: PaymentDoc["appliedAs"] = null;
    const next = planNextSubscription(current, payment.plan, now);
    if (next.ok) {
      expiresAt = next.expiresAt;
    } else {
      // downgrade slipped through: convert the paid amount into days of the active (higher) tier
      plan = next.activeTier;
      const days = Math.max(1, Math.floor((PLAN_DURATION_MS / DAY_MS) * (PLANS[payment.plan].amount / PLANS[plan].amount)));
      const base = Math.max(now.getTime(), next.activeUntil?.getTime() ?? now.getTime());
      expiresAt = new Date(base + days * DAY_MS);
      appliedAs = { tier: plan, days };
    }

    tx.update(payRef, {
      status: "paid",
      paymentId: opts.paymentId ?? payment.paymentId ?? null,
      paidAt: Timestamp.fromDate(now),
      appliedAs,
      resultingExpiresAt: Timestamp.fromDate(expiresAt),
    });
    tx.set(userRef, subscriptionFields(plan, "qpay", now, expiresAt, { lastOrderId: orderId }), { merge: true });

    return { ok: true as const, alreadyPaid: false, expiresAt, plan };
  });
}
