// Legacy users doc shape found in prod (2026-10-07): no `role`, no `uid`, has
// `userId`, server-written subscription fields. Rules never read users.role /
// users.uid for child data — ownership is children.parentId — so such a parent
// must keep full access. Also documents that an empty childId query is denied
// (hooks must not issue it). Run via `npm run test:rules`.
import { test, before, after, beforeEach } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { createEnv, seed, asUser, TEACHER, OTHER } from "./helpers.mjs";

const L = "legacy_prod_user_001";
const LC = "child_legacy_prod_1";
let env;
before(async () => { env = await createEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", L), {
      userId: L, email: "l@example.com", displayName: "L",
      subscriptionTier: "master", subscriptionStatus: "active", subscription: { plan: "master" },
      subscriptionActivatedAt: "2026-01-01", subscriptionExpiresAt: "2027-01-01",
      createdAt: "2026-01-01", updatedAt: "2026-01-01",
    });
    await setDoc(doc(db, "children", LC), { childId: LC, parentId: L, teacherIds: [TEACHER], name: "Kid" });
    await setDoc(doc(db, "achievements", "ach_lp"), { childId: LC, title: "Gold", date: "2026-01-01", imageURLs: [] });
    await setDoc(doc(db, "reflections", "ref_lp"), { childId: LC, date: "2026-01-01", mood: 3, content: "secret" });
    await uploadBytes(ref(ctx.storage(), `achievements/${LC}/seed.png`), new Uint8Array([1, 2, 3]), { contentType: "image/png" });
  });
});
const st = (uid) => env.authenticatedContext(uid).storage();
const png = () => new Uint8Array(3);

test("legacy user (no role/uid): reads own users doc; cannot add role/uid/tier from client", async () => {
  const db = asUser(env, L);
  await assertSucceeds(getDoc(doc(db, "users", L)));
  await assertSucceeds(updateDoc(doc(db, "users", L), { displayName: "New" }));
  await assertFails(updateDoc(doc(db, "users", L), { role: "parent" }));
  await assertFails(updateDoc(doc(db, "users", L), { uid: L }));
  await assertFails(updateDoc(doc(db, "users", L), { subscriptionTier: "free" }));
  await assertFails(getDoc(doc(asUser(env, OTHER), "users", L)));
});

test("legacy user (no role/uid): full parent access to own child data", async () => {
  const db = asUser(env, L);
  await assertSucceeds(getDocs(query(collection(db, "children"), where("parentId", "==", L))));
  await assertSucceeds(getDoc(doc(db, "children", LC)));
  await assertSucceeds(updateDoc(doc(db, "children", LC), { bio: "x" }));
  await assertSucceeds(getDocs(query(collection(db, "achievements"), where("childId", "==", LC))));
  await assertSucceeds(getDoc(doc(db, "achievements", "ach_lp")));
  await assertSucceeds(addDoc(collection(db, "achievements"), { childId: LC, title: "n", date: "2026-02-02" }));
  await assertSucceeds(updateDoc(doc(db, "achievements", "ach_lp"), { title: "edited" }));
  await assertSucceeds(deleteDoc(doc(db, "achievements", "ach_lp")));
  await assertSucceeds(addDoc(collection(db, "practiceLogs"), { childId: LC, date: "2026-02-02", duration: 5, content: "c" }));
  await assertSucceeds(getDocs(query(collection(db, "reflections"), where("childId", "==", LC))));
  await assertSucceeds(getDoc(doc(db, "reflections", "ref_lp")));
  // teacher on this child: reads achievements, not reflections; stranger nothing
  await assertSucceeds(getDocs(query(collection(asUser(env, TEACHER), "achievements"), where("childId", "==", LC))));
  await assertFails(getDoc(doc(asUser(env, TEACHER), "reflections", "ref_lp")));
  await assertFails(getDocs(query(collection(asUser(env, OTHER), "achievements"), where("childId", "==", LC))));
});

test("legacy user (no role/uid): storage read/upload/delete on own child folders", async () => {
  await assertSucceeds(getBytes(ref(st(L), `achievements/${LC}/seed.png`)));
  await assertSucceeds(uploadBytes(ref(st(L), `achievements/${LC}/new.png`), png(), { contentType: "image/png" }));
  await assertSucceeds(uploadBytes(ref(st(L), `avatars/${LC}/a.jpg`), png(), { contentType: "image/jpeg" }));
  await assertSucceeds(deleteObject(ref(st(L), `achievements/${LC}/seed.png`)));
  await assertSucceeds(getBytes(ref(st(TEACHER), `achievements/${LC}/new.png`)));
  await assertFails(uploadBytes(ref(st(TEACHER), `achievements/${LC}/t.png`), png(), { contentType: "image/png" }));
  await assertFails(getBytes(ref(st(OTHER), `achievements/${LC}/new.png`)));
});

test("empty / unknown childId queries are denied (hooks must guard before querying)", async () => {
  const db = asUser(env, L);
  await assertFails(getDocs(query(collection(db, "achievements"), where("childId", "==", ""))));
  await assertFails(getDocs(query(collection(db, "practiceLogs"), where("childId", "==", ""))));
  await assertFails(getDocs(query(collection(db, "reflections"), where("childId", "==", ""))));
  await assertFails(getDocs(query(collection(db, "achievements"), where("childId", "==", "no_such_child"))));
});
