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
    await db().collection("aiInsights").doc(k.id).delete().catch(() => {});
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
  await db().collection("aiUsage").doc(uid).delete().catch(() => {});
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

/** Server-only subscription fields for a TEST uid (expiresAt null = legacy/no expiry). */
export async function setSubscription(email: string, tier: "free" | "family" | "master" | "coach", expiresAt: Date | null) {
  const uid = await uidByEmail(email);
  const { Timestamp, FieldValue } = await import("firebase-admin/firestore");
  await db().collection("users").doc(uid).set({
    subscriptionTier: tier,
    subscriptionExpiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : FieldValue.delete(),
    expiredFrom: FieldValue.delete(),
    expiredAt: FieldValue.delete(),
  }, { merge: true });
}

/** The children docs of a TEST parent, oldest first (the sign-up default child comes first). */
export async function childrenOf(email: string): Promise<Array<{ id: string; name: string }>> {
  const uid = await uidByEmail(email);
  const snap = await db().collection("children").where("parentId", "==", uid).get();
  return snap.docs
    .map((d) => ({ id: d.id, name: String(d.data().name ?? ""), createdAt: d.data().createdAt?.toMillis?.() ?? 0 }))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ id, name }) => ({ id, name }));
}

/** Add a child to a TEST parent directly (same shape as lib/firebase.createChild). */
export async function createChildFor(email: string, name: string, birthDate = "2016-05-05"): Promise<string> {
  const uid = await uidByEmail(email);
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = db().collection("children").doc();
  await ref.set({ childId: ref.id, parentId: uid, name, birthDate, bio: "", avatarUrl: null, teacherIds: [], createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

/** Seed an achievement for a TEST child (childId must belong to a qa account — callers pass ids from childrenOf/createChildFor). */
export async function seedAchievement(childId: string, a: { title: string; date: string; category: "Sports" | "Arts" | "Academic"; awardType: "Gold" | "Silver" | "Bronze" | "Participant"; location?: string }) {
  const child = await db().collection("children").doc(childId).get();
  const owner = await auth().getUser(String(child.data()?.parentId));
  assertTestEmail(owner.email ?? "");
  const { FieldValue } = await import("firebase-admin/firestore");
  await db().collection("achievements").add({ childId, title: a.title, date: a.date, location: a.location ?? "QA", category: a.category, description: "seeded by e2e", awardType: a.awardType, imageURLs: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}

/** Create a TEST account without the UI (Auth user + users/{uid} doc). */
export async function createAccount(email: string, password: string, role: "parent" | "teacher", tier: "free" | "family" | "master" | "coach" = "free") {
  assertTestEmail(email);
  const u = await auth().createUser({ email, password, displayName: "QA " + role });
  await db().collection("users").doc(u.uid).set({ uid: u.uid, email, displayName: "QA " + role, role, subscriptionTier: tier, createdAt: new Date().toISOString() });
  return u.uid;
}

/** Firebase ID token for a TEST account (custom token → Identity Toolkit REST). */
export async function idTokenFor(email: string): Promise<string> {
  const uid = await uidByEmail(email);
  const custom = await auth().createCustomToken(uid);
  const apiKey = loadEnv().VITE_FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("VITE_FIREBASE_API_KEY missing");
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  if (!r.ok) throw new Error(`signInWithCustomToken failed: ${r.status} ${await r.text()}`);
  return ((await r.json()) as { idToken: string }).idToken;
}

/** Read the server-written AI cache for a TEST child (null if absent). */
export async function aiInsightDoc(childId: string): Promise<Record<string, unknown> | null> {
  const s = await db().collection("aiInsights").doc(childId).get();
  return s.exists ? (s.data() as Record<string, unknown>) : null;
}
