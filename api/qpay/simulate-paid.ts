// POST /api/qpay/simulate-paid — ЗӨВХӨН sandbox. { idToken, orderId } → paid болгоно.
// Sandbox-д бодит банкны апп байхгүй тул UI-ийн бүрэн урсгалыг ингэж туршина.
// Production (QPAY_BASE_URL sandbox биш) үед 404 — огт байхгүй мэт.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, verifyIdToken } from "../_lib/firebaseAdmin.js";
import { activateSubscription, type PaymentDoc } from "../_lib/activate.js";
import { isSandbox } from "../_lib/qpay.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isSandbox()) return res.status(404).send("Not Found");
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

    const result = await activateSubscription(orderId, { paymentId: `SIMULATED-${Date.now()}` });
    if (!result.ok) return res.status(404).json({ error: "Not found" });

    console.log("[qpay] SANDBOX simulate-paid:", orderId, uid, payment.plan);
    return res.status(200).json({
      status: "paid",
      plan: payment.plan,
      expiresAt: result.expiresAt.toISOString(),
      alreadyPaid: result.alreadyPaid,
    });
  } catch (err) {
    console.error("[qpay] simulate-paid error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
