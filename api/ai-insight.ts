// api/ai-insight.ts — Vercel Serverless Function
//
// POST { childId, language? } → { insight, cached, createdAt }
//
// The client sends ONLY the child id. The server verifies the Firebase ID
// token, checks the plan (hasAI), loads children/{childId} and verifies
// ownership (parentId == uid, or uid in teacherIds), then reads that child's
// achievements / practiceLogs (/ reflections for the owner) itself with the
// Admin SDK. Nothing data-related from the request body is trusted.
//
// Cache: aiInsights/{childId} { text, model, language, dataHash, createdAt }
// written only here. While the data hash is unchanged, the language matches
// and the entry is < 24h old, the cached text is returned (no Anthropic call,
// no rate-limit count). Rate limit: aiUsage/{uid} 10 generations / hour.
//
// AI_INSIGHT_MOCK=1 (never in production): echoes the prompt JSON instead of
// calling Anthropic — used by the E2E suite.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, verifyIdTokenFull } from "./_lib/firebaseAdmin.js";
import {
  AI_RATE_LIMIT,
  AI_RATE_WINDOW_MS,
  bearerToken,
  buildAllowList,
  effectiveTier,
  isAllowedOrigin,
  nextRateWindow,
  tierHasAI,
  toMillis,
  type UserDocLike,
} from "./_lib/aiGuard.js";
import {
  anthropicRequestBody,
  buildInsightInput,
  computeDataHash,
  extractText,
  isCacheFresh,
  normalizeLanguage,
  resolveChildAccess,
  resolveModel,
  type AchievementDocLike,
  type CachedInsightLike,
  type ChildDocLike,
  type PracticeLogDocLike,
} from "./_lib/aiInsight.js";

const CHILD_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** 10/цаг хязгаар. Хязгаарлагч өөрөө алдвал хүсэлтийг зогсоохгүй (log → үргэлжлүүлнэ). */
async function checkRateLimit(uid: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const ref = adminDb.collection("aiUsage").doc(uid);
  const now = Date.now();
  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? (snap.data() as { windowStart?: unknown; count?: unknown }) : undefined;
      const next = nextRateWindow(
        { windowStart: toMillis(data?.windowStart), count: typeof data?.count === "number" ? data.count : 0 },
        now,
        AI_RATE_LIMIT,
        AI_RATE_WINDOW_MS
      );
      if (next.allowed) {
        tx.set(ref, {
          windowStart: Timestamp.fromMillis(next.windowStart),
          count: next.count,
          updatedAt: Timestamp.fromMillis(now),
        });
      }
      return { allowed: next.allowed, retryAfterSec: next.retryAfterSec };
    });
  } catch (err) {
    console.error("ai-insight rate limiter error (request allowed):", err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

function mockEnabled(): boolean {
  return process.env.AI_INSIGHT_MOCK === "1" && process.env.VERCEL_ENV !== "production";
}

async function docsFor<T extends { id: string }>(col: string, childId: string): Promise<T[]> {
  const snap = await adminDb.collection(col).where("childId", "==", childId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as unknown as T);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — зөвхөн allow-list дахь Origin. Origin байхгүй (same-origin) бол OK.
  const origin = req.headers.origin;
  const allowList = buildAllowList(process.env.APP_URL);
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

  // Auth — Firebase ID token.
  const decoded = await verifyIdTokenFull(bearerToken(req.headers.authorization));
  if (!decoded) return res.status(401).json({ error: "unauthorized" });
  const uid = decoded.uid;

  // Tier — users/{uid}.subscriptionTier, хугацаа дууссан бол free.
  let userDoc: UserDocLike | undefined;
  try {
    const snap = await adminDb.collection("users").doc(uid).get();
    userDoc = snap.exists ? (snap.data() as UserDocLike) : undefined;
  } catch (err) {
    console.error("ai-insight user lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
  const tier = effectiveTier(userDoc, Date.now());
  if (!tierHasAI(tier)) return res.status(403).json({ error: "tier_required", tier });

  // Body — only childId (+ language) is read.
  const body = (req.body ?? {}) as Record<string, unknown>;
  const childId = typeof body.childId === "string" ? body.childId.trim() : "";
  if (!CHILD_ID_RE.test(childId)) return res.status(400).json({ error: "childId_required" });
  const language = normalizeLanguage(body.language);

  // Ownership — children/{childId}.parentId == uid or uid in teacherIds.
  let child: ChildDocLike | undefined;
  try {
    const snap = await adminDb.collection("children").doc(childId).get();
    child = snap.exists ? (snap.data() as ChildDocLike) : undefined;
  } catch (err) {
    console.error("ai-insight child lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
  if (!child) return res.status(404).json({ error: "child_not_found" });
  const access = resolveChildAccess(child, uid);
  if (!access) return res.status(403).json({ error: "forbidden" });

  const mock = mockEnabled();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !mock) {
    return res.status(500).json({ error: "API key not configured" });
  }

  // Data — read server-side, scoped to this child only.
  let achievements: AchievementDocLike[];
  let practiceLogs: PracticeLogDocLike[];
  let reflectionsCount: number | undefined;
  let cached: CachedInsightLike | undefined;
  const cacheRef = adminDb.collection("aiInsights").doc(childId);
  try {
    const [a, p, c] = await Promise.all([
      docsFor<AchievementDocLike>("achievements", childId),
      docsFor<PracticeLogDocLike>("practiceLogs", childId),
      cacheRef.get(),
    ]);
    achievements = a;
    practiceLogs = p;
    cached = c.exists ? (c.data() as CachedInsightLike) : undefined;
    if (access === "owner") {
      const r = await adminDb.collection("reflections").where("childId", "==", childId).count().get();
      reflectionsCount = r.data().count;
    }
  } catch (err) {
    console.error("ai-insight data read error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }

  const now = Date.now();
  const dataHash = computeDataHash({ childId, child, achievements, practiceLogs });

  // Cache hit → no model call, no rate-limit count.
  if (isCacheFresh(cached, dataHash, language, now)) {
    return res.status(200).json({
      insight: cached!.text,
      cached: true,
      createdAt: new Date(toMillis(cached!.createdAt) ?? now).toISOString(),
    });
  }

  // Rate limit — Anthropic-ийг дуудахын өмнө тоолно.
  const rate = await checkRateLimit(uid);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return res.status(429).json({ error: "rate_limited", retryAfterSec: rate.retryAfterSec });
  }

  const input = buildInsightInput({ childId, child, achievements, practiceLogs, reflectionsCount, language, now });
  const model = mock ? "mock" : resolveModel();

  try {
    let insight: string;
    if (mock) {
      insight = JSON.stringify(input);
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey as string,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(anthropicRequestBody(model, language, input)),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Anthropic API error:", response.status, errText);
        return res.status(502).json({ error: "Anthropic API error" });
      }

      const data = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        stop_reason?: string;
      };
      if (data.stop_reason === "refusal") {
        console.error("ai-insight: model refused");
        return res.status(502).json({ error: "Anthropic API error" });
      }
      if (data.stop_reason === "max_tokens") console.warn("ai-insight: output hit max_tokens");
      insight = extractText(data);
      if (!insight) return res.status(502).json({ error: "Anthropic API error" });
    }

    // Server-only cache write (rules block every client write to aiInsights).
    try {
      await cacheRef.set({
        childId,
        text: insight,
        model,
        language,
        dataHash,
        createdAt: Timestamp.fromMillis(now),
        requestedBy: uid,
      });
    } catch (err) {
      console.error("ai-insight cache write error (response still sent):", err);
    }

    return res.status(200).json({ insight, cached: false, createdAt: new Date(now).toISOString() });
  } catch (err) {
    console.error("ai-insight handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
