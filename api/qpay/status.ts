// POST /api/qpay/status — { idToken, orderId } → { status, plan, expiresAt }.
// Client poll хийнэ. Ихэвчлэн зөвхөн Firestore-ийг уншина; pending захиалга 10+ секунд болсон бол
// QPay /v2/payment/check-ээр давхар асууна (callback ирээгүй үеийн нөөц зам, нэг захиалгад 5 сек-д ≤1).
// Логик: api/_lib/qpayCallback.ts (processStatus).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, verifyIdToken } from "../_lib/firebaseAdmin.js";
import { activateSubscription, type PaymentDoc } from "../_lib/activate.js";
import { currentFromUserDoc } from "../_lib/subscriptionMath.js";
import { checkPayment, isConfigured } from "../_lib/qpay.js";
import { processStatus } from "../_lib/qpayCallback.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isConfigured()) return res.status(503).json({ error: "payments_disabled" });

  const { idToken, orderId } = (req.body ?? {}) as { idToken?: unknown; orderId?: unknown };

  const uid = await verifyIdToken(idToken);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  if (typeof orderId !== "string" || !orderId) return res.status(400).json({ error: "orderId required" });

  try {
    const outcome = await processStatus(
      {
        async getPayment(id) {
          const snap = await adminDb.collection("payments").doc(id).get();
          return snap.exists ? (snap.data() as PaymentDoc) : null;
        },
        // lastCheckAt on the payments doc: shared by every serverless instance
        claimCheck(id, nowMs, gapMs) {
          const ref = adminDb.collection("payments").doc(id);
          return adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const last = (snap.get("lastCheckAt") as Timestamp | undefined)?.toMillis() ?? 0;
            if (!snap.exists || snap.get("status") !== "pending" || nowMs - last < gapMs) return false;
            tx.update(ref, { lastCheckAt: Timestamp.fromMillis(nowMs) });
            return true;
          });
        },
        checkPayment,
        activate: activateSubscription,
        async getExpiresAt(id) {
          const userSnap = await adminDb.collection("users").doc(id).get();
          return currentFromUserDoc(userSnap.data()).expiresAt ?? null;
        },
      },
      { uid, orderId }
    );
    return res.status(outcome.status).json(outcome.body);
  } catch (err) {
    console.error("[qpay] status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
