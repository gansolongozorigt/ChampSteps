// Unit tests for the delete endpoints' core (api/_lib/deletion.ts) against an
// in-memory DeletionDeps mock.  node --test tests/deletion.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHILD_COLLECTIONS,
  RATE_LIMITS,
  ZERO_COUNTS,
  authorizeChildDelete,
  deleteAccountData,
  deleteChildData,
  processAccountDelete,
  processChildDelete,
} from "../api/_lib/deletion.ts";

const PARENT = "parent_1", TEACHER = "teacher_1", OTHER = "parent_2";
const KID = "child_parent_1_a", KID2 = "child_parent_1_b", OTHER_KID = "child_other_1";

/** In-memory Firestore/Storage/Auth. docs: Map<col, Map<id, data>>; files: Set<path>. */
function makeWorld() {
  const docs = new Map();
  const col = (c) => { if (!docs.has(c)) docs.set(c, new Map()); return docs.get(c); };
  const put = (c, id, d) => col(c).set(id, d);
  const files = new Set();
  const authUsers = new Set([PARENT, TEACHER, OTHER]);
  const tokens = { [PARENT]: { uid: PARENT, email: "Parent@Example.com" }, [TEACHER]: { uid: TEACHER, email: "t@x.mn" }, [OTHER]: { uid: OTHER, email: "o@x.mn" } };
  const rate = new Map();
  let clock = Date.parse("2026-10-12T10:00:00Z");
  const log = [];

  put("users", PARENT, { uid: PARENT, role: "parent" });
  put("users", TEACHER, { uid: TEACHER, role: "teacher" });
  put("users", OTHER, { uid: OTHER, role: "parent" });
  put("children", KID, { childId: KID, parentId: PARENT, teacherIds: [TEACHER], name: "Тэмүүлэн" });
  put("children", KID2, { childId: KID2, parentId: PARENT, teacherIds: [], name: "Анар" });
  put("children", OTHER_KID, { childId: OTHER_KID, parentId: OTHER, teacherIds: [TEACHER], name: "Other" });
  for (let i = 0; i < 12; i++) put("achievements", `a${i}`, { childId: KID, imageURLs: [] });
  for (let i = 0; i < 2; i++) put("achievements", `b${i}`, { childId: KID2 });
  put("achievements", "o1", { childId: OTHER_KID });
  for (let i = 0; i < 56; i++) put("practiceLogs", `p${i}`, { childId: KID });
  for (let i = 0; i < 8; i++) put("reflections", `r${i}`, { childId: KID });
  put("reflections", "ro", { childId: OTHER_KID });
  put("coachNotes", "n1", { childId: KID, teacherId: TEACHER });
  put("coachNotes", "n2", { childId: OTHER_KID, teacherId: TEACHER });
  put("inviteCodes", "USED01", { teacherId: TEACHER, used: true, childId: KID });
  put("inviteCodes", "FRESH1", { teacherId: TEACHER, used: false });
  put("aiInsights", KID, { childId: KID, text: "x" });
  put("aiInsights", OTHER_KID, { childId: OTHER_KID, text: "y" });
  put("payments", "CS-1", { uid: PARENT, plan: "master", amount: 24900, status: "paid" });
  put("aiUsage", PARENT, { count: 3 });
  for (let i = 0; i < 34; i++) files.add(`achievements/${KID}/${i}.jpg`);
  files.add(`avatars/${KID}/a.png`);
  files.add(`achievements/${OTHER_KID}/1.jpg`);

  const deps = {
    now: () => clock,
    async verifyToken(token) { return token && tokens[token] ? tokens[token] : null; },
    async getChild(id) { return col("children").get(id) ?? null; },
    async deleteWhere(c, field, value) {
      let n = 0;
      for (const [id, d] of [...col(c)]) if (d[field] === value) { col(c).delete(id); n++; }
      log.push(`deleteWhere:${c}:${field}=${value}:${n}`);
      return n;
    },
    async deleteDoc(c, id) { const had = col(c).delete(id); log.push(`deleteDoc:${c}/${id}:${had}`); return had; },
    async recursiveDeleteDoc(c, id) { const had = col(c).delete(id); log.push(`recursiveDelete:${c}/${id}:${had}`); return had; },
    async deleteStoragePrefix(prefix) {
      let n = 0;
      for (const f of [...files]) if (f.startsWith(prefix)) { files.delete(f); n++; }
      log.push(`storage:${prefix}:${n}`);
      return n;
    },
    async listChildIdsForParent(uid) { return [...col("children")].filter(([, d]) => d.parentId === uid).map(([id]) => id); },
    async listChildIdsForTeacher(uid) { return [...col("children")].filter(([, d]) => Array.isArray(d.teacherIds) && d.teacherIds.includes(uid)).map(([id]) => id); },
    async removeTeacherFromChild(id, uid) { const d = col("children").get(id); if (d) d.teacherIds = d.teacherIds.filter((t) => t !== uid); },
    async deleteAuthUser(uid) { return authUsers.delete(uid); },
    async rateWindow(kind, uid, update) {
      const key = `${kind}:${uid}`;
      const next = update(rate.get(key));
      if (next) rate.set(key, next);
    },
  };
  return { deps, docs, col, files, authUsers, log, tick: (ms) => { clock += ms; } };
}

const count = (w, c, field, value) => [...w.col(c).values()].filter((d) => d[field] === value).length;
const filesUnder = (w, prefix) => [...w.files].filter((f) => f.startsWith(prefix)).length;

test("authorizeChildDelete: parent ok, teacher/stranger forbidden, missing → gone", () => {
  const child = { parentId: PARENT, teacherIds: [TEACHER] };
  assert.equal(authorizeChildDelete(child, PARENT), "ok");
  assert.equal(authorizeChildDelete(child, TEACHER), "forbidden");
  assert.equal(authorizeChildDelete(child, OTHER), "forbidden");
  assert.equal(authorizeChildDelete(null, PARENT), "gone");
});

test("processChildDelete: no token → 401, bad childId → 400", async () => {
  const w = makeWorld();
  assert.equal((await processChildDelete({ token: null, body: { childId: KID } }, w.deps)).status, 401);
  assert.equal((await processChildDelete({ token: "garbage", body: { childId: KID } }, w.deps)).status, 401);
  assert.equal((await processChildDelete({ token: PARENT, body: {} }, w.deps)).status, 400);
  assert.equal((await processChildDelete({ token: PARENT, body: { childId: "../x" } }, w.deps)).status, 400);
  assert.equal(w.col("children").size, 3, "nothing deleted");
});

test("processChildDelete: teacher of the child and another parent get 403, nothing is removed", async () => {
  const w = makeWorld();
  assert.equal((await processChildDelete({ token: TEACHER, body: { childId: KID } }, w.deps)).status, 403);
  assert.equal((await processChildDelete({ token: OTHER, body: { childId: KID } }, w.deps)).status, 403);
  assert.equal(count(w, "achievements", "childId", KID), 12);
  assert.equal(filesUnder(w, `achievements/${KID}/`), 34);
  assert.equal(w.log.length, 0, "no deletion calls");
});

test("processChildDelete: owner → every piece of the child is gone, counts are exact, siblings untouched", async () => {
  const w = makeWorld();
  const r = await processChildDelete({ token: PARENT, body: { childId: KID } }, w.deps);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.deleted, {
    photos: 34, avatarFiles: 1, achievements: 12, practiceLogs: 56, reflections: 8, coachNotes: 1, inviteCodes: 1, aiInsights: 1, child: 1,
  });
  assert.equal(r.body.alreadyGone, false);
  for (const c of CHILD_COLLECTIONS) assert.equal(count(w, c, "childId", KID), 0, c);
  assert.equal(count(w, "inviteCodes", "childId", KID), 0);
  assert.ok(w.col("inviteCodes").has("FRESH1"), "teacher's unused code stays");
  assert.ok(!w.col("aiInsights").has(KID));
  assert.ok(!w.col("children").has(KID));
  assert.equal(filesUnder(w, `achievements/${KID}/`), 0);
  assert.equal(filesUnder(w, `avatars/${KID}/`), 0);
  // the other child of the same parent and the stranger's child are intact
  assert.equal(count(w, "achievements", "childId", KID2), 2);
  assert.ok(w.col("children").has(KID2));
  assert.ok(w.col("children").has(OTHER_KID));
  assert.equal(count(w, "achievements", "childId", OTHER_KID), 1);
  assert.equal(count(w, "reflections", "childId", OTHER_KID), 1);
  assert.ok(w.col("aiInsights").has(OTHER_KID));
  assert.equal(filesUnder(w, `achievements/${OTHER_KID}/`), 1);
  assert.ok(w.col("payments").has("CS-1"), "payments are never touched");
  assert.ok(w.col("users").has(PARENT));
});

test("deletion order: Storage first, child doc last", async () => {
  const w = makeWorld();
  await deleteChildData(w.deps, KID);
  assert.match(w.log[0], /^storage:achievements\//);
  assert.match(w.log[1], /^storage:avatars\//);
  assert.match(w.log[w.log.length - 1], new RegExp(`^recursiveDelete:children/${KID}:true$`));
  assert.match(w.log[w.log.length - 2], new RegExp(`^deleteDoc:aiInsights/${KID}:true$`));
});

test("processChildDelete is idempotent: second call → 200 alreadyGone with zero counts", async () => {
  const w = makeWorld();
  await processChildDelete({ token: PARENT, body: { childId: KID } }, w.deps);
  const again = await processChildDelete({ token: PARENT, body: { childId: KID } }, w.deps);
  assert.equal(again.status, 200);
  assert.equal(again.body.alreadyGone, true);
  assert.deepEqual(again.body.deleted, { ...ZERO_COUNTS });
  // deleteChildData itself is also safe to re-run (partial-failure retry)
  assert.deepEqual(await deleteChildData(w.deps, KID), { ...ZERO_COUNTS });
});

test("processChildDelete: rate limit 10/h, denied call changes nothing, window resets", async () => {
  const w = makeWorld();
  const { limit, windowMs } = RATE_LIMITS.child;
  for (let i = 0; i < limit; i++) {
    const r = await processChildDelete({ token: PARENT, body: { childId: `child_parent_1_${i}` } }, w.deps);
    // these ids don't exist except KID ones — a missing child short-circuits BEFORE the limiter,
    // so use the real sibling to actually consume the window
    assert.ok([200].includes(r.status));
  }
  // consume the window with real deletions
  for (let i = 0; i < limit; i++) {
    w.col("children").set(`tmp${i}`, { childId: `tmp${i}`, parentId: PARENT, teacherIds: [] });
    const r = await processChildDelete({ token: PARENT, body: { childId: `tmp${i}` } }, w.deps);
    assert.equal(r.status, 200, `deletion ${i + 1}`);
  }
  w.col("children").set("tmpX", { childId: "tmpX", parentId: PARENT, teacherIds: [] });
  const denied = await processChildDelete({ token: PARENT, body: { childId: "tmpX" } }, w.deps);
  assert.equal(denied.status, 429);
  assert.ok(denied.headers["Retry-After"]);
  assert.ok(w.col("children").has("tmpX"), "denied request deleted nothing");
  w.tick(windowMs + 1);
  const ok = await processChildDelete({ token: PARENT, body: { childId: "tmpX" } }, w.deps);
  assert.equal(ok.status, 200);
});

test("processAccountDelete: 401 without token, 400 when confirmEmail does not match the token", async () => {
  const w = makeWorld();
  assert.equal((await processAccountDelete({ token: null, body: { confirmEmail: "x" } }, w.deps)).status, 401);
  const bad = await processAccountDelete({ token: PARENT, body: { confirmEmail: "wrong@example.com" } }, w.deps);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "email_mismatch");
  assert.equal((await processAccountDelete({ token: PARENT, body: {} }, w.deps)).status, 400);
  assert.ok(w.authUsers.has(PARENT));
  assert.equal(w.col("children").size, 3);
});

test("processAccountDelete (parent): all children + user doc + auth user gone, payments kept, e-mail case-insensitive", async () => {
  const w = makeWorld();
  const r = await processAccountDelete({ token: PARENT, body: { confirmEmail: "parent@example.com" } }, w.deps);
  assert.equal(r.status, 200);
  const d = r.body.deleted;
  assert.equal(d.children, 2);
  assert.equal(d.childData.achievements, 14);
  assert.equal(d.childData.photos, 34);
  assert.equal(d.childData.child, 2);
  assert.equal(d.userDoc, 1);
  assert.equal(d.authUser, 1);
  assert.ok(!w.col("children").has(KID) && !w.col("children").has(KID2));
  assert.ok(w.col("children").has(OTHER_KID));
  assert.ok(!w.col("users").has(PARENT));
  assert.ok(!w.col("aiUsage").has(PARENT));
  assert.ok(!w.authUsers.has(PARENT));
  assert.ok(w.col("payments").has("CS-1"), "financial record kept");
  assert.equal(w.col("payments").get("CS-1").uid, PARENT, "payment uid untouched");
  assert.ok(w.authUsers.has(TEACHER) && w.authUsers.has(OTHER));
});

test("processAccountDelete (teacher): codes, notes and links removed; students' data untouched", async () => {
  const w = makeWorld();
  const r = await processAccountDelete({ token: TEACHER, body: { confirmEmail: "t@x.mn" } }, w.deps);
  assert.equal(r.status, 200);
  const d = r.body.deleted;
  assert.equal(d.children, 0);
  assert.equal(d.teacherInviteCodes, 2);
  assert.equal(d.teacherCoachNotes, 2);
  assert.equal(d.unlinkedStudents, 2);
  assert.deepEqual(w.col("children").get(KID).teacherIds, []);
  assert.deepEqual(w.col("children").get(OTHER_KID).teacherIds, []);
  assert.equal(count(w, "achievements", "childId", KID), 12, "student data intact");
  assert.equal(w.files.size, 36, "no student files touched");
  assert.ok(!w.col("users").has(TEACHER));
  assert.ok(!w.authUsers.has(TEACHER));
});

test("processAccountDelete: 3/h rate limit", async () => {
  const w = makeWorld();
  for (let i = 0; i < RATE_LIMITS.account.limit; i++) {
    const r = await processAccountDelete({ token: OTHER, body: { confirmEmail: "o@x.mn" } }, w.deps);
    assert.equal(r.status, 200, `call ${i + 1} (idempotent re-run)`);
  }
  assert.equal((await processAccountDelete({ token: OTHER, body: { confirmEmail: "o@x.mn" } }, w.deps)).status, 429);
});

test("deleteAccountData on an already-deleted uid is a no-op with zero counts", async () => {
  const w = makeWorld();
  await deleteAccountData(w.deps, PARENT);
  const again = await deleteAccountData(w.deps, PARENT);
  assert.equal(again.children, 0);
  assert.equal(again.userDoc, 0);
  assert.equal(again.authUser, 0);
});
