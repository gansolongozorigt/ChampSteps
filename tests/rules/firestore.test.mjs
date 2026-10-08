// Firestore security rules — run via `npm run test:rules` (emulator required).
import { test, before, after, beforeEach } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from "firebase/firestore";
import {
  createEnv, seed, asUser, asAnon, PARENT, TEACHER, OTHER, CHILD, STRANGER_CHILD, LEGACY_CHILD, LEGACY_USER,
} from "./helpers.mjs";

let env;
before(async () => { env = await createEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(env); });

// ---- unauthenticated ------------------------------------------------------
test("anon: cannot read anything", async () => {
  const db = asAnon(env);
  await assertFails(getDoc(doc(db, "users", PARENT)));
  await assertFails(getDoc(doc(db, "children", CHILD)));
  await assertFails(getDocs(query(collection(db, "achievements"), where("childId", "==", CHILD))));
  await assertFails(getDoc(doc(db, "inviteCodes", "ABC123")));
});

// ---- users ----------------------------------------------------------------
test("users: owner reads own doc, others cannot", async () => {
  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "users", PARENT)));
  await assertFails(getDoc(doc(asUser(env, OTHER), "users", PARENT)));
  await assertFails(getDocs(collection(asUser(env, PARENT), "users")));
});

test("users: owner can update profile fields", async () => {
  await assertSucceeds(updateDoc(doc(asUser(env, PARENT), "users", PARENT), { displayName: "New", phone: "9911" }));
});

test("users: client cannot change subscription fields (update)", async () => {
  const ref = doc(asUser(env, PARENT), "users", PARENT);
  await assertFails(updateDoc(ref, { subscriptionTier: "coach" }));
  await assertFails(updateDoc(ref, { subscriptionExpiresAt: new Date() }));
  await assertFails(updateDoc(ref, { subscriptionActivatedAt: new Date() }));
  await assertFails(updateDoc(ref, { subscription: { plan: "master" } }));
  await assertFails(updateDoc(ref, { displayName: "x", subscriptionTier: "family" }));
  await assertFails(updateDoc(ref, { role: "teacher" }));
});

test("users: create only as self, tier free or absent", async () => {
  await assertSucceeds(setDoc(doc(asUser(env, "newuid"), "users", "newuid"), { uid: "newuid", role: "parent", subscriptionTier: "free", email: "a@b.c" }));
  await assertSucceeds(setDoc(doc(asUser(env, "newuid2"), "users", "newuid2"), { uid: "newuid2", role: "teacher" }));
  await assertFails(setDoc(doc(asUser(env, "newuid3"), "users", "newuid3"), { uid: "newuid3", role: "parent", subscriptionTier: "master" }));
  await assertFails(setDoc(doc(asUser(env, "newuid4"), "users", "newuid4"), { uid: "newuid4", role: "parent", subscription: { plan: "family" } }));
  await assertFails(setDoc(doc(asUser(env, "newuid5"), "users", "someoneelse"), { uid: "someoneelse", role: "parent" }));
  await assertFails(setDoc(doc(asUser(env, "newuid6"), "users", "newuid6"), { uid: "newuid6", role: "admin" }));
});

// ---- payments -------------------------------------------------------------
test("payments: owner reads, nobody writes", async () => {
  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "payments", "CS-1-parent")));
  await assertSucceeds(getDocs(query(collection(asUser(env, PARENT), "payments"), where("uid", "==", PARENT))));
  await assertFails(getDoc(doc(asUser(env, OTHER), "payments", "CS-1-parent")));
  await assertFails(updateDoc(doc(asUser(env, PARENT), "payments", "CS-1-parent"), { status: "paid" }));
  await assertFails(setDoc(doc(asUser(env, PARENT), "payments", "CS-2"), { uid: PARENT, status: "paid" }));
  await assertFails(deleteDoc(doc(asUser(env, PARENT), "payments", "CS-1-parent")));
});

// ---- children -------------------------------------------------------------
test("children: parent reads/lists own; teacher reads via teacherIds; stranger denied", async () => {
  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "children", CHILD)));
  await assertSucceeds(getDocs(query(collection(asUser(env, PARENT), "children"), where("parentId", "==", PARENT))));
  await assertSucceeds(getDoc(doc(asUser(env, TEACHER), "children", CHILD)));
  await assertSucceeds(getDocs(query(collection(asUser(env, TEACHER), "children"), where("teacherIds", "array-contains", TEACHER))));
  await assertFails(getDoc(doc(asUser(env, OTHER), "children", CHILD)));
  await assertFails(getDocs(collection(asUser(env, OTHER), "children")));
});

test("children: parent creates own child; cannot create for someone else or with teachers", async () => {
  await assertSucceeds(setDoc(doc(asUser(env, PARENT), "children", "c_new"), { childId: "c_new", parentId: PARENT, teacherIds: [], name: "N" }));
  await assertFails(setDoc(doc(asUser(env, PARENT), "children", "c_bad"), { childId: "c_bad", parentId: OTHER, teacherIds: [], name: "N" }));
  await assertFails(setDoc(doc(asUser(env, PARENT), "children", "c_bad2"), { childId: "c_bad2", parentId: PARENT, teacherIds: [TEACHER], name: "N" }));
});

test("children: parent updates profile & teacherIds; teacher and stranger cannot write", async () => {
  await assertSucceeds(updateDoc(doc(asUser(env, PARENT), "children", CHILD), { name: "Renamed", teacherIds: [TEACHER, "t2"] }));
  await assertFails(updateDoc(doc(asUser(env, PARENT), "children", CHILD), { parentId: OTHER }));
  await assertFails(updateDoc(doc(asUser(env, TEACHER), "children", CHILD), { name: "Hacked" }));
  await assertFails(updateDoc(doc(asUser(env, OTHER), "children", CHILD), { name: "Hacked" }));
  await assertFails(deleteDoc(doc(asUser(env, TEACHER), "children", CHILD)));
});

// ---- achievements / practiceLogs -----------------------------------------
for (const col of ["achievements", "practiceLogs"]) {
  test(`${col}: parent full access; teacher read-only; stranger denied`, async () => {
    const existing = col === "achievements" ? "ach1" : "log1";
    await assertSucceeds(getDocs(query(collection(asUser(env, PARENT), col), where("childId", "==", CHILD))));
    await assertSucceeds(setDoc(doc(asUser(env, PARENT), col, "p_new"), { childId: CHILD, title: "x", date: "2026-02-02", duration: 1, content: "c" }));
    await assertSucceeds(updateDoc(doc(asUser(env, PARENT), col, existing), { content: "edited", title: "edited" }));
    await assertFails(updateDoc(doc(asUser(env, PARENT), col, existing), { childId: STRANGER_CHILD }));
    await assertSucceeds(deleteDoc(doc(asUser(env, PARENT), col, existing)));

    await assertSucceeds(getDocs(query(collection(asUser(env, TEACHER), col), where("childId", "==", CHILD))));
    await assertFails(setDoc(doc(asUser(env, TEACHER), col, "t_new"), { childId: CHILD, title: "x", date: "2026-02-02", duration: 1, content: "c" }));
    await assertFails(updateDoc(doc(asUser(env, TEACHER), col, "p_new"), { title: "t" }));
    await assertFails(deleteDoc(doc(asUser(env, TEACHER), col, "p_new")));

    await assertFails(getDocs(query(collection(asUser(env, OTHER), col), where("childId", "==", CHILD))));
    await assertFails(setDoc(doc(asUser(env, OTHER), col, "o_new"), { childId: CHILD, title: "x" }));
    // stranger cannot create for a child they don't own
    await assertFails(setDoc(doc(asUser(env, PARENT), col, "x_new"), { childId: STRANGER_CHILD, title: "x" }));
  });
}

// ---- reflections ----------------------------------------------------------
test("reflections: parent only; teacher gets nothing", async () => {
  await assertSucceeds(getDocs(query(collection(asUser(env, PARENT), "reflections"), where("childId", "==", CHILD))));
  await assertSucceeds(setDoc(doc(asUser(env, PARENT), "reflections", "r_new"), { childId: CHILD, date: "2026-02-02", mood: 3, content: "c" }));
  await assertSucceeds(deleteDoc(doc(asUser(env, PARENT), "reflections", "ref1")));

  await assertFails(getDoc(doc(asUser(env, TEACHER), "reflections", "r_new")));
  await assertFails(getDocs(query(collection(asUser(env, TEACHER), "reflections"), where("childId", "==", CHILD))));
  await assertFails(setDoc(doc(asUser(env, TEACHER), "reflections", "t_ref"), { childId: CHILD, mood: 1, content: "x" }));
  await assertFails(deleteDoc(doc(asUser(env, TEACHER), "reflections", "r_new")));
  await assertFails(getDocs(query(collection(asUser(env, OTHER), "reflections"), where("childId", "==", CHILD))));
});

test("reflections: child-only, parent-only or both notes save; both empty denied; teacher denied", async () => {
  const db = asUser(env, PARENT);
  const base = { childId: CHILD, date: "2026-03-03", mood: 3 };
  await assertSucceeds(setDoc(doc(db, "reflections", "r_child_only"), { ...base, content: "child wrote" }));
  await assertSucceeds(setDoc(doc(db, "reflections", "r_parent_only"), { ...base, content: "", parentNote: "parent wrote" }));
  await assertSucceeds(setDoc(doc(db, "reflections", "r_parent_only_nokey"), { ...base, parentNote: "parent wrote" }));
  await assertSucceeds(setDoc(doc(db, "reflections", "r_both"), { ...base, content: "child", parentNote: "parent" }));
  await assertFails(setDoc(doc(db, "reflections", "r_empty"), { ...base, content: "", parentNote: "" }));
  await assertFails(setDoc(doc(db, "reflections", "r_empty2"), { ...base, content: "" }));
  await assertFails(setDoc(doc(db, "reflections", "r_nokeys"), base));
  await assertFails(setDoc(doc(db, "reflections", "r_badtype"), { ...base, content: 123 }));
  await assertFails(setDoc(doc(db, "reflections", "r_badtype2"), { ...base, content: "ok", parentNote: ["x"] }));
  // update: clearing one note is fine, clearing both is not
  await assertSucceeds(updateDoc(doc(db, "reflections", "r_both"), { parentNote: "" }));
  await assertSucceeds(updateDoc(doc(db, "reflections", "r_both"), { content: "", parentNote: "only parent now" }));
  await assertFails(updateDoc(doc(db, "reflections", "r_both"), { content: "", parentNote: "" }));
  // teacher still gets nothing
  await assertFails(setDoc(doc(asUser(env, TEACHER), "reflections", "t_r"), { ...base, content: "x" }));
  await assertFails(getDoc(doc(asUser(env, TEACHER), "reflections", "r_parent_only")));
});

// ---- coachNotes -----------------------------------------------------------
test("coachNotes: teacher creates/deletes own; parent reads & deletes; others denied", async () => {
  await assertSucceeds(setDoc(doc(asUser(env, TEACHER), "coachNotes", "n_new"), { childId: CHILD, teacherId: TEACHER, teacherName: "T", content: "hi" }));
  await assertFails(setDoc(doc(asUser(env, TEACHER), "coachNotes", "n_bad"), { childId: CHILD, teacherId: OTHER, teacherName: "T", content: "hi" }));
  await assertFails(setDoc(doc(asUser(env, TEACHER), "coachNotes", "n_bad2"), { childId: STRANGER_CHILD, teacherId: TEACHER, teacherName: "T", content: "hi" }));
  await assertFails(setDoc(doc(asUser(env, PARENT), "coachNotes", "n_bad3"), { childId: CHILD, teacherId: PARENT, teacherName: "P", content: "hi" }));
  await assertFails(updateDoc(doc(asUser(env, TEACHER), "coachNotes", "note1"), { content: "edit" }));

  await assertSucceeds(getDocs(query(collection(asUser(env, PARENT), "coachNotes"), where("childId", "==", CHILD))));
  await assertSucceeds(getDocs(query(collection(asUser(env, TEACHER), "coachNotes"), where("childId", "==", CHILD))));
  await assertFails(getDocs(query(collection(asUser(env, OTHER), "coachNotes"), where("childId", "==", CHILD))));

  await assertSucceeds(deleteDoc(doc(asUser(env, TEACHER), "coachNotes", "note1")));
  await assertSucceeds(deleteDoc(doc(asUser(env, PARENT), "coachNotes", "n_new")));
});

// ---- inviteCodes ----------------------------------------------------------
test("inviteCodes: teacher creates own; parent looks up and redeems; listing denied", async () => {
  await assertSucceeds(setDoc(doc(asUser(env, TEACHER), "inviteCodes", "NEW111"), { code: "NEW111", teacherId: TEACHER, teacherName: "T", used: false, expiresAt: "2099-01-01", createdAt: "2026-01-01" }));
  await assertFails(setDoc(doc(asUser(env, TEACHER), "inviteCodes", "NEW222"), { code: "NEW222", teacherId: OTHER, teacherName: "T", used: false, expiresAt: "2099-01-01", createdAt: "2026-01-01" }));
  await assertFails(setDoc(doc(asUser(env, TEACHER), "inviteCodes", "NEW333"), { code: "NEW333", teacherId: TEACHER, teacherName: "T", used: true, expiresAt: "2099-01-01", createdAt: "2026-01-01" }));

  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "inviteCodes", "ABC123")));
  await assertFails(getDocs(collection(asUser(env, PARENT), "inviteCodes")));

  // redeem: only used/childId/usedAt, and the child must be the parent's own
  await assertFails(updateDoc(doc(asUser(env, PARENT), "inviteCodes", "ABC123"), { used: true, childId: STRANGER_CHILD, usedAt: "2026-01-02" }));
  await assertFails(updateDoc(doc(asUser(env, PARENT), "inviteCodes", "ABC123"), { used: true, childId: CHILD, usedAt: "2026-01-02", teacherId: PARENT }));
  await assertSucceeds(updateDoc(doc(asUser(env, PARENT), "inviteCodes", "ABC123"), { used: true, childId: CHILD, usedAt: "2026-01-02" }));
  // already used → cannot redeem again
  await assertFails(updateDoc(doc(asUser(env, OTHER), "inviteCodes", "ABC123"), { used: true, childId: STRANGER_CHILD, usedAt: "2026-01-03" }));
});

// ---- aiInsights: server cache; parent + teacher read, nobody writes -------
test("aiInsights: parent and teacher read own child's cache; stranger denied; no client writes; no list", async () => {
  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "aiInsights", CHILD)));
  await assertSucceeds(getDoc(doc(asUser(env, TEACHER), "aiInsights", CHILD)));
  await assertFails(getDoc(doc(asUser(env, OTHER), "aiInsights", CHILD)));
  await assertFails(getDoc(doc(asUser(env, PARENT), "aiInsights", STRANGER_CHILD)));
  await assertFails(getDoc(doc(asAnon(env), "aiInsights", CHILD)));
  // a cache entry for a child that does not exist is unreadable (get() of children/ fails → deny)
  await assertFails(getDoc(doc(asUser(env, PARENT), "aiInsights", "no_such_child")));
  await assertFails(getDocs(collection(asUser(env, PARENT), "aiInsights")));
  await assertFails(getDocs(query(collection(asUser(env, PARENT), "aiInsights"), where("childId", "==", CHILD))));
  await assertFails(updateDoc(doc(asUser(env, PARENT), "aiInsights", CHILD), { text: "forged" }));
  await assertFails(setDoc(doc(asUser(env, PARENT), "aiInsights", "c_new"), { childId: CHILD, text: "forged" }));
  await assertFails(deleteDoc(doc(asUser(env, PARENT), "aiInsights", CHILD)));
  await assertFails(updateDoc(doc(asUser(env, TEACHER), "aiInsights", CHILD), { text: "forged" }));
});

// ---- promoCodes -----------------------------------------------------------
test("promoCodes: no client access", async () => {
  await assertFails(getDoc(doc(asUser(env, PARENT), "promoCodes", "CHAMP3")));
  await assertFails(getDocs(collection(asUser(env, PARENT), "promoCodes")));
  await assertFails(updateDoc(doc(asUser(env, PARENT), "promoCodes", "CHAMP3"), { usedBy: [PARENT] }));
  await assertFails(setDoc(doc(asUser(env, PARENT), "promoCodes", "MINE"), { code: "MINE", discountMonths: 99, usedBy: [], maxUses: 1, active: true }));
});

// ---- unknown collections --------------------------------------------------
test("unknown collection: denied", async () => {
  await assertFails(setDoc(doc(asUser(env, PARENT), "misc", "x"), { a: 1 }));
  await assertFails(getDoc(doc(asUser(env, PARENT), "misc", "x")));
});

// ---- legacy docs: children without teacherIds, users without subscriptionTier
test("children (no teacherIds): parent reads/lists/updates/deletes; teacher & stranger denied", async () => {
  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "children", LEGACY_CHILD)));
  await assertSucceeds(getDocs(query(collection(asUser(env, PARENT), "children"), where("parentId", "==", PARENT))));
  await assertSucceeds(updateDoc(doc(asUser(env, PARENT), "children", LEGACY_CHILD), { name: "Renamed" }));
  // parent may backfill teacherIds, but only as a list
  await assertFails(updateDoc(doc(asUser(env, PARENT), "children", LEGACY_CHILD), { teacherIds: "not-a-list" }));
  await assertSucceeds(updateDoc(doc(asUser(env, PARENT), "children", LEGACY_CHILD), { teacherIds: [] }));

  await assertFails(getDoc(doc(asUser(env, TEACHER), "children", LEGACY_CHILD)));
  await assertFails(getDoc(doc(asUser(env, OTHER), "children", LEGACY_CHILD)));
  await assertFails(updateDoc(doc(asUser(env, TEACHER), "children", LEGACY_CHILD), { teacherIds: [TEACHER] }));
  await assertSucceeds(deleteDoc(doc(asUser(env, PARENT), "children", LEGACY_CHILD)));
});

test("child data (no teacherIds): parent full access; teacher/stranger denied; storage-style get() does not error", async () => {
  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "achievements", "ach_legacy")));
  await assertSucceeds(getDocs(query(collection(asUser(env, PARENT), "achievements"), where("childId", "==", LEGACY_CHILD))));
  await assertSucceeds(setDoc(doc(asUser(env, PARENT), "achievements", "ach_legacy2"), { childId: LEGACY_CHILD, title: "x", date: "2026-02-02" }));
  await assertSucceeds(setDoc(doc(asUser(env, PARENT), "practiceLogs", "log_legacy"), { childId: LEGACY_CHILD, date: "2026-02-02", duration: 5, content: "c" }));
  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "reflections", "ref_legacy")));
  await assertSucceeds(deleteDoc(doc(asUser(env, PARENT), "achievements", "ach_legacy")));

  await assertFails(getDoc(doc(asUser(env, TEACHER), "achievements", "ach_legacy2")));
  await assertFails(getDocs(query(collection(asUser(env, TEACHER), "achievements"), where("childId", "==", LEGACY_CHILD))));
  await assertFails(setDoc(doc(asUser(env, TEACHER), "coachNotes", "n_legacy"), { childId: LEGACY_CHILD, teacherId: TEACHER, teacherName: "T", content: "hi" }));
  await assertFails(getDoc(doc(asUser(env, OTHER), "achievements", "ach_legacy2")));
  await assertFails(getDoc(doc(asUser(env, TEACHER), "reflections", "ref_legacy")));
});

test("users (no subscriptionTier): owner updates profile; adding subscription/role fields denied", async () => {
  const ref = doc(asUser(env, LEGACY_USER), "users", LEGACY_USER);
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, { displayName: "New", phone: "1" }));
  // affectedKeys() must include keys that are ADDED, not only changed
  await assertFails(updateDoc(ref, { subscriptionTier: "free" }));
  await assertFails(updateDoc(ref, { subscriptionTier: "master" }));
  await assertFails(updateDoc(ref, { subscription: { plan: "family" } }));
  await assertFails(updateDoc(ref, { subscriptionExpiresAt: "2030-01-01" }));
  await assertFails(updateDoc(ref, { expiredFrom: "master" }));
  await assertFails(updateDoc(ref, { expiredAt: "2026-01-01" }));
  await assertFails(updateDoc(ref, { displayName: "x", role: "teacher" }));
  await assertFails(updateDoc(ref, { uid: "someone" }));
  // setDoc without merge on an existing doc is an update: dropping role is fine
  // for the client, but it still cannot sneak in a tier
  await assertFails(setDoc(ref, { uid: LEGACY_USER, role: "parent", subscriptionTier: "coach" }));
  await assertSucceeds(setDoc(ref, { uid: LEGACY_USER, role: "parent", displayName: "Z" }));
});
