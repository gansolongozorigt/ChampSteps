// POST /api/promo/admin — { idToken, action, ... } — зөвхөн ADMIN_EMAIL.
// action: "list" | "create" | "toggle" | "seed"

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, verifyIdTokenFull } from "../_lib/firebaseAdmin.js";
import { normalizeCode, toView, type PromoCodeDoc } from "../_lib/promo.js";

const SEED: Array<Omit<PromoCodeDoc, "usedBy">> = [
  { code: "CHAMP3", discountMonths: 3, maxUses: 100, active: true, expiresAt: "2027-01-01T00:00:00.000Z" },
  { code: "CHAMP6", discountMonths: 6, maxUses: 50, active: true, expiresAt: "2027-01-01T00:00:00.000Z" },
];

function parseExpiry(v: unknown): Timestamp | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!adminEmail) return res.status(503).json({ error: "ADMIN_EMAIL not configured" });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const decoded = await verifyIdTokenFull(body.idToken);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });
  const email = (decoded.email ?? "").toLowerCase();
  if (!email || email !== adminEmail || decoded.email_verified === false) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const col = adminDb.collection("promoCodes");

  try {
    switch (body.action) {
      case "list": {
        const snap = await col.get();
        const codes = snap.docs.map((d) => toView({ ...(d.data() as PromoCodeDoc), code: d.id }));
        codes.sort((a, b) => a.code.localeCompare(b.code));
        return res.status(200).json({ codes });
      }
      case "create": {
        const code = normalizeCode(body.code);
        const months = Number(body.discountMonths);
        const maxUses = Number(body.maxUses);
        if (!code) return res.status(400).json({ error: "invalid_code" });
        if (!Number.isInteger(months) || months < 1 || months > 24) return res.status(400).json({ error: "invalid_months" });
        if (!Number.isInteger(maxUses) || maxUses < 1) return res.status(400).json({ error: "invalid_maxUses" });
        const ref = col.doc(code);
        if ((await ref.get()).exists) return res.status(409).json({ error: "exists" });
        await ref.set({
          code,
          discountMonths: months,
          maxUses,
          expiresAt: parseExpiry(body.expiresAt),
          active: true,
          usedBy: [],
          usedCount: 0,
          createdAt: Timestamp.now(),
          createdBy: decoded.uid,
        });
        console.log("[promo] admin create:", code);
        return res.status(200).json({ ok: true });
      }
      case "toggle": {
        const code = normalizeCode(body.code);
        if (!code || typeof body.active !== "boolean") return res.status(400).json({ error: "invalid_input" });
        await col.doc(code).update({ active: body.active });
        return res.status(200).json({ ok: true });
      }
      case "seed": {
        for (const c of SEED) {
          const ref = col.doc(c.code);
          if (!(await ref.get()).exists) {
            await ref.set({ ...c, expiresAt: parseExpiry(c.expiresAt), usedBy: [], usedCount: 0, createdAt: Timestamp.now(), createdBy: decoded.uid });
          }
        }
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(400).json({ error: "unknown_action" });
    }
  } catch (err) {
    console.error("[promo] admin error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
