// api/_lib/aiInsight.ts — pure helpers behind /api/ai-insight.
//
// No Firebase imports: unit-tested with `node --test` (Node strips the types
// natively) and reused by scripts/ai-insight-sample.mjs. The handler fetches
// the selected child's documents with the Admin SDK and hands them here;
// everything in this file filters by childId once more so a stray document
// from another child can never reach the prompt.

import { createHash } from "node:crypto";

export type InsightLanguage = "mn" | "en" | "ru";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const MAX_TOKENS = 600;
export const TEMPERATURE = 0.4;
export const MAX_ACHIEVEMENTS = 30;
/** A cached insight is reused while the data hash is unchanged and it is younger than this. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// Input shapes (Admin SDK documents, loosely typed)
// -----------------------------------------------------------------------------

export interface ChildDocLike {
  childId?: unknown;
  parentId?: unknown;
  teacherIds?: unknown;
  name?: unknown;
  birthDate?: unknown;
  bio?: unknown;
  interests?: unknown;
}

export interface AchievementDocLike {
  id: string;
  childId?: unknown;
  title?: unknown;
  date?: unknown;
  category?: unknown;
  awardType?: unknown;
  location?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PracticeLogDocLike {
  id: string;
  childId?: unknown;
  date?: unknown;
  duration?: unknown;
  createdAt?: unknown;
}

/** What the model receives as the user message (JSON). */
export interface InsightInput {
  child: { name: string; age: number | null; interests: string | null };
  achievements: Array<{ date: string; title: string; category: string; award: string; place?: string }>;
  practiceLogs: { count: number; last30Days: number; lastDate: string | null };
  reflectionsCount?: number;
  language: InsightLanguage;
}

export interface CachedInsightLike {
  text?: unknown;
  dataHash?: unknown;
  language?: unknown;
  createdAt?: unknown;
}

// -----------------------------------------------------------------------------
// Small utils
// -----------------------------------------------------------------------------

export function normalizeLanguage(v: unknown): InsightLanguage {
  if (typeof v !== "string") return "mn";
  const l = v.toLowerCase();
  if (l.startsWith("en")) return "en";
  if (l.startsWith("ru")) return "ru";
  return "mn";
}

/** Firestore Timestamp / Date / ISO / epoch → ms (null if absent). */
export function toMs(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "object") {
    const o = v as { toMillis?: () => number; seconds?: unknown; _seconds?: unknown };
    if (typeof o.toMillis === "function") return o.toMillis();
    const s = typeof o.seconds === "number" ? o.seconds : typeof o._seconds === "number" ? o._seconds : null;
    if (s !== null) return s * 1000;
  }
  return null;
}

const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Whole years from a YYYY-MM-DD birth date, or null when unknown/invalid. */
export function childAge(birthDate: unknown, now: number | Date = Date.now()): number | null {
  if (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  const b = new Date(birthDate.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(b.getTime())) return null;
  const n = typeof now === "number" ? new Date(now) : now;
  let age = n.getUTCFullYear() - b.getUTCFullYear();
  const m = n.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < b.getUTCDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

// -----------------------------------------------------------------------------
// Ownership
// -----------------------------------------------------------------------------

export type ChildAccess = "owner" | "teacher";

/** Mirrors firestore.rules canViewChild(): parent → owner, uid in teacherIds → teacher, else null. */
export function resolveChildAccess(child: ChildDocLike | undefined | null, uid: string): ChildAccess | null {
  if (!child || !uid) return null;
  if (child.parentId === uid) return "owner";
  if (Array.isArray(child.teacherIds) && child.teacherIds.includes(uid)) return "teacher";
  return null;
}

// -----------------------------------------------------------------------------
// Prompt input + data hash
// -----------------------------------------------------------------------------

function onlyChild<T extends { childId?: unknown }>(items: T[], childId: string): T[] {
  return items.filter((x) => x.childId === childId);
}

/** Newest first by date; ties by createdAt. */
function sortNewest<T extends { date?: unknown; createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = str(a.date), dbb = str(b.date);
    if (da !== dbb) return da < dbb ? 1 : -1;
    return (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0);
  });
}

export function buildInsightInput(args: {
  childId: string;
  child: ChildDocLike;
  achievements: AchievementDocLike[];
  practiceLogs: PracticeLogDocLike[];
  /** Pass only for the owner — reflections are parent-private. */
  reflectionsCount?: number;
  language: InsightLanguage;
  now?: number | Date;
}): InsightInput {
  const now = args.now ?? Date.now();
  const nowMs = typeof now === "number" ? now : now.getTime();
  const ach = sortNewest(onlyChild(args.achievements, args.childId)).slice(0, MAX_ACHIEVEMENTS);
  const logs = onlyChild(args.practiceLogs, args.childId);

  const logDates = logs.map((l) => str(l.date, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const cutoff = new Date(nowMs - 30 * DAY_MS).toISOString().slice(0, 10);
  const interestsRaw = str(args.child.interests) || str(args.child.bio);

  return {
    child: {
      name: str(args.child.name, 100) || "—",
      age: childAge(args.child.birthDate, nowMs),
      interests: interestsRaw || null,
    },
    achievements: ach.map((a) => {
      const out: InsightInput["achievements"][number] = {
        date: str(a.date, 10),
        title: str(a.title, 120),
        category: str(a.category, 40),
        award: str(a.awardType, 40),
      };
      const place = str(a.location, 80);
      if (place) out.place = place;
      return out;
    }),
    practiceLogs: {
      count: logs.length,
      last30Days: logDates.filter((d) => d >= cutoff).length,
      lastDate: logDates.length ? logDates[logDates.length - 1] : null,
    },
    ...(typeof args.reflectionsCount === "number" ? { reflectionsCount: args.reflectionsCount } : {}),
    language: args.language,
  };
}

/**
 * Stable fingerprint of the data behind an insight: child name + every
 * achievement / practice log id with its last-modified time. Order-independent.
 */
export function computeDataHash(args: {
  childId: string;
  child: ChildDocLike;
  achievements: AchievementDocLike[];
  practiceLogs: PracticeLogDocLike[];
}): string {
  const a = onlyChild(args.achievements, args.childId)
    .map((x) => `a:${x.id}:${toMs(x.updatedAt) ?? toMs(x.createdAt) ?? str(x.date)}`)
    .sort();
  const p = onlyChild(args.practiceLogs, args.childId)
    .map((x) => `p:${x.id}:${toMs(x.createdAt) ?? str(x.date)}`)
    .sort();
  const h = createHash("sha256");
  h.update(`c:${str(args.child.name, 100)}|${str(args.child.birthDate, 10)}\n`);
  h.update(a.join("\n") + "\n" + p.join("\n"));
  return h.digest("hex").slice(0, 32);
}

/** True when the cached document can be served instead of a new generation. */
export function isCacheFresh(
  cached: CachedInsightLike | undefined | null,
  dataHash: string,
  language: InsightLanguage,
  now: number = Date.now(),
  ttlMs: number = CACHE_TTL_MS
): boolean {
  if (!cached || typeof cached.text !== "string" || !cached.text.trim()) return false;
  if (cached.dataHash !== dataHash || cached.language !== language) return false;
  const created = toMs(cached.createdAt);
  if (created === null) return false;
  return now - created < ttlMs;
}

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------

export const HEADINGS: Record<InsightLanguage, [string, string, string]> = {
  mn: ["Давуу тал", "Ажиглалт", "Дараагийн алхам"],
  en: ["Strengths", "Observations", "Next steps"],
  ru: ["Сильные стороны", "Наблюдения", "Следующие шаги"],
};

const OUTPUT_LANGUAGE: Record<InsightLanguage, string> = {
  mn: "Хариултыг зөвхөн монгол хэлээр бич.",
  en: "Хариултыг ЗӨВХӨН англи хэлээр (English) бич. Монгол үг оруулахгүй. Гарчгууд яг: Strengths / Observations / Next steps.",
  ru: "Хариултыг ЗӨВХӨН орос хэлээр (русский) бич. Монгол үг оруулахгүй. Гарчгууд яг: Сильные стороны / Наблюдения / Следующие шаги.",
};

/** Stable part first (cacheable), the output-language line last. */
export function buildSystemPrompt(language: InsightLanguage): string {
  const [h1, h2, h3] = HEADINGS.mn;
  return `Чи хүүхдийн хөгжлийн зөвлөх. Уншигч нь хүүхдийн эцэг эх. Хүүхдийг нэрээр нь, гуравдугаар биеэр дурд (жишээ: "Үүлэн сүүлийн сард ..."). Хүүхдэд "чи", "та" гэж хандахгүй.

Баримт: Зөвхөн доорх JSON-д өгөгдсөн баримтад тулгуурла. Байхгүй зүйл зохиохгүй, таамаглахгүй. Амжилтын нэр, тэмцээн, байгууллагын нэрийг өөрчлөхгүй, орчуулахгүй (латин үсгээр бичсэн нэр хэвээр).

Хэл: зөв найруулгатай, энгийн, тодорхой монгол хэл. Богино өгүүлбэр. Нэг үгийг давтахгүй: "сайхан", "гайхалтай" зэрэг магтаалын үг тус бүр нэгээс илүүгүй удаа. Хоосон магтаалгүй: магтаал бүр тодорхой баримт (амжилт, огноо, тоо) дээр тулгуурлана. Emoji, markdown тэмдэг (*, #, -) хэрэглэхгүй.

Бүтэц: яг энэ 3 гарчигтай, гарчиг бүр тусдаа мөрөнд, хэсгүүдийн хооронд нэг хоосон мөр, нийт 120 үгээс хэтрэхгүй.
${h1}
1–2 өгүүлбэр. Тодорхой амжилтыг нэрлэж, юуг давуу тал гэж харж байгаагаа хэл.
${h2}
Хэв маяг: ямар төрөлд (category) төвлөрч байна, бэлтгэлийн тогтмол байдал (practiceLogs), сүүлийн үеийн чиг. Өгөгдөл цөөн (амжилт 3-аас цөөн, эсвэл бэлтгэлийн бичлэг 0) бол "Өгөгдөл цөөн тул дүгнэхэд эрт байна" гэж шууд хэлж, таамаглахгүй.
${h3}
1–2 тодорхой, хэрэгжүүлэхүйц санал тухайн чиглэлд. Жишээ: "сард 2 удаа бэлтгэлээ тэмдэглэх", "дараагийн X тэмцээнд бэлдэх".

Онцгой тохиолдол: achievements хоосон бол дээрх бүтэцгүйгээр, эхний амжилтыг бүртгэхийг урамшуулсан 2 өгүүлбэр л бич.

Гаралтын хэл: ${OUTPUT_LANGUAGE[language]}`;
}

// -----------------------------------------------------------------------------
// Anthropic request body
// -----------------------------------------------------------------------------

export function resolveModel(env: { AI_INSIGHT_MODEL?: string | undefined } = process.env): string {
  const m = env.AI_INSIGHT_MODEL?.trim();
  return m && /^[a-z0-9.-]+$/i.test(m) ? m : DEFAULT_MODEL;
}

/** Claude 5-generation models reject non-default sampling params (temperature → 400). */
export function isGen5Model(model: string): boolean {
  return /^claude-(sonnet|opus|fable|mythos)-5(-|$)/.test(model);
}

/**
 * Messages API body for one insight. Sampling differs by model:
 *   • claude-sonnet-5-5: thinking off via `between_tools` (so the 600-token
 *     budget is all answer), no temperature (non-default values are a 400).
 *   • other 5.x models: adaptive thinking at low effort, no temperature.
 *   • 4.x / Haiku: temperature 0.4, no thinking.
 */
export function anthropicRequestBody(model: string, language: InsightLanguage, input: InsightInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: buildSystemPrompt(language), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(input) }],
  };
  if (model === "claude-sonnet-5-5") {
    body.thinking = { type: "between_tools" };
  } else if (isGen5Model(model)) {
    body.output_config = { effort: "low" };
  } else {
    body.temperature = TEMPERATURE;
  }
  return body;
}

/** Concatenate the text blocks of a Messages API response (never trust block position). */
export function extractText(resp: { content?: Array<{ type?: string; text?: string }> } | null | undefined): string {
  return (resp?.content ?? [])
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}
