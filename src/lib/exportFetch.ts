// =============================================================================
// exportFetch — reads the signed-in user's own data under the normal client
// rules (no API) and turns it into a JSON / ZIP download. Builders: exportData.ts.
// =============================================================================

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import type { AppUser } from "./auth";
import { db, getChildrenForParent, getChildrenForTeacher, getUserDoc } from "./firebase";
import { loadLocalData } from "./localStore";
import type { Achievement, Child, PracticeLog, Reflection } from "../types";
import { buildExport, exportFilename, zipTooBig, type CoachNoteLike, type ExportFile, type ExportInput } from "./exportData";

const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

function requireDb() {
  if (!db) throw new Error("firestore unavailable");
  return db;
}

async function listByChild<T>(col: string, childId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(requireDb(), col), where("childId", "==", childId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/** Everything the export needs, read with the user's own credentials. */
export async function fetchExportInput(user: AppUser, now = new Date()): Promise<ExportInput> {
  if (user.isOffline) {
    const local = loadLocalData();
    return {
      scope: "guest", uid: user.uid, user: { uid: user.uid, displayName: user.displayName, role: user.role },
      children: local ? [local.child] : [], achievements: local?.achievements ?? [], practiceLogs: local?.practiceLogs ?? [],
      reflections: local?.reflections ?? [], aiInsights: [], coachNotes: [], appVersion: APP_VERSION, now,
    };
  }
  const userDoc = (await getUserDoc(user.uid)) as Record<string, unknown> | null;
  if (user.role === "teacher") {
    const kids = await getChildrenForTeacher(user.uid);
    const notes: CoachNoteLike[] = [];
    for (const k of kids) notes.push(...(await listByChild<CoachNoteLike>("coachNotes", k.childId)).filter((n) => n.teacherId === user.uid));
    return { scope: "teacher", uid: user.uid, user: userDoc, children: [], achievements: [], practiceLogs: [], reflections: [], aiInsights: [], coachNotes: notes, appVersion: APP_VERSION, now };
  }
  const children: Child[] = await getChildrenForParent(user.uid);
  const achievements: Achievement[] = [], practiceLogs: PracticeLog[] = [], reflections: Reflection[] = [], coachNotes: CoachNoteLike[] = [];
  const aiInsights: ExportInput["aiInsights"] = [];
  for (const c of children) {
    achievements.push(...(await listByChild<Achievement>("achievements", c.childId)));
    practiceLogs.push(...(await listByChild<PracticeLog>("practiceLogs", c.childId)));
    reflections.push(...(await listByChild<Reflection>("reflections", c.childId)));
    coachNotes.push(...(await listByChild<CoachNoteLike>("coachNotes", c.childId)));
    try {
      const ai = await getDoc(doc(requireDb(), "aiInsights", c.childId));
      if (ai.exists()) aiInsights.push({ childId: c.childId, ...(ai.data() as { text: string }) });
    } catch { /* no cached insight, or not readable: skipped */ }
  }
  return { scope: "parent", uid: user.uid, user: userDoc, children, achievements, practiceLogs, reflections, aiInsights, coachNotes, appVersion: APP_VERSION, now };
}

export async function buildUserExport(user: AppUser, now = new Date()): Promise<ExportFile> {
  return buildExport(await fetchExportInput(user, now));
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadJson(file: ExportFile) {
  saveBlob(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }), exportFilename(new Date(file.exportedAt), "json"));
}

export interface ZipProgress { done: number; total: number }
export type ZipResult = { ok: true; missing: number; bytes: number } | { ok: false; reason: "tooBig" };

/** JSON + every reachable photo. JSZip is loaded on demand (own chunk). Unreachable photos are listed in images-missing.txt. */
export async function downloadZip(file: ExportFile, onProgress?: (p: ZipProgress) => void): Promise<ZipResult> {
  if (zipTooBig(file.images.length)) return { ok: false, reason: "tooBig" };
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(exportFilename(new Date(file.exportedAt), "json"), JSON.stringify(file, null, 2));
  const missing: string[] = [];
  let bytes = 0;
  const total = file.images.length;
  onProgress?.({ done: 0, total });
  for (let i = 0; i < total; i++) {
    const img = file.images[i];
    try {
      const res = await fetch(img.url, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      bytes += buf.byteLength;
      if (zipTooBig(total, bytes)) return { ok: false, reason: "tooBig" };
      zip.file(img.zipPath, buf);
    } catch (e) {
      missing.push(`${img.zipPath}\t${img.url}\t${e instanceof Error ? e.message : "fetch failed"}`);
    }
    onProgress?.({ done: i + 1, total });
  }
  if (missing.length) zip.file("images-missing.txt", missing.join("\n") + "\n");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  saveBlob(blob, exportFilename(new Date(file.exportedAt), "zip"));
  return { ok: true, missing: missing.length, bytes };
}
