// POST /api/qpay/status — { idToken, orderId } → { status, plan, expiresAt }.
// Зөвхөн бидний Firestore-ийг уншина (QPay-г дуудахгүй) тул client poll хийж болно.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, verifyIdToken } from "../_lib/firebaseAdmin.js";
import type { PaymentDoc } from "../_lib/activate.js";
import { PLAN_DURATION_MS } from "../_lib/plans.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { idToken, orderId } = (req.body ?? {}) as { idToken?: unknown; orderId?: unknown };

  const uid = await verifyIdToken(idToken);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  if (typeof orderId !== "string" || !orderId) return res.status(400).json({ error: "orderId required" });

  try {
    const snap = await adminDb.collection("payments").doc(orderId).get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });

    const payment = snap.data() as PaymentDoc;
    if (payment.uid !== uid) return res.status(403).json({ error: "Forbidden" });

    const paidAt = payment.paidAt?.toDate();
    const expiresAt = paidAt ? new Date(paidAt.getTime() + PLAN_DURATION_MS).toISOString() : null;

    return res.status(200).json({ status: payment.status, plan: payment.plan, expiresAt });
  } catch (err) {
    console.error("[qpay] status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
