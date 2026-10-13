// scripts/admin/_admin.mjs — shared Admin SDK bootstrap for the admin scripts.
// Credentials come from FIREBASE_SERVICE_ACCOUNT_B64 (process env or ../../.env);
// nothing secret lives in this file. Never prints the key.
import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function loadEnv() {
  const p = new URL("../../.env", import.meta.url);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

export function admin() {
  loadEnv();
  if (!getApps().length) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!b64) { console.error("FIREBASE_SERVICE_ACCOUNT_B64 missing (env or .env)"); process.exit(2); }
    const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  return { auth: getAuth(), db: getFirestore() };
}

export const PLAN_IDS = ["family", "master", "coach"];
export const DAY_MS = 24 * 60 * 60 * 1000;
