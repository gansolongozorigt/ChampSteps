// Firestore rules — goals/{id}, practiceLogs.goalId, achievements.prep. `npm run test:rules`.
import { test, before, after, beforeEach } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { createEnv, seed, asUser, asAnon, PARENT, TEACHER, OTHER, CHILD, STRANGER_CHILD } from "./helpers.mjs";

let env;
before(async () => { env = await createEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(env); });

const goal = (over = {}) => ({ childId: CHILD, parentId: PARENT, title: "Regional", date: "2026-04-10", category: "Arts", status: "active", ...over });

test("goals: anon denied", async () => {
  await assertFails(getDoc(doc(asAnon(env), "goals", "goal1")));
  await assertFails(setDoc(doc(asAnon(env), "goals", "g_anon"), goal()));
});

test("goals: parent reads/lists own child's goals; stranger denied", async () => {
  await assertSucceeds(getDoc(doc(asUser(env, PARENT), "goals", "goal1")));
  await assertSucceeds(getDocs(query(collection(asUser(env, PARENT), "goals"), where("childId", "==", CHILD))));
  await assertFails(getDoc(doc(asUser(env, OTHER), "goals", "goal1")));
  await assertFails(getDocs(query(collection(asUser(env, OTHER), "goals"), where("childId", "==", CHILD))));
  await assertFails(getDocs(collection(asUser(env, PARENT), "goals"))); // unscoped list touches goal_other
});

test("goals: parent creates for own child with valid fields; optional targets allowed", async () => {
  await assertSucceeds(setDoc(doc(asUser(env, PARENT), "goals", "g1"), goal()));
  await assertSucceeds(setDoc(doc(asUser(env, PARENT), "goals", "g2"), goal({ targetSessionsPerWeek: 4, targetMinutes: 30, linkedAchievementId: "ach1" })));
});

test("goals: create denied for someone else's child, wrong parentId, or invalid fields", async () => {
  const db = asUser(env, PARENT);
  await assertFails(setDoc(doc(db, "goals", "g_bad1"), goal({ childId: STRANGER_CHILD })));
  await assertFails(setDoc(doc(db, "goals", "g_bad2"), goal({ parentId: OTHER })));
  await assertFails(setDoc(doc(db, "goals", "g_bad3"), goal({ title: "" })));
  await assertFails(setDoc(doc(db, "goals", "g_bad4"), goal({ date: "2026-4-1" })));
  await assertFails(setDoc(doc(db, "goals", "g_bad5"), goal({ status: "paused" })));
  await assertFails(setDoc(doc(db, "goals", "g_bad6"), goal({ category: "Music" })));
  await assertFails(setDoc(doc(db, "goals", "g_bad7"), goal({ targetSessionsPerWeek: "4" })));
  await assertFails(setDoc(doc(db, "goals", "g_bad8"), goal({ linkedAchievementId: 5 })));
  await assertFails(setDoc(doc(asUser(env, OTHER), "goals", "g_bad9"), goal({ parentId: OTHER }))); // not the child's parent
});

test("goals: parent updates (status done, linked achievement, date), cannot move it to another child/parent; delete ok", async () => {
  const ref = doc(asUser(env, PARENT), "goals", "goal1");
  await assertSucceeds(updateDoc(ref, { status: "done", linkedAchievementId: "ach1" }));
  await assertSucceeds(updateDoc(ref, { date: "2026-05-01", status: "active" }));
  await assertFails(updateDoc(ref, { childId: STRANGER_CHILD }));
  await assertFails(updateDoc(ref, { parentId: OTHER }));
  await assertFails(updateDoc(ref, { status: "unknown" }));
  await assertSucceeds(deleteDoc(ref));
});

test("goals: teacher reads own student's goals only, never writes", async () => {
  const db = asUser(env, TEACHER);
  await assertSucceeds(getDoc(doc(db, "goals", "goal1")));
  await assertSucceeds(getDocs(query(collection(db, "goals"), where("childId", "==", CHILD))));
  await assertFails(getDoc(doc(db, "goals", "goal_other")));
  await assertFails(setDoc(doc(db, "goals", "g_t"), goal({ parentId: TEACHER })));
  await assertFails(updateDoc(doc(db, "goals", "goal1"), { status: "done" }));
  await assertFails(deleteDoc(doc(db, "goals", "goal1")));
});

test("practiceLogs: goalId optional string; non-string denied; old shape still fine", async () => {
  const db = asUser(env, PARENT);
  await assertSucceeds(setDoc(doc(db, "practiceLogs", "p_old"), { childId: CHILD, date: "2026-02-01", duration: 30, content: "x" }));
  await assertSucceeds(setDoc(doc(db, "practiceLogs", "p_goal"), { childId: CHILD, date: "2026-02-01", duration: 30, content: "x", goalId: "goal1" }));
  await assertFails(setDoc(doc(db, "practiceLogs", "p_bad"), { childId: CHILD, date: "2026-02-01", duration: 30, content: "x", goalId: 7 }));
  await assertSucceeds(updateDoc(doc(db, "practiceLogs", "log1"), { goalId: "goal1" }));
  await assertFails(updateDoc(doc(db, "practiceLogs", "log1"), { goalId: { id: "goal1" } }));
});

test("achievements: prep optional map with numeric stats; malformed prep denied", async () => {
  const db = asUser(env, PARENT);
  const base = { childId: CHILD, title: "Cup", date: "2026-04-10", location: "UB", category: "Arts", description: "d", awardType: "Gold", imageURLs: [] };
  await assertSucceeds(setDoc(doc(db, "achievements", "a_plain"), base));
  await assertSucceeds(setDoc(doc(db, "achievements", "a_prep"), { ...base, prep: { goalId: "goal1", days: 43, sessions: 50, minutes: 1860, daysTotal: 61 } }));
  await assertFails(setDoc(doc(db, "achievements", "a_bad1"), { ...base, prep: { goalId: "goal1", days: "43", sessions: 50, minutes: 1860, daysTotal: 61 } }));
  await assertFails(setDoc(doc(db, "achievements", "a_bad2"), { ...base, prep: { days: 43 } }));
  await assertFails(setDoc(doc(db, "achievements", "a_bad3"), { ...base, prep: "43 days" }));
  await assertSucceeds(updateDoc(doc(db, "achievements", "ach1"), { prep: { goalId: "goal1", days: 1, sessions: 1, minutes: 30, daysTotal: 2 } }));
  await assertFails(updateDoc(doc(db, "achievements", "ach1"), { prep: { goalId: "goal1", days: 1 } }));
});
