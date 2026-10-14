// GET /api/qpay/config — { enabled, sandbox }. No auth, no secrets: lets the
// client show "payments open soon" BEFORE the user presses Pay.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isConfigured, isSandbox } from "../_lib/qpay.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ enabled: isConfigured(), sandbox: isConfigured() && isSandbox() });
}
