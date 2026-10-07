// POST /api/promo/apply — { idToken, code } → family багцыг кодын сарын тоогоор идэвхжүүлнэ.
// promoCodes-ийг зөвхөн сервер уншиж/бичнэ (Firestore rules client-ийг хориглоно).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, verifyIdToken } from "../_lib/firebaseAdmin.js";
import { subscriptionFields } from "../_lib/activate.js";
import {
  MONTH_MS, PROMO_PLAN, normalizeCode, promoExpiresAt, promoMonths, type PromoCodeDoc,
} from "../_lib/promo.js";

type Reason = "not_found" | "inactive" | "expired" | "used" | "exhausted";
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
      if (!snap.exists) throw new PromoReject("not_found");
      const promo = snap.data() as PromoCodeDoc;
      const usedBy = Array.isArray(promo.usedBy) ? promo.usedBy : [];

      if (promo.active === false) throw new PromoReject("inactive");
      const exp = promoExpiresAt(promo);
      if (exp && exp.getTime() < Date.now()) throw new PromoReject("expired");
      if (usedBy.includes(uid)) throw new PromoReject("used");
      if (promo.maxUses && usedBy.length >= Number(promo.maxUses)) throw new PromoReject("exhausted");

      const months = promoMonths(promo);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + months * MONTH_MS);

      tx.update(promoRef, {
        usedBy: FieldValue.arrayUnion(uid),
        usedCount: FieldValue.increment(1),
        lastUsedAt: Timestamp.fromDate(now),
      });
      tx.set(
        userRef,
        subscriptionFields(PROMO_PLAN, "promo", now, expiresAt, { promoCode: code, lastOrderId: null }),
        { merge: true }
      );
      return { months, expiresAt };
    });

    console.log("[promo] applied:", code, result.months, "mo");
    return res.status(200).json({
      plan: PROMO_PLAN,
      months: result.months,
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
