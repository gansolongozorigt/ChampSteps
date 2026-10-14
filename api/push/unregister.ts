// api/push/unregister.ts — POST { idToken, token }
// Removes pushTokens/{token} when it belongs to the signed-in user.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminPushDeps } from "../_lib/adminPushDeps.js";
import { processUnregister } from "../_lib/push.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = (req.body ?? {}) as { idToken?: unknown };
  try {
    const r = await processUnregister(adminPushDeps, body.idToken, body);
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error("[push] unregister error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
