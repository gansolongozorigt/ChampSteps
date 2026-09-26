// POST /api/qpay/create-invoice — { idToken, plan } → QPay нэхэмжлэх үүсгэнэ.
// Дүнг зөвхөн серверийн PLANS хүснэгтээс авна; client-ийн amount үл тоогдоно.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, verifyIdToken } from "../_lib/firebaseAdmin.js";
import { PLANS, isPaidPlan } from "../_lib/plans.js";
import { QPayError, createInvoice } from "../_lib/qpay.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { idToken, plan } = (req.body ?? {}) as { idToken?: unknown; plan?: unknown };

  const uid = await verifyIdToken(idToken);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  if (!isPaidPlan(plan)) return res.status(400).json({ error: "Invalid plan" });

  const { amount, label } = PLANS[plan];
  const orderId = `CS-${Date.now()}-${uid.slice(0, 6)}`;
  const payRef = adminDb.collection("payments").doc(orderId);

  try {
    await payRef.set({
      uid,
      plan,
      amount,
      status: "pending",
      provider: "qpay",
      createdAt: Timestamp.now(),
      invoiceId: null,
    });

    const invoice = await createInvoice({
      orderId,
      amount,
      description: `ChampStep ${label} сарын багц`,
      receiverCode: uid,
    });

    await payRef.update({ invoiceId: invoice.invoice_id, qrText: invoice.qr_text });

    return res.status(200).json({
      orderId,
      invoiceId: invoice.invoice_id,
      qrImage: invoice.qr_image,
      qrText: invoice.qr_text,
      urls: invoice.urls,
    });
  } catch (err) {
    if (err instanceof QPayError) {
      console.error("[qpay] create-invoice failed:", err.status, JSON.stringify(err.body));
      return res.status(502).json({ error: "QPay error" });
    }
    console.error("[qpay] create-invoice error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
