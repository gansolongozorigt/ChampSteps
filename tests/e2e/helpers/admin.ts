// Admin SDK helpers for E2E: create/clean ONLY the test accounts this run made.
// Never reads or writes real users' data.
import { readFileSync, existsSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export function loadEnv(): Record<string, string> {
  const p = new URL("../../../.env", import.meta.url);
  const env: Record<string, string> = {};
  if (!existsSync(p)) return env;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function app() {
  if (getApps().length) return getApps()[0];
  const env = loadEnv();
  const b64 = env.FIREBASE_SERVICE_ACCOUNT_B64 ?? process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 missing (needed for E2E cleanup)");
  const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return initializeApp({ credential: cert(sa), projectId: sa.project_id, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET });
}
const db = () => getFirestore(app());
const auth = () => getAuth(app());

export const TEST_EMAIL_DOMAIN = "champstep.mn";
export function testEmail(tag: string) {
  return `qa+${Date.now()}-${tag}@${TEST_EMAIL_DOMAIN}`;
}
function assertTestEmail(email: string) {
  if (!/^qa\+\d+-[a-z0-9-]+@champstep\.mn$/.test(email)) throw new Error(`refusing to touch non-test account: ${email}`);
}

export async function uidByEmail(email: string): Promise<string> {
  assertTestEmail(email);
  return (await auth().getUserByEmail(email)).uid;
}

/** Subscription fields are server-only in rules; set them for a TEST uid so PDF / multi-child flows are reachable. */
export async function setTier(email: string, tier: "free" | "family" | "master" | "coach") {
  const uid = await uidByEmail(email);
  await db().collection("users").doc(uid).set({ subscriptionTier: tier }, { merge: true });
}

export async function createInviteCodeFor(email: string, teacherName = "QA Teacher"): Promise<string> {
  const uid = await uidByEmail(email);
  const code = "QA" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 864e5).toISOString();
  await db().collection("inviteCodes").doc(code).set({ code, teacherId: uid, teacherName, used: false, expiresAt, createdAt: new Date().toISOString() });
  return code;
}

async function deleteQuery(q: FirebaseFirestore.Query) {
  const snap = await q.get();
  if (snap.empty) return 0;
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

/** Remove everything the test account created, then the account itself. */
export async function cleanupTestUser(email: string) {
  assertTestEmail(email);
  let uid: string;
  try { uid = await uidByEmail(email); } catch { return; }
  const kids = await db().collection("children").where("parentId", "==", uid).get();
  for (const k of kids.docs) {
    for (const col of ["achievements", "practiceLogs", "reflections", "coachNotes"]) {
      await deleteQuery(db().collection(col).where("childId", "==", k.id));
    }
    for (const prefix of [`achievements/${k.id}/`, `avatars/${k.id}/`]) {
      try { await getStorage(app()).bucket().deleteFiles({ prefix }); } catch { /* bucket may be empty */ }
    }
    await k.ref.delete();
  }
  // teacher-side data
  await deleteQuery(db().collection("inviteCodes").where("teacherId", "==", uid));
  await deleteQuery(db().collection("coachNotes").where("teacherId", "==", uid));
  const taught = await db().collection("children").where("teacherIds", "array-contains", uid).get();
  for (const c of taught.docs) {
    const ids = (c.data().teacherIds as string[]).filter((t) => t !== uid);
    await c.ref.update({ teacherIds: ids });
  }
  await deleteQuery(db().collection("payments").where("uid", "==", uid));
  await db().collection("users").doc(uid).delete().catch(() => {});
  await auth().deleteUser(uid).catch(() => {});
}

/** Safety net (globalTeardown): remove every qa+<ts>-*@champstep.mn account, e.g. after an aborted run. */
export async function cleanupAllTestUsers(): Promise<number> {
  const res = await auth().listUsers(1000);
  const qa = res.users.map((u) => u.email ?? "").filter((e) => /^qa\+\d+-[a-z0-9-]+@champstep\.mn$/.test(e));
  for (const e of qa) await cleanupTestUser(e);
  return qa.length;
}

/** Debug/assert helper: number of docs in `col` whose childId belongs to this test user's children. */
export async function countChildDocs(email: string, col: string): Promise<number> {
  const uid = await uidByEmail(email);
  const kids = await db().collection("children").where("parentId", "==", uid).get();
  let n = 0;
  for (const k of kids.docs) n += (await db().collection(col).where("childId", "==", k.id).get()).size;
  return n;
}
