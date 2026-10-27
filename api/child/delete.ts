// api/child/delete.ts — Vercel Serverless Function
//
// POST { childId }  (Authorization: Bearer <Firebase ID token>)
//   → 200 { ok, alreadyGone, deleted: { photos, avatarFiles, achievements, practiceLogs,
//                                       reflections, coachNotes, inviteCodes, aiInsights, child } }
//   401 no/invalid token · 403 not the parent (teachers included) · 400 bad childId · 429 >10/h
//
// Only children.parentId may delete. Everything is removed server-side with the
// Admin SDK in a fixed order (Storage → collections → inviteCodes → aiInsights →
// the child doc), so a client never has to issue dozens of its own deletes.
// Idempotent: a second call for a child that is already gone answers 200.
// Logic: api/_lib/deletion.ts (unit-tested), deps: api/_lib/adminDeletionDeps.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bearerToken, buildAllowList, isAllowedOrigin } from "../_lib/aiGuard.js";
import { processChildDelete } from "../_lib/deletion.js";
import { adminDeletionDeps } from "../_lib/adminDeletionDeps.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  // Same allow-list as /api/ai-insight, plus this deployment's own Vercel host so the
  // flow works on branch previews (browsers send Origin on same-origin POSTs too).
  const allowList = [
    ...buildAllowList(process.env.APP_URL),
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter((h): h is string => !!h).map((h) => `https://${h}`),
  ];
  if (!isAllowedOrigin(origin, allowList)) {
    return res.status(403).json({ error: "origin_not_allowed" });
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const out = await processChildDelete({ token: bearerToken(req.headers.authorization), body: req.body }, adminDeletionDeps);
  for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
  return res.status(out.status).json(out.body);
}
