// GET /api/qpay/callback?order=...&s=... — QPay төлбөр орсны дараа дуудна.
// Callback бол зөвхөн дохио: заавал /v2/payment/check-ээр баталгаажуулна.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb } from "../_lib/firebaseAdmin.js";
import { activateSubscription, type PaymentDoc } from "../_lib/activate.js";
import { QPayError, checkPayment } from "../_lib/qpay.js";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const order = first(req.query.order as string | string[] | undefined);
  const s = first(req.query.s as string | string[] | undefined);

  const secret = process.env.QPAY_CALLBACK_SECRET;
  if (!secret || s !== secret) return res.status(403).send("FORBIDDEN");
  if (!order) return res.status(400).send("MISSING_ORDER");

  try {
    const snap = await adminDb.collection("payments").doc(order).get();
    if (!snap.exists) return res.status(404).send("NOT_FOUND");

    const payment = snap.data() as PaymentDoc;
    if (payment.status === "paid") return res.status(200).send("SUCCESS");

    if (!payment.invoiceId) {
      console.warn("[qpay] callback for order without invoiceId:", order);
      return res.status(200).send("PENDING");
    }

    const check = await checkPayment(payment.invoiceId);
    if (!check.paid || check.paidAmount < payment.amount) {
      console.warn("[qpay] callback but not paid/insufficient:", order, JSON.stringify(check));
      return res.status(200).send("PENDING");
    }

    const result = await activateSubscription(order, { paymentId: check.paymentId });
    if (!result.ok) return res.status(404).send("NOT_FOUND");

    console.log("[qpay] activated:", order, payment.uid, payment.plan, result.alreadyPaid ? "(already)" : "");
    return res.status(200).send("SUCCESS");
  } catch (err) {
    if (err instanceof QPayError) {
      console.error("[qpay] callback check failed:", err.status, JSON.stringify(err.body));
      return res.status(502).send("QPAY_ERROR");
    }
    console.error("[qpay] callback error:", err);
    return res.status(500).send("ERROR");
  }
}
