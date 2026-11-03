// Firestore rules — optional text fields of 2026-11 (pages: Goals / Practice / Feelings). `npm run test:rules`.
//   goals.targetResult (<= 80), achievements.prep.targetResult (<= 80),
//   practiceLogs.wentWell / toImprove / learned (<= 300 each), reflections.focus (<= 300, parent only).
import { test, before, after, beforeEach } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { createEnv, seed, asUser, PARENT, TEACHER, OTHER, CHILD } from "./helpers.mjs";

let env;
before(async () => { env = await createEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(env); });

const s = (n) => "я".repeat(n);
const goal = (over = {}) => ({ childId: CHILD, parentId: PARENT, title: "Regional", date: "2026-04-10", category: "Arts", status: "active", ...over });
const log = (over = {}) => ({ childId: CHILD, date: "2026-02-01", duration: 30, content: "", ...over });
const refl = (over = {}) => ({ childId: CHILD, date: "2026-02-01", mood: 4, content: "", ...over });

test("goals.targetResult: optional string up to 80; longer or non-string denied; edit and clear ok", async () => {
  const db = asUser(env, PARENT);
  await assertSucceeds(setDoc(doc(db, "goals", "g_t1"), goal({ targetResult: "Алт медаль" })));
  await assertSucceeds(setDoc(doc(db, "goals", "g_t2"), goal({ targetResult: s(80) })));
  await assertSucceeds(setDoc(doc(db, "goals", "g_t3"), goal())); // old shape
  await assertFails(setDoc(doc(db, "goals", "g_t4"), goal({ targetResult: s(81) })));
  await assertFails(setDoc(doc(db, "goals", "g_t5"), goal({ targetResult: 3 })));
  await assertFails(setDoc(doc(db, "goals", "g_t6"), goal({ targetResult: ["gold"] })));
  const ref = doc(db, "goals", "goal1");
  await assertSucceeds(updateDoc(ref, { targetResult: "Шилдэг 3" }));
  await assertFails(updateDoc(ref, { targetResult: s(81) }));
  await assertFails(updateDoc(ref, { targetResult: null }));
});

test("goals.targetResult: teacher still reads, cannot write it", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), "goals", "goal1"), { targetResult: "Медаль" }); });
  const db = asUser(env, TEACHER);
  const snap = await assertSucceeds(getDoc(doc(db, "goals", "goal1")));
  if (snap.data().targetResult !== "Медаль") throw new Error("teacher should see targetResult");
  await assertFails(updateDoc(doc(db, "goals", "goal1"), { targetResult: "x" }));
});

test("achievements.prep.targetResult: optional string up to 80", async () => {
  const db = asUser(env, PARENT);
  const base = { childId: CHILD, title: "Cup", date: "2026-04-10", location: "UB", category: "Arts", description: "d", awardType: "Gold", imageURLs: [] };
  const prep = { goalId: "goal1", days: 4, sessions: 5, minutes: 120, daysTotal: 10 };
  await assertSucceeds(setDoc(doc(db, "achievements", "a_t1"), { ...base, prep: { ...prep, targetResult: "Алт медаль" } }));
  await assertFails(setDoc(doc(db, "achievements", "a_t2"), { ...base, prep: { ...prep, targetResult: s(81) } }));
  await assertFails(setDoc(doc(db, "achievements", "a_t3"), { ...base, prep: { ...prep, targetResult: 1 } }));
});

test("practiceLogs: wentWell / toImprove / learned optional strings up to 300; old shape fine", async () => {
  const db = asUser(env, PARENT);
  await assertSucceeds(setDoc(doc(db, "practiceLogs", "p1"), log({ wentWell: "Эргэлт", toImprove: "Хэмнэл", learned: "Шинэ алхам", goalId: "goal1" })));
  await assertSucceeds(setDoc(doc(db, "practiceLogs", "p2"), log({ learned: s(300) })));
  await assertSucceeds(setDoc(doc(db, "practiceLogs", "p3"), { childId: CHILD, date: "2026-02-01", duration: 30, content: "old" }));
  for (const k of ["wentWell", "toImprove", "learned"]) {
    await assertFails(setDoc(doc(db, "practiceLogs", `p_long_${k}`), log({ [k]: s(301) })));
    await assertFails(setDoc(doc(db, "practiceLogs", `p_type_${k}`), log({ [k]: 5 })));
  }
  await assertSucceeds(updateDoc(doc(db, "practiceLogs", "log1"), { wentWell: "ok" }));
  await assertFails(updateDoc(doc(db, "practiceLogs", "log1"), { toImprove: s(301) }));
  await assertFails(updateDoc(doc(db, "practiceLogs", "log1"), { learned: { text: "x" } }));
});

test("practiceLogs: teacher reads the new answers, never writes; stranger denied", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), "practiceLogs", "log1"), { wentWell: "Сайн" }); });
  const t = asUser(env, TEACHER);
  await assertSucceeds(getDocs(query(collection(t, "practiceLogs"), where("childId", "==", CHILD))));
  await assertFails(setDoc(doc(t, "practiceLogs", "p_t"), log({ wentWell: "x" })));
  await assertFails(updateDoc(doc(t, "practiceLogs", "log1"), { wentWell: "x" }));
  await assertFails(setDoc(doc(asUser(env, OTHER), "practiceLogs", "p_o"), log({ wentWell: "x" })));
});

test("reflections.focus: optional string up to 300; focus alone is enough; empty everything denied", async () => {
  const db = asUser(env, PARENT);
  await assertSucceeds(setDoc(doc(db, "reflections", "r1"), refl({ content: "Баяртай", focus: "Амьсгалаа тайвшруулах" })));
  await assertSucceeds(setDoc(doc(db, "reflections", "r2"), refl({ focus: s(300) })));
  await assertSucceeds(setDoc(doc(db, "reflections", "r3"), refl({ content: "old shape" })));
  await assertFails(setDoc(doc(db, "reflections", "r4"), refl({ focus: s(301) })));
  await assertFails(setDoc(doc(db, "reflections", "r5"), refl({ content: "x", focus: 7 })));
  await assertFails(setDoc(doc(db, "reflections", "r6"), refl({ focus: "" })));
  await assertSucceeds(updateDoc(doc(db, "reflections", "ref1"), { focus: "Тайван" }));
  await assertFails(updateDoc(doc(db, "reflections", "ref1"), { focus: s(301) }));
});

test("reflections.focus: teacher and stranger can never read or write reflections", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), "reflections", "ref1"), { focus: "secret focus" }); });
  for (const uid of [TEACHER, OTHER]) {
    const db = asUser(env, uid);
    await assertFails(getDoc(doc(db, "reflections", "ref1")));
    await assertFails(getDocs(query(collection(db, "reflections"), where("childId", "==", CHILD))));
    await assertFails(setDoc(doc(db, "reflections", `r_${uid}`), refl({ focus: "x" })));
    await assertFails(updateDoc(doc(db, "reflections", "ref1"), { focus: "x" }));
  }
});
