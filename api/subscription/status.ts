// api/subscription/status.ts — POST { idToken } → current subscription.
// If the paid plan has expired, downgrades users/{uid} to free (server-only
// fields: expiredFrom / expiredAt) and reports it. Client calls this once at
// app start and from the "Check subscription" button.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, verifyIdToken } from "../_lib/firebaseAdmin.js";
import { currentFromUserDoc, isActive, toDate } from "../_lib/subscriptionMath.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { idToken } = (req.body ?? {}) as { idToken?: unknown };
  const uid = await verifyIdToken(idToken);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });
  try {
    const ref = adminDb.collection("users").doc(uid);
    const snap = await ref.get();
    const data = snap.data() ?? {};
    const cur = currentFromUserDoc(data);
    const now = new Date();
    if (cur.tier !== "free" && !isActive(cur, now)) {
      await ref.set(
        { subscriptionTier: "free", expiredFrom: cur.tier, expiredAt: Timestamp.fromDate(now), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return res.status(200).json({ tier: "free", expiresAt: cur.expiresAt?.toISOString() ?? null, expiredFrom: cur.tier, expiredAt: now.toISOString(), legacy: false, justExpired: true });
    }
    return res.status(200).json({
      tier: cur.tier,
      expiresAt: cur.expiresAt?.toISOString() ?? null,
      expiredFrom: typeof data.expiredFrom === "string" ? data.expiredFrom : null,
      expiredAt: toDate(data.expiredAt)?.toISOString() ?? null,
      legacy: cur.tier !== "free" && cur.expiresAt === null,
      justExpired: false,
    });
  } catch (err) {
    console.error("[subscription] status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
