// Shared setup for Firestore/Storage rules tests (Firebase emulator).
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

export const PROJECT_ID = "champstep-rules-test";
export const PARENT = "parent_uid_001";
export const TEACHER = "teacher_uid_001";
export const OTHER = "other_uid_001";
export const CHILD = "child_parent_1";
export const STRANGER_CHILD = "child_other_1";

export async function createEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
}

/** Seed baseline docs bypassing rules. */
export async function seed(env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", PARENT), { uid: PARENT, role: "parent", subscriptionTier: "free", displayName: "P" });
    await setDoc(doc(db, "users", TEACHER), { uid: TEACHER, role: "teacher", subscriptionTier: "free", displayName: "T" });
    await setDoc(doc(db, "users", OTHER), { uid: OTHER, role: "parent", subscriptionTier: "free", displayName: "O" });
    await setDoc(doc(db, "children", CHILD), { childId: CHILD, parentId: PARENT, teacherIds: [TEACHER], name: "Kid" });
    await setDoc(doc(db, "children", STRANGER_CHILD), { childId: STRANGER_CHILD, parentId: OTHER, teacherIds: [], name: "Other kid" });
    await setDoc(doc(db, "achievements", "ach1"), { childId: CHILD, title: "Gold", date: "2026-01-01" });
    await setDoc(doc(db, "practiceLogs", "log1"), { childId: CHILD, date: "2026-01-01", duration: 30, content: "x" });
    await setDoc(doc(db, "reflections", "ref1"), { childId: CHILD, date: "2026-01-01", mood: 4, content: "secret" });
    await setDoc(doc(db, "coachNotes", "note1"), { childId: CHILD, teacherId: TEACHER, teacherName: "T", content: "note" });
    await setDoc(doc(db, "inviteCodes", "ABC123"), { code: "ABC123", teacherId: TEACHER, teacherName: "T", used: false, expiresAt: "2099-01-01", createdAt: "2026-01-01" });
    await setDoc(doc(db, "promoCodes", "CHAMP3"), { code: "CHAMP3", discountMonths: 3, usedBy: [], maxUses: 10, active: true });
    await setDoc(doc(db, "payments", "CS-1-parent"), { uid: PARENT, plan: "family", amount: 9900, status: "pending", provider: "qpay" });
  });
}

export const asUser = (env, uid) => env.authenticatedContext(uid).firestore();
export const asAnon = (env) => env.unauthenticatedContext().firestore();
