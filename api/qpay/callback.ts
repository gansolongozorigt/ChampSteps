// GET /api/qpay/callback?order=...&s=... — QPay төлбөр орсны дараа дуудна.
// Callback бол зөвхөн дохио: заавал /v2/payment/check-ээр баталгаажуулна.
// Логик: api/_lib/qpayCallback.ts (processCallback) — req.body огт уншдаггүй.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb } from "../_lib/firebaseAdmin.js";
import { activateSubscription, type PaymentDoc } from "../_lib/activate.js";
import { checkPayment } from "../_lib/qpay.js";
import { processCallback } from "../_lib/qpayCallback.js";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const outcome = await processCallback(
    {
      secret: process.env.QPAY_CALLBACK_SECRET,
      async getPayment(orderId) {
        const snap = await adminDb.collection("payments").doc(orderId).get();
        return snap.exists ? (snap.data() as PaymentDoc) : null;
      },
      checkPayment,
      activate: activateSubscription,
    },
    {
      order: first(req.query.order as string | string[] | undefined),
      s: first(req.query.s as string | string[] | undefined),
    }
  );
  return res.status(outcome.status).send(outcome.body);
}
