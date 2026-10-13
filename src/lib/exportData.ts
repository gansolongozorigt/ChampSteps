// =============================================================================
// exportData — "Миний өгөгдөл": the user's own data as one JSON document.
// Pure: no Firebase / DOM here (unit-tested in tests/export-data.test.mjs).
// Reading happens in exportFetch.ts under the normal client rules.
// =============================================================================

import type { Achievement, Child, PracticeLog, Reflection } from "../types";

export const EXPORT_SCHEMA_VERSION = 1;

/** Who is exporting: a parent (children + everything under them), a teacher (own notes only), a guest (localStorage). */
export type ExportScope = "parent" | "teacher" | "guest";

export interface CoachNoteLike {
  id: string;
  childId: string;
  teacherId: string;
  teacherName?: string;
  content: string;
  createdAt?: unknown;
}

export interface ExportInput {
  scope: ExportScope;
  uid: string;
  /** Raw users/{uid} document (or null for guests). Sanitised by buildExport. */
  user: Record<string, unknown> | null;
  children: Child[];
  achievements: Achievement[];
  practiceLogs: PracticeLog[];
  reflections: Reflection[];
  /** aiInsights/{childId} docs that exist. */
  aiInsights: Array<{ childId: string; text: string; updatedAt?: unknown; [k: string]: unknown }>;
  coachNotes: CoachNoteLike[];
  appVersion: string;
  now: Date;
}

export interface ExportImage {
  childId: string;
  /** "" for the child's avatar */
  achievementId: string;
  index: number;
  url: string;
  /** Path inside the ZIP: images/{childId}/{achievementId}-{n}.jpg or images/{childId}/avatar.jpg */
  zipPath: string;
}

export interface ExportChild extends Omit<Child, "teacherIds"> {
  teacherIds: string[];
  achievements: Achievement[];
  practiceLogs: PracticeLog[];
  reflections: Reflection[];
  aiInsight: { text: string; updatedAt?: string } | null;
  coachNotes: CoachNoteLike[];
}

export interface ExportFile {
  exportedAt: string;
  appVersion: string;
  schemaVersion: number;
  scope: ExportScope;
  user: Record<string, unknown> | null;
  children: ExportChild[];
  /** Teacher: own notes across all linked children (child data itself belongs to the parent). */
  coachNotes: CoachNoteLike[];
  /** Every Storage URL in the export, with its ZIP path. */
  images: ExportImage[];
  notes: string[];
}

// Fields of users/{uid} that are the user's own profile; server-side subscription internals are left out.
const USER_FIELDS = ["uid", "email", "displayName", "role", "createdAt", "subscriptionTier", "subscriptionExpiresAt"] as const;

/** Firestore Timestamp (anything with toDate()) and Date -> ISO string, recursively. */
export function toIsoDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (typeof value === "object") {
    const v = value as unknown as { toDate?: () => Date };
    if (typeof v.toDate === "function") return v.toDate().toISOString() as unknown as T;
    if (Array.isArray(value)) return value.map((x) => toIsoDeep(x)) as unknown as T;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(value as Record<string, unknown>)) out[k] = toIsoDeep(x);
    return out as unknown as T;
  }
  return value;
}

export function sanitizeUserDoc(doc: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!doc) return null;
  const out: Record<string, unknown> = {};
  for (const k of USER_FIELDS) if (k in doc) out[k] = toIsoDeep(doc[k]);
  return out;
}

export function exportFilename(now: Date, ext: "json" | "zip"): string {
  return `champstep-export-${now.toISOString().slice(0, 10).replace(/-/g, "")}.${ext}`;
}

function extOf(url: string): string {
  const m = /\.(jpe?g|png|webp|gif)(\?|$)/i.exec(url.split("?")[0].split("/").pop() ?? "");
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

/** Every http(s) image of the children (avatars + achievement photos) with a ZIP path. Local data: URLs are skipped. */
export function collectImages(children: Child[], achievements: Achievement[]): ExportImage[] {
  const out: ExportImage[] = [];
  for (const c of children) {
    if (c.avatarUrl && /^https?:/.test(c.avatarUrl)) {
      out.push({ childId: c.childId, achievementId: "", index: 0, url: c.avatarUrl, zipPath: `images/${c.childId}/avatar.${extOf(c.avatarUrl)}` });
    }
    for (const a of achievements.filter((a) => a.childId === c.childId)) {
      (a.imageURLs ?? []).forEach((url, i) => {
        if (!/^https?:/.test(url)) return;
        out.push({ childId: c.childId, achievementId: a.id, index: i + 1, url, zipPath: `images/${c.childId}/${a.id}-${i + 1}.${extOf(url)}` });
      });
    }
  }
  return out;
}

export function buildExport(input: ExportInput): ExportFile {
  const notes: string[] = [];
  const byChild = <T extends { childId: string }>(list: T[], id: string) => toIsoDeep(list.filter((x) => x.childId === id));
  let children: ExportChild[] = [];
  let coachNotes: CoachNoteLike[] = [];

  if (input.scope === "teacher") {
    coachNotes = toIsoDeep(input.coachNotes.filter((n) => n.teacherId === input.uid));
    notes.push("teacher: only your own notes are included; the children's records belong to their parents.");
  } else {
    children = input.children.map((c) => {
      const ai = input.aiInsights.find((x) => x.childId === c.childId);
      return {
        ...toIsoDeep(c),
        teacherIds: Array.isArray(c.teacherIds) ? c.teacherIds : [],
        achievements: byChild(input.achievements, c.childId),
        practiceLogs: byChild(input.practiceLogs, c.childId),
        reflections: byChild(input.reflections, c.childId),
        aiInsight: ai ? { text: ai.text, updatedAt: toIsoDeep(ai.updatedAt) as string | undefined } : null,
        coachNotes: byChild(input.coachNotes, c.childId),
      };
    });
    if (input.scope === "guest") notes.push("guest: data from this device only (localStorage); no photos.");
  }

  return {
    exportedAt: input.now.toISOString(),
    appVersion: input.appVersion,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    scope: input.scope,
    user: sanitizeUserDoc(input.user),
    children,
    coachNotes,
    images: input.scope === "parent" ? collectImages(input.children, input.achievements) : [],
    notes,
  };
}

/** ZIP guard rails: above either limit the UI tells the user to take the JSON and the photos separately. */
export const ZIP_LIMITS = { maxImages: 50, maxBytes: 100 * 1024 * 1024 } as const;

export function zipTooBig(imageCount: number, bytesSoFar = 0): boolean {
  return imageCount > ZIP_LIMITS.maxImages || bytesSoFar > ZIP_LIMITS.maxBytes;
}
