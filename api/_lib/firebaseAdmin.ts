// api/_lib/firebaseAdmin.ts — Firebase Admin SDK singleton (server only)
//
// FIREBASE_SERVICE_ACCOUNT_B64 = base64(service-account.json)
// Vercel-ийн serverless функцүүд module-ийг дахин ашигладаг тул
// initializeApp-ийг давхар дуудахаас getApps() шалгаж хамгаална.

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function loadServiceAccount(): Record<string, string> {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
  }
  let json: string;
  try {
    json = Buffer.from(b64, "base64").toString("utf8");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64");
  }
  try {
    return JSON.parse(json);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 does not decode to JSON");
  }
}

function getApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  const sa = loadServiceAccount();
  return initializeApp({
    credential: cert(sa),
    projectId: sa.project_id,
  });
}

const app = getApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

/**
 * Firebase ID token-оос uid гаргана. Буруу / хугацаа дууссан бол null.
 */
export async function verifyIdToken(idToken: unknown): Promise<string | null> {
  if (typeof idToken !== "string" || !idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}
