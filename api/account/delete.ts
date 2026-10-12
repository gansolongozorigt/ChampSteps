// api/account/delete.ts — Vercel Serverless Function
//
// POST { confirmEmail }  (Authorization: Bearer <Firebase ID token>)
//   → 200 { ok, deleted: { children, childData, teacherInviteCodes, teacherCoachNotes,
//                          unlinkedStudents, userDoc, authUser } }
//   401 no/invalid token · 400 confirmEmail ≠ token e-mail · 429 >3/h
//
// Parent: every child (api/_lib/deletion.ts deleteChildData) → users/{uid} → Auth user.
// Teacher: invite codes, coach notes, uid removed from children.teacherIds → users/{uid} → Auth user.
// payments/{orderId} are kept as financial records (they hold uid/plan/amount only).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bearerToken, buildAllowList, isAllowedOrigin } from "../_lib/aiGuard.js";
import { processAccountDelete } from "../_lib/deletion.js";
import { adminDeletionDeps } from "../_lib/adminDeletionDeps.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin, buildAllowList(process.env.APP_URL))) {
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

  const out = await processAccountDelete({ token: bearerToken(req.headers.authorization), body: req.body }, adminDeletionDeps);
  for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
  return res.status(out.status).json(out.body);
}
