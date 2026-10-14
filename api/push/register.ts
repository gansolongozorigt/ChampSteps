// api/push/register.ts — POST { idToken, token, platform, lang }
// Stores the FCM registration token under pushTokens/{token} (server-only collection).
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminPushDeps } from "../_lib/adminPushDeps.js";
import { processRegister } from "../_lib/push.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = (req.body ?? {}) as { idToken?: unknown };
  try {
    const r = await processRegister(adminPushDeps, body.idToken, body);
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error("[push] register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
