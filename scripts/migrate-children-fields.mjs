#!/usr/bin/env node
// =============================================================================
// scripts/migrate-children-fields.mjs — backfill children.teacherIds
//
//   node scripts/migrate-children-fields.mjs            # dry-run (default)
//   node scripts/migrate-children-fields.mjs --apply    # write teacherIds: []
//
// • children docs WITHOUT teacherIds            → teacherIds: [] is added
// • children docs whose teacherIds is not a list → listed, NOT touched
// • children docs WITHOUT parentId (string)      → listed, NOT touched
// Prints counts and document ids only — never names or field values.
//
// Auth: FIREBASE_SERVICE_ACCOUNT_B64 (same as api/_lib/firebaseAdmin.ts) or
// GOOGLE_APPLICATION_CREDENTIALS. Reads .env from the repo root if present.
// =============================================================================
import { readFileSync, existsSync } from "node:fs";
import { cert, applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const BATCH = 400;

function loadDotEnv() {
  const p = new URL("../.env", import.meta.url);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

function init() {
  loadDotEnv();
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT ?? "champstep-22358" });
  }
  console.error("FIREBASE_SERVICE_ACCOUNT_B64 (or GOOGLE_APPLICATION_CREDENTIALS) is not set");
  process.exit(2);
}

init();
const db = getFirestore();

const snap = await db.collection("children").get();
const missingTeacherIds = [];
const badTeacherIds = [];
const missingParentId = [];
for (const d of snap.docs) {
  const data = d.data();
  if (typeof data.parentId !== "string" || data.parentId.length === 0) missingParentId.push(d.id);
  if (!("teacherIds" in data)) missingTeacherIds.push(d.id);
  else if (!Array.isArray(data.teacherIds)) badTeacherIds.push(d.id);
}

console.log(`mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`children total: ${snap.size}`);
console.log(`children without teacherIds (will add []): ${missingTeacherIds.length}`);
if (missingTeacherIds.length) console.log("  ids:", missingTeacherIds.join(", "));
console.log(`children with non-list teacherIds (NOT touched): ${badTeacherIds.length}`);
if (badTeacherIds.length) console.log("  ids:", badTeacherIds.join(", "));
console.log(`children without parentId string (NOT touched): ${missingParentId.length}`);
if (missingParentId.length) console.log("  ids:", missingParentId.join(", "));

if (!APPLY) {
  console.log("\nDry-run only. Re-run with --apply to write.");
  process.exit(0);
}

let written = 0;
for (let i = 0; i < missingTeacherIds.length; i += BATCH) {
  const batch = db.batch();
  for (const id of missingTeacherIds.slice(i, i + BATCH)) {
    batch.update(db.collection("children").doc(id), {
      teacherIds: [],
      migratedTeacherIdsAt: FieldValue.serverTimestamp(),
    });
    written++;
  }
  await batch.commit();
}
console.log(`\napplied: teacherIds: [] added to ${written} children docs`);
