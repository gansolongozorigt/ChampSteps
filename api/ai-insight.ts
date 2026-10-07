// api/ai-insight.ts — Vercel Serverless Function
// Хэл автоматаар тодорхойлж, тохирох хэлээр хариу өгнө.
//
// Хамгаалалт: Authorization: Bearer <Firebase idToken> → users/{uid}-ийн
// идэвхтэй багц hasAI байх ёстой → aiUsage/{uid} 10 хүсэлт/цаг → CORS allow-list.

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

const MAX_NAME_LEN = 100;
const MAX_SUMMARY_LEN = 5000;

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

  const { childName, birthDate, summary, language } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof childName !== "string" || !childName.trim() || typeof summary !== "string" || !summary.trim()) {
    return res.status(400).json({ error: "childName and summary are required" });
  }
  if (childName.length > MAX_NAME_LEN || summary.length > MAX_SUMMARY_LEN) {
    return res.status(400).json({ error: "payload_too_large" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  // Rate limit — Anthropic-ийг дуудахын өмнө тоолно.
  const rate = await checkRateLimit(uid);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return res.status(429).json({ error: "rate_limited", retryAfterSec: rate.retryAfterSec });
  }

  // Хэл тодорхойлох: frontend-ээс "mn" эсвэл "en" илгээнэ, эсвэл default монгол
  const lang = language === "en" ? "en" : "mn";
  const birth = typeof birthDate === "string" && birthDate ? birthDate.slice(0, 40) : undefined;

  const systemPrompt =
    lang === "en"
      ? `You are a supportive children's achievement coach.
Analyze the child's achievements and give warm, encouraging, personalized advice in English.
Be specific about what they've accomplished. Keep it to 3-4 sentences.
Do NOT use Mongolian — respond ONLY in English.`
      : `Та хүүхдийн амжилтыг дэмжих мэргэжлийн зөвлөх.
Хүүхдийн амжилтуудыг шинжилж, дулаан, урамшуулалтай, хувийн зөвлөгөө монгол хэлээр өг.
Тодорхой амжилтуудыг дурдаж, цаашид юу хийж болохыг хэлж өг.
3-4 өгүүлбэрт багтаа.
Зөвхөн монгол хэлээр хариулна уу.`;

  const userMessage =
    lang === "en"
      ? `Child's name: ${childName}
Date of birth: ${birth ?? "unknown"}
Recent achievements:
${summary}

Please provide 3-4 sentences of warm, specific, encouraging advice in English.`
      : `Хүүхдийн нэр: ${childName}
Төрсөн огноо: ${birth ?? "мэдэгдэхгүй"}
Сүүлийн амжилтууд:
${summary}

3-4 өгүүлбэрт дулаан, тодорхой, урамшуулалтай зөвлөгөө монгол хэлээр өгнө үү.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(502).json({ error: "Anthropic API error", detail: errText });
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const insight = data?.content?.[0]?.text ?? "";

    return res.status(200).json({ insight });
  } catch (err) {
    console.error("ai-insight handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
