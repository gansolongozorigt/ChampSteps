// POST /api/promo/apply — { idToken, code } → кодын багцыг (plan: family/master/coach,
// байхгүй бол family) кодын хугацаагаар (days, байхгүй бол discountMonths × 30) идэвхжүүлнэ.
// promoCodes-ийг зөвхөн сервер уншиж/бичнэ (Firestore rules client-ийг хориглоно).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { currentFromUserDoc, planNextSubscription } from "../_lib/subscriptionMath.js";
import { adminDb, verifyIdToken } from "../_lib/firebaseAdmin.js";
import { subscriptionFields } from "../_lib/activate.js";
import {
  DAY_MS, normalizeCode, promoDurationMs, promoPlan, promoRejectReason, type PromoCodeDoc, type PromoRejectReason,
} from "../_lib/promo.js";

type Reason = PromoRejectReason | "downgrade";
class PromoReject extends Error {
  constructor(public reason: Reason) { super(reason); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { idToken, code: rawCode } = (req.body ?? {}) as { idToken?: unknown; code?: unknown };
  const uid = await verifyIdToken(idToken);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const code = normalizeCode(rawCode);
  if (!code) return res.status(400).json({ error: "invalid_code" });

  const promoRef = adminDb.collection("promoCodes").doc(code);
  const userRef = adminDb.collection("users").doc(uid);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(promoRef);
      const promo = snap.exists ? (snap.data() as PromoCodeDoc) : null;
      const now = new Date();
      // not_found / inactive / expired / used / exhausted — pure check in api/_lib/promo.ts (unit-tested)
      const reject = promoRejectReason(promo, uid, now);
      if (reject || !promo) throw new PromoReject(reject ?? "not_found");

      const plan = promoPlan(promo);
      const durationMs = promoDurationMs(promo);
      const days = Math.round(durationMs / DAY_MS);
      const userSnap = await tx.get(userRef);
      // Lower plan than the user's active one → 409 downgrade (same rule as paid upgrades).
      const next = planNextSubscription(currentFromUserDoc(userSnap.data()), plan, now, durationMs);
      if (!next.ok) throw new PromoReject("downgrade");
      const expiresAt = next.expiresAt;

      tx.update(promoRef, {
        usedBy: FieldValue.arrayUnion(uid),
        usedCount: FieldValue.increment(1),
        lastUsedAt: Timestamp.fromDate(now),
      });
      tx.set(
        userRef,
        subscriptionFields(plan, "promo", now, expiresAt, { promoCode: code, lastOrderId: null }),
        { merge: true }
      );
      return { plan, days, expiresAt };
    });

    console.log("[promo] applied:", code, result.plan, result.days, "days");
    return res.status(200).json({
      plan: result.plan,
      days: result.days,
      // kept for the client's "{{months}} months free" message
      months: Math.max(1, Math.round(result.days / 30)),
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof PromoReject) {
      return res.status(409).json({ error: err.reason });
    }
    console.error("[promo] apply error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
