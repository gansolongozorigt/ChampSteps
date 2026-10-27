#!/usr/bin/env node
// =============================================================================
// scripts/audit-data-shape.mjs — read-only data-shape audit (Admin SDK)
//   node scripts/audit-data-shape.mjs
// Prints COUNTS and document ids only — never names, emails or field values.
// Auth: FIREBASE_SERVICE_ACCOUNT_B64 (see scripts/migrate-children-fields.mjs)
// =============================================================================
import { readFileSync, existsSync } from "node:fs";
import { cert, applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
loadDotEnv();
const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
if (b64) {
  const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT ?? "champstep-22358" });
} else {
  console.error("FIREBASE_SERVICE_ACCOUNT_B64 (or GOOGLE_APPLICATION_CREDENTIALS) is not set");
  process.exit(2);
}
const db = getFirestore();
const count = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

// children
const children = await db.collection("children").get();
const childIds = new Set(children.docs.map((d) => d.id));
let parentOk = 0, parentMissing = [], teacherOk = 0, teacherMissing = [], teacherBad = [], childIdMismatch = [];
for (const d of children.docs) {
  const x = d.data();
  typeof x.parentId === "string" && x.parentId ? parentOk++ : parentMissing.push(d.id);
  if (!("teacherIds" in x)) teacherMissing.push(d.id);
  else if (Array.isArray(x.teacherIds)) teacherOk++;
  else teacherBad.push(d.id);
  if (x.childId !== d.id) childIdMismatch.push(d.id);
}
console.log(`children: ${children.size}`);
console.log(`  parentId string: ${parentOk} · missing/non-string: ${parentMissing.length}${parentMissing.length ? " → " + parentMissing.join(", ") : ""}`);
console.log(`  teacherIds array: ${teacherOk} · missing: ${teacherMissing.length}${teacherMissing.length ? " → " + teacherMissing.join(", ") : ""} · non-array: ${teacherBad.length}${teacherBad.length ? " → " + teacherBad.join(", ") : ""}`);
console.log(`  childId != doc id: ${childIdMismatch.length}${childIdMismatch.length ? " → " + childIdMismatch.join(", ") : ""}`);

// child-scoped collections: childId must point at an existing child
for (const col of ["achievements", "practiceLogs", "reflections", "coachNotes"]) {
  const s = await db.collection(col).get();
  const orphan = [], missing = [];
  for (const d of s.docs) {
    const c = d.data().childId;
    if (typeof c !== "string" || !c) missing.push(d.id);
    else if (!childIds.has(c)) orphan.push(d.id);
  }
  console.log(`${col}: ${s.size} · childId missing: ${missing.length}${missing.length ? " → " + missing.join(", ") : ""} · childId not in children: ${orphan.length}${orphan.length ? " → " + orphan.join(", ") : ""}`);
}

// users
const users = await db.collection("users").get();
const roles = new Map(), tiers = new Map();
let uidMismatch = [];
for (const d of users.docs) {
  const x = d.data();
  count(roles, "role" in x ? String(x.role) : "(missing)");
  count(tiers, "subscriptionTier" in x ? String(x.subscriptionTier) : "(missing)");
  if (x.uid !== d.id) uidMismatch.push(d.id);
}
console.log(`users: ${users.size}`);
console.log("  role:", Object.fromEntries(roles));
console.log("  subscriptionTier:", Object.fromEntries(tiers));
console.log(`  uid != doc id: ${uidMismatch.length}${uidMismatch.length ? " → " + uidMismatch.join(", ") : ""}`);
