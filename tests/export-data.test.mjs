// node --import tsx --test tests/export-data.test.mjs — "My data" export builder (pure).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXPORT_SCHEMA_VERSION, ZIP_LIMITS, buildExport, collectImages, exportFilename, sanitizeUserDoc, toIsoDeep, zipTooBig,
} from "../src/lib/exportData.ts";

const ts = (iso) => ({ toDate: () => new Date(iso), seconds: 1 }); // Firestore Timestamp look-alike
const NOW = new Date("2026-10-13T09:30:00Z");

const child = { childId: "child_a", parentId: "p1", teacherIds: ["t1"], name: "Тэмүүлэн", birthDate: "2014-02-11", bio: "", avatarUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/avatars%2Fchild_a%2Fava.jpg?alt=media&token=1", createdAt: ts("2026-01-01T00:00:00Z") };
const child2 = { childId: "child_b", parentId: "p1", teacherIds: [], name: "Б", birthDate: "2016-05-05" };
const ach = [
  { id: "a1", childId: "child_a", title: "Олимпиад", date: "2026-03-02", location: "УБ", category: "Academic", description: "d", awardType: "Gold", imageURLs: ["https://x/o/achievements%2Fchild_a%2F1.jpg?alt=media", "https://x/o/achievements%2Fchild_a%2F2.png?alt=media"], createdAt: ts("2026-03-02T10:00:00Z") },
  { id: "a2", childId: "child_b", title: "Б-ийн амжилт", date: "2026-04-01", location: "УБ", category: "Sports", description: "", awardType: "Silver", imageURLs: [], createdAt: "2026-04-01T00:00:00.000Z" },
  { id: "a3", childId: "child_zzz", title: "Өөр хүний", date: "2026-04-01", location: "", category: "Arts", description: "", awardType: "Participant", imageURLs: ["https://x/other.jpg"] },
];
const logs = [{ id: "l1", childId: "child_a", date: "2026-05-01", duration: 30, content: "run", createdAt: ts("2026-05-01T00:00:00Z") }];
const refl = [{ id: "r1", childId: "child_a", date: "2026-05-02", mood: 4, content: "ok", createdAt: new Date("2026-05-02T00:00:00Z") }];
const ai = [{ childId: "child_a", text: "AI текст", updatedAt: ts("2026-06-01T00:00:00Z") }];
const notes = [
  { id: "n1", childId: "child_a", teacherId: "t1", teacherName: "Багш", content: "сайн", createdAt: ts("2026-06-02T00:00:00Z") },
  { id: "n2", childId: "child_a", teacherId: "t9", teacherName: "Өөр", content: "x", createdAt: "2026-06-03T00:00:00.000Z" },
];
const userDoc = { uid: "p1", email: "p@x.mn", displayName: "P", role: "parent", createdAt: ts("2026-01-01T00:00:00Z"), subscriptionTier: "family", subscriptionExpiresAt: ts("2026-11-12T00:00:00Z"), subscription: { provider: "qpay", lastOrderId: "CS-1" }, expiredFrom: "family", subscriptionActivatedAt: ts("2026-10-13T00:00:00Z") };

const parentInput = { scope: "parent", uid: "p1", user: userDoc, children: [child, child2], achievements: ach, practiceLogs: logs, reflections: refl, aiInsights: ai, coachNotes: notes, appVersion: "0.2.0", now: NOW };

test("toIsoDeep: Timestamp-like, Date, nested arrays/objects → ISO strings; scalars untouched", () => {
  assert.equal(toIsoDeep(ts("2026-01-02T03:04:05Z")), "2026-01-02T03:04:05.000Z");
  assert.equal(toIsoDeep(new Date("2026-01-02T03:04:05Z")), "2026-01-02T03:04:05.000Z");
  assert.deepEqual(toIsoDeep({ a: [ts("2026-01-01T00:00:00Z"), { b: 1, c: "s", d: null }] }), { a: ["2026-01-01T00:00:00.000Z", { b: 1, c: "s", d: null }] });
  assert.equal(toIsoDeep(undefined), undefined);
});

test("sanitizeUserDoc keeps profile fields only, drops server-side subscription internals", () => {
  const u = sanitizeUserDoc(userDoc);
  assert.deepEqual(Object.keys(u).sort(), ["createdAt", "displayName", "email", "role", "subscriptionExpiresAt", "subscriptionTier", "uid"]);
  assert.equal(u.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal("subscription" in u, false);
  assert.equal("expiredFrom" in u, false);
  assert.equal(sanitizeUserDoc(null), null);
});

test("parent export: header, nested children, only own children's records, timestamps as ISO, images list", () => {
  const f = buildExport(parentInput);
  assert.equal(f.schemaVersion, EXPORT_SCHEMA_VERSION);
  assert.equal(f.schemaVersion, 1);
  assert.equal(f.exportedAt, "2026-10-13T09:30:00.000Z");
  assert.equal(f.appVersion, "0.2.0");
  assert.equal(f.scope, "parent");
  assert.deepEqual(Object.keys(f), ["exportedAt", "appVersion", "schemaVersion", "scope", "user", "children", "coachNotes", "images", "notes"]);
  assert.equal(f.children.length, 2);
  const a = f.children[0];
  assert.equal(a.name, "Тэмүүлэн");
  assert.equal(a.createdAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(a.achievements.map((x) => x.id), ["a1"]);
  assert.equal(a.achievements[0].createdAt, "2026-03-02T10:00:00.000Z");
  assert.deepEqual(a.practiceLogs.map((x) => x.id), ["l1"]);
  assert.equal(a.reflections[0].createdAt, "2026-05-02T00:00:00.000Z");
  assert.deepEqual(a.aiInsight, { text: "AI текст", updatedAt: "2026-06-01T00:00:00.000Z" });
  assert.equal(a.coachNotes.length, 2, "parent sees every teacher's notes on their child");
  assert.equal(f.children[1].aiInsight, null);
  assert.deepEqual(f.children[1].achievements.map((x) => x.id), ["a2"]);
  // a3 belongs to someone else's child → nowhere in the file
  assert.equal(JSON.stringify(f).includes("Өөр хүний"), false);
  assert.deepEqual(f.images.map((i) => i.zipPath), ["images/child_a/avatar.jpg", "images/child_a/a1-1.jpg", "images/child_a/a1-2.png"]);
  assert.equal(f.coachNotes.length, 0);
  // serialisable, no functions left
  assert.equal(JSON.stringify(f).includes("toDate"), false);
});

test("teacher export: own notes only, no children, no images, explanatory note", () => {
  const f = buildExport({ ...parentInput, scope: "teacher", uid: "t1" });
  assert.equal(f.children.length, 0);
  assert.equal(f.images.length, 0);
  assert.deepEqual(f.coachNotes.map((n) => n.id), ["n1"]);
  assert.equal(f.coachNotes[0].createdAt, "2026-06-02T00:00:00.000Z");
  assert.ok(f.notes[0].startsWith("teacher:"));
});

test("guest export: local child + achievements, no images, note", () => {
  const f = buildExport({ ...parentInput, scope: "guest", user: { uid: "offline_1", displayName: "Эцэг эх", role: "parent" }, children: [child2], aiInsights: [], coachNotes: [] });
  assert.equal(f.children.length, 1);
  assert.deepEqual(f.children[0].achievements.map((x) => x.id), ["a2"]);
  assert.equal(f.images.length, 0);
  assert.deepEqual(f.user, { uid: "offline_1", displayName: "Эцэг эх", role: "parent" });
  assert.ok(f.notes[0].startsWith("guest:"));
});

test("filename, image collection skips data:/blob:, zip limits", () => {
  assert.equal(exportFilename(NOW, "json"), "champstep-export-20261013.json");
  assert.equal(exportFilename(NOW, "zip"), "champstep-export-20261013.zip");
  const imgs = collectImages([{ ...child, avatarUrl: "data:image/png;base64,AAA" }], [{ ...ach[0], imageURLs: ["blob:x", "https://x/a.webp"] }]);
  assert.deepEqual(imgs.map((i) => i.zipPath), ["images/child_a/a1-2.webp"]);
  assert.equal(ZIP_LIMITS.maxImages, 50);
  assert.equal(zipTooBig(50), false);
  assert.equal(zipTooBig(51), true);
  assert.equal(zipTooBig(3, 100 * 1024 * 1024), false);
  assert.equal(zipTooBig(3, 100 * 1024 * 1024 + 1), true);
});
