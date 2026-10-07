// Java-free fallback: runs rules test cases through the Firebase Rules REST API
// (projects.test). Nothing is deployed. Requires a gcloud user token:
//   RULES_TOKEN=$(gcloud auth print-access-token) node tests/rules/api-runner.mjs
// Firestore get() calls inside rules are answered from MOCKS below.
import { readFileSync } from "node:fs";

const PROJECT = process.env.FIREBASE_PROJECT ?? "champstep-22358";
const TOKEN = process.env.RULES_TOKEN;
if (!TOKEN) { console.error("RULES_TOKEN missing"); process.exit(2); }

const PARENT = "parent_uid_001", TEACHER = "teacher_uid_001", OTHER = "other_uid_001";
const CHILD = "child_parent_1", STRANGER_CHILD = "child_other_1", LEGACY_CHILD = "child_legacy_1", LEGACY_USER = "parent_legacy_001";
const D = "/databases/(default)/documents";

const CHILD_DOC = { childId: CHILD, parentId: PARENT, teacherIds: [TEACHER], name: "Kid" };
const STRANGER_DOC = { childId: STRANGER_CHILD, parentId: OTHER, teacherIds: [], name: "Other" };
const LEGACY_DOC = { childId: LEGACY_CHILD, parentId: PARENT, name: "Legacy" }; // no teacherIds
const getMocks = [
  { function: "get", args: [{ exactValue: `${D}/children/${CHILD}` }], result: { value: { data: CHILD_DOC } } },
  { function: "get", args: [{ exactValue: `${D}/children/${STRANGER_CHILD}` }], result: { value: { data: STRANGER_DOC } } },
  { function: "get", args: [{ exactValue: `${D}/children/${LEGACY_CHILD}` }], result: { value: { data: LEGACY_DOC } } },
];
const fsGetMocks = [
  { function: "firestore.get", args: [{ exactValue: `${D}/children/${CHILD}` }], result: { value: { data: CHILD_DOC } } },
  { function: "firestore.get", args: [{ exactValue: `${D}/children/${LEGACY_CHILD}` }], result: { value: { data: LEGACY_DOC } } },
];

const auth = (uid) => (uid ? { uid, token: { sub: uid } } : undefined);
/** Build a Firestore test case. existing = current doc data (or null), next = post-write data. */
function fs(name, expect, uid, method, path, { existing = null, next = null } = {}) {
  const req = { auth: auth(uid), path: `${D}/${path}`, method, time: new Date().toISOString() };
  if (next) req.resource = { data: next };
  const tc = { expectation: expect, request: req, functionMocks: getMocks };
  if (existing) tc.resource = { data: existing };
  return { name, tc };
}
function st(name, expect, uid, method, path, { size = 100, contentType = "image/png", existing = false } = {}) {
  const req = { auth: auth(uid), path: `/b/champstep-22358.firebasestorage.app/o/${path}`, method, time: new Date().toISOString() };
  if (method === "create" || method === "update") req.resource = { size, contentType, name: path };
  const tc = { expectation: expect, request: req, functionMocks: fsGetMocks };
  if (existing) tc.resource = { size: 10, contentType: "image/png", name: path };
  return { name, tc };
}

const USER = { uid: PARENT, role: "parent", subscriptionTier: "free", displayName: "P" };
const ACH = { childId: CHILD, title: "Gold", date: "2026-01-01" };
const REF = { childId: CHILD, mood: 4, content: "secret" };
const NOTE = { childId: CHILD, teacherId: TEACHER, teacherName: "T", content: "n" };
const INV = { code: "ABC123", teacherId: TEACHER, teacherName: "T", used: false, expiresAt: "2099-01-01", createdAt: "2026-01-01" };
const PAY = { uid: PARENT, plan: "family", amount: 9900, status: "pending", provider: "qpay" };
const LEGACY_USER_DOC = { uid: LEGACY_USER, role: "parent", displayName: "L" }; // no subscriptionTier
const LEGACY_ACH = { childId: LEGACY_CHILD, title: "Silver", date: "2026-01-01" };

const firestoreCases = [
  fs("anon cannot read users", "DENY", null, "get", `users/${PARENT}`, { existing: USER }),
  fs("anon cannot read children", "DENY", null, "get", `children/${CHILD}`, { existing: CHILD_DOC }),
  fs("users: owner get", "ALLOW", PARENT, "get", `users/${PARENT}`, { existing: USER }),
  fs("users: other get denied", "DENY", OTHER, "get", `users/${PARENT}`, { existing: USER }),
  fs("users: owner updates profile", "ALLOW", PARENT, "update", `users/${PARENT}`, { existing: USER, next: { ...USER, displayName: "New", phone: "1" } }),
  fs("users: owner cannot change subscriptionTier", "DENY", PARENT, "update", `users/${PARENT}`, { existing: USER, next: { ...USER, subscriptionTier: "coach" } }),
  fs("users: owner cannot add subscription map", "DENY", PARENT, "update", `users/${PARENT}`, { existing: USER, next: { ...USER, subscription: { plan: "master" } } }),
  fs("users: owner cannot set subscriptionExpiresAt", "DENY", PARENT, "update", `users/${PARENT}`, { existing: USER, next: { ...USER, subscriptionExpiresAt: "2030-01-01" } }),
  fs("users: owner cannot change role", "DENY", PARENT, "update", `users/${PARENT}`, { existing: USER, next: { ...USER, role: "teacher" } }),
  fs("users: create self free", "ALLOW", "newu", "create", "users/newu", { next: { uid: "newu", role: "parent", subscriptionTier: "free" } }),
  fs("users: create self no tier", "ALLOW", "newu", "create", "users/newu", { next: { uid: "newu", role: "teacher" } }),
  fs("users: create self paid tier denied", "DENY", "newu", "create", "users/newu", { next: { uid: "newu", role: "parent", subscriptionTier: "master" } }),
  fs("users: create with subscription map denied", "DENY", "newu", "create", "users/newu", { next: { uid: "newu", role: "parent", subscription: { plan: "family" } } }),
  fs("users: create for someone else denied", "DENY", "newu", "create", "users/victim", { next: { uid: "victim", role: "parent" } }),
  fs("users: delete denied", "DENY", PARENT, "delete", `users/${PARENT}`, { existing: USER }),
  fs("payments: owner get", "ALLOW", PARENT, "get", "payments/CS-1", { existing: PAY }),
  fs("payments: other get denied", "DENY", OTHER, "get", "payments/CS-1", { existing: PAY }),
  fs("payments: owner update denied", "DENY", PARENT, "update", "payments/CS-1", { existing: PAY, next: { ...PAY, status: "paid" } }),
  fs("payments: owner create denied", "DENY", PARENT, "create", "payments/CS-2", { next: { ...PAY, status: "paid" } }),
  fs("children: parent get", "ALLOW", PARENT, "get", `children/${CHILD}`, { existing: CHILD_DOC }),
  fs("children: teacher get", "ALLOW", TEACHER, "get", `children/${CHILD}`, { existing: CHILD_DOC }),
  fs("children: stranger get denied", "DENY", OTHER, "get", `children/${CHILD}`, { existing: CHILD_DOC }),
  fs("children: parent creates own", "ALLOW", PARENT, "create", "children/c_new", { next: { childId: "c_new", parentId: PARENT, teacherIds: [], name: "N" } }),
  fs("children: create for other parent denied", "DENY", PARENT, "create", "children/c_bad", { next: { childId: "c_bad", parentId: OTHER, teacherIds: [], name: "N" } }),
  fs("children: create with teachers denied", "DENY", PARENT, "create", "children/c_bad2", { next: { childId: "c_bad2", parentId: PARENT, teacherIds: [TEACHER], name: "N" } }),
  fs("children: parent updates name+teacherIds", "ALLOW", PARENT, "update", `children/${CHILD}`, { existing: CHILD_DOC, next: { ...CHILD_DOC, name: "R", teacherIds: [TEACHER, "t2"] } }),
  fs("children: parent cannot change parentId", "DENY", PARENT, "update", `children/${CHILD}`, { existing: CHILD_DOC, next: { ...CHILD_DOC, parentId: OTHER } }),
  fs("children: teacher update denied", "DENY", TEACHER, "update", `children/${CHILD}`, { existing: CHILD_DOC, next: { ...CHILD_DOC, name: "H" } }),
  fs("children: teacher delete denied", "DENY", TEACHER, "delete", `children/${CHILD}`, { existing: CHILD_DOC }),
  fs("achievements: parent get", "ALLOW", PARENT, "get", "achievements/a1", { existing: ACH }),
  fs("achievements: teacher get", "ALLOW", TEACHER, "get", "achievements/a1", { existing: ACH }),
  fs("achievements: stranger get denied", "DENY", OTHER, "get", "achievements/a1", { existing: ACH }),
  fs("achievements: parent create", "ALLOW", PARENT, "create", "achievements/a2", { next: ACH }),
  fs("achievements: parent create for stranger child denied", "DENY", PARENT, "create", "achievements/a3", { next: { ...ACH, childId: STRANGER_CHILD } }),
  fs("achievements: teacher create denied", "DENY", TEACHER, "create", "achievements/a4", { next: ACH }),
  fs("achievements: parent update", "ALLOW", PARENT, "update", "achievements/a1", { existing: ACH, next: { ...ACH, title: "E" } }),
  fs("achievements: parent cannot move to other child", "DENY", PARENT, "update", "achievements/a1", { existing: ACH, next: { ...ACH, childId: STRANGER_CHILD } }),
  fs("achievements: teacher update denied", "DENY", TEACHER, "update", "achievements/a1", { existing: ACH, next: { ...ACH, title: "E" } }),
  fs("achievements: teacher delete denied", "DENY", TEACHER, "delete", "achievements/a1", { existing: ACH }),
  fs("achievements: parent delete", "ALLOW", PARENT, "delete", "achievements/a1", { existing: ACH }),
  fs("practiceLogs: teacher get", "ALLOW", TEACHER, "get", "practiceLogs/l1", { existing: { childId: CHILD, duration: 1 } }),
  fs("practiceLogs: teacher create denied", "DENY", TEACHER, "create", "practiceLogs/l2", { next: { childId: CHILD, duration: 1 } }),
  fs("reflections: parent get", "ALLOW", PARENT, "get", "reflections/r1", { existing: REF }),
  fs("reflections: teacher get denied", "DENY", TEACHER, "get", "reflections/r1", { existing: REF }),
  fs("reflections: teacher create denied", "DENY", TEACHER, "create", "reflections/r2", { next: REF }),
  fs("reflections: teacher delete denied", "DENY", TEACHER, "delete", "reflections/r1", { existing: REF }),
  fs("reflections: parent create", "ALLOW", PARENT, "create", "reflections/r2", { next: REF }),
  fs("coachNotes: teacher create", "ALLOW", TEACHER, "create", "coachNotes/n2", { next: NOTE }),
  fs("coachNotes: teacher create with wrong teacherId denied", "DENY", TEACHER, "create", "coachNotes/n3", { next: { ...NOTE, teacherId: OTHER } }),
  fs("coachNotes: teacher create for non-linked child denied", "DENY", TEACHER, "create", "coachNotes/n4", { next: { ...NOTE, childId: STRANGER_CHILD } }),
  fs("coachNotes: parent create denied", "DENY", PARENT, "create", "coachNotes/n5", { next: { ...NOTE, teacherId: PARENT } }),
  fs("coachNotes: parent get", "ALLOW", PARENT, "get", "coachNotes/n1", { existing: NOTE }),
  fs("coachNotes: stranger get denied", "DENY", OTHER, "get", "coachNotes/n1", { existing: NOTE }),
  fs("coachNotes: update denied", "DENY", TEACHER, "update", "coachNotes/n1", { existing: NOTE, next: { ...NOTE, content: "e" } }),
  fs("coachNotes: teacher deletes own", "ALLOW", TEACHER, "delete", "coachNotes/n1", { existing: NOTE }),
  fs("coachNotes: parent deletes", "ALLOW", PARENT, "delete", "coachNotes/n1", { existing: NOTE }),
  fs("inviteCodes: teacher creates own", "ALLOW", TEACHER, "create", "inviteCodes/ABC123", { next: INV }),
  fs("inviteCodes: create for other teacher denied", "DENY", TEACHER, "create", "inviteCodes/ABC124", { next: { ...INV, code: "ABC124", teacherId: OTHER } }),
  fs("inviteCodes: create already-used denied", "DENY", TEACHER, "create", "inviteCodes/ABC125", { next: { ...INV, code: "ABC125", used: true } }),
  fs("inviteCodes: parent get", "ALLOW", PARENT, "get", "inviteCodes/ABC123", { existing: INV }),
  fs("inviteCodes: parent redeems for own child", "ALLOW", PARENT, "update", "inviteCodes/ABC123", { existing: INV, next: { ...INV, used: true, childId: CHILD, usedAt: "2026-01-02" } }),
  fs("inviteCodes: redeem for stranger child denied", "DENY", PARENT, "update", "inviteCodes/ABC123", { existing: INV, next: { ...INV, used: true, childId: STRANGER_CHILD, usedAt: "2026-01-02" } }),
  fs("inviteCodes: redeem touching other fields denied", "DENY", PARENT, "update", "inviteCodes/ABC123", { existing: INV, next: { ...INV, used: true, childId: CHILD, usedAt: "2026-01-02", teacherId: PARENT } }),
  fs("inviteCodes: redeem already-used denied", "DENY", PARENT, "update", "inviteCodes/ABC123", { existing: { ...INV, used: true, childId: CHILD }, next: { ...INV, used: true, childId: CHILD, usedAt: "x" } }),
  fs("promoCodes: get denied", "DENY", PARENT, "get", "promoCodes/CHAMP3", { existing: { code: "CHAMP3", usedBy: [] } }),
  fs("promoCodes: update denied", "DENY", PARENT, "update", "promoCodes/CHAMP3", { existing: { code: "CHAMP3", usedBy: [] }, next: { code: "CHAMP3", usedBy: [PARENT] } }),
  fs("unknown collection denied", "DENY", PARENT, "create", "misc/x", { next: { a: 1 } }),
  // legacy: children without teacherIds
  fs("legacy child: parent get", "ALLOW", PARENT, "get", `children/${LEGACY_CHILD}`, { existing: LEGACY_DOC }),
  fs("legacy child: teacher get denied", "DENY", TEACHER, "get", `children/${LEGACY_CHILD}`, { existing: LEGACY_DOC }),
  fs("legacy child: stranger get denied", "DENY", OTHER, "get", `children/${LEGACY_CHILD}`, { existing: LEGACY_DOC }),
  fs("legacy child: parent update name", "ALLOW", PARENT, "update", `children/${LEGACY_CHILD}`, { existing: LEGACY_DOC, next: { ...LEGACY_DOC, name: "R" } }),
  fs("legacy child: parent backfills teacherIds []", "ALLOW", PARENT, "update", `children/${LEGACY_CHILD}`, { existing: LEGACY_DOC, next: { ...LEGACY_DOC, teacherIds: [] } }),
  fs("legacy child: teacherIds must be a list", "DENY", PARENT, "update", `children/${LEGACY_CHILD}`, { existing: LEGACY_DOC, next: { ...LEGACY_DOC, teacherIds: "x" } }),
  fs("legacy child: parent delete", "ALLOW", PARENT, "delete", `children/${LEGACY_CHILD}`, { existing: LEGACY_DOC }),
  fs("legacy child: achievements parent get", "ALLOW", PARENT, "get", "achievements/al1", { existing: LEGACY_ACH }),
  fs("legacy child: achievements parent create", "ALLOW", PARENT, "create", "achievements/al2", { next: LEGACY_ACH }),
  fs("legacy child: achievements teacher get denied", "DENY", TEACHER, "get", "achievements/al1", { existing: LEGACY_ACH }),
  fs("legacy child: achievements stranger get denied", "DENY", OTHER, "get", "achievements/al1", { existing: LEGACY_ACH }),
  fs("legacy child: reflections parent get", "ALLOW", PARENT, "get", "reflections/rl1", { existing: { ...REF, childId: LEGACY_CHILD } }),
  fs("legacy child: coachNotes teacher create denied", "DENY", TEACHER, "create", "coachNotes/nl1", { next: { ...NOTE, childId: LEGACY_CHILD } }),
  // legacy: users without subscriptionTier
  fs("legacy user: owner get", "ALLOW", LEGACY_USER, "get", `users/${LEGACY_USER}`, { existing: LEGACY_USER_DOC }),
  fs("legacy user: owner updates profile", "ALLOW", LEGACY_USER, "update", `users/${LEGACY_USER}`, { existing: LEGACY_USER_DOC, next: { ...LEGACY_USER_DOC, displayName: "N", phone: "1" } }),
  fs("legacy user: cannot add subscriptionTier free", "DENY", LEGACY_USER, "update", `users/${LEGACY_USER}`, { existing: LEGACY_USER_DOC, next: { ...LEGACY_USER_DOC, subscriptionTier: "free" } }),
  fs("legacy user: cannot add subscriptionTier master", "DENY", LEGACY_USER, "update", `users/${LEGACY_USER}`, { existing: LEGACY_USER_DOC, next: { ...LEGACY_USER_DOC, subscriptionTier: "master" } }),
  fs("legacy user: cannot add subscription map", "DENY", LEGACY_USER, "update", `users/${LEGACY_USER}`, { existing: LEGACY_USER_DOC, next: { ...LEGACY_USER_DOC, subscription: { plan: "family" } } }),
  fs("legacy user: cannot add subscriptionExpiresAt", "DENY", LEGACY_USER, "update", `users/${LEGACY_USER}`, { existing: LEGACY_USER_DOC, next: { ...LEGACY_USER_DOC, subscriptionExpiresAt: "2030-01-01" } }),
  fs("legacy user: cannot change role", "DENY", LEGACY_USER, "update", `users/${LEGACY_USER}`, { existing: LEGACY_USER_DOC, next: { ...LEGACY_USER_DOC, role: "teacher" } }),
];

const storageCases = [
  st("storage: parent uploads image", "ALLOW", PARENT, "create", `achievements/${CHILD}/a.png`),
  st("storage: parent uploads avatar", "ALLOW", PARENT, "create", `avatars/${CHILD}/a.jpg`, { contentType: "image/jpeg" }),
  st("storage: non-image denied", "DENY", PARENT, "create", `achievements/${CHILD}/d.pdf`, { contentType: "application/pdf" }),
  st("storage: oversized avatar denied", "DENY", PARENT, "create", `avatars/${CHILD}/big.png`, { size: 2 * 1024 * 1024 + 1 }),
  st("storage: teacher reads", "ALLOW", TEACHER, "get", `achievements/${CHILD}/a.png`, { existing: true }),
  st("storage: teacher upload denied", "DENY", TEACHER, "create", `achievements/${CHILD}/t.png`),
  st("storage: teacher delete denied", "DENY", TEACHER, "delete", `achievements/${CHILD}/a.png`, { existing: true }),
  st("storage: stranger read denied", "DENY", OTHER, "get", `achievements/${CHILD}/a.png`, { existing: true }),
  st("storage: anon read denied", "DENY", null, "get", `achievements/${CHILD}/a.png`, { existing: true }),
  st("storage: parent delete", "ALLOW", PARENT, "delete", `achievements/${CHILD}/a.png`, { existing: true }),
  st("storage: unknown folder denied", "DENY", PARENT, "create", `misc/${CHILD}/x.png`),
  st("storage legacy child: parent uploads", "ALLOW", PARENT, "create", `achievements/${LEGACY_CHILD}/a.png`),
  st("storage legacy child: parent reads", "ALLOW", PARENT, "get", `achievements/${LEGACY_CHILD}/a.png`, { existing: true }),
  st("storage legacy child: teacher read denied", "DENY", TEACHER, "get", `achievements/${LEGACY_CHILD}/a.png`, { existing: true }),
  st("storage legacy child: stranger read denied", "DENY", OTHER, "get", `achievements/${LEGACY_CHILD}/a.png`, { existing: true }),
];

async function run(label, file, cases) {
  const body = {
    source: { files: [{ name: file, content: readFileSync(file, "utf8") }] },
    testSuite: { testCases: cases.map((c) => c.tc) },
  };
  const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "x-goog-user-project": PROJECT, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.issues?.length) {
    console.error(label, "API error / compile issues:", JSON.stringify(json).slice(0, 2000));
    return { pass: 0, fail: cases.length };
  }
  let pass = 0, fail = 0;
  (json.testResults ?? []).forEach((r, i) => {
    const ok = r.state === "SUCCESS";
    ok ? pass++ : fail++;
    const msg = ok ? "PASS" : `FAIL (${r.debugMessages?.join(" | ") ?? ""}${r.errorPosition ? " @" + JSON.stringify(r.errorPosition) : ""})`;
    console.log(`${ok ? "✓" : "✗"} ${label}: ${cases[i].name} — ${msg}`);
  });
  return { pass, fail };
}

const a = await run("firestore", "firestore.rules", firestoreCases);
const b = await run("storage", "storage.rules", storageCases);
console.log(`\nfirestore ${a.pass}/${a.pass + a.fail} passed · storage ${b.pass}/${b.pass + b.fail} passed`);
process.exit(a.fail + b.fail === 0 ? 0 : 1);
