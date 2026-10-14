// node --test tests/push.test.mjs — push token registry + daily reminder cron (api/_lib/push.ts)
// Admin SDK and FCM are replaced by in-memory mocks; `send` records what would be delivered.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEAD_TOKEN_CODES,
  TOKEN_RE,
  competitionText,
  dailyText,
  decide,
  messagesFor,
  parseRegisterBody,
  processRegister,
  processUnregister,
  runReminders,
  isCronAuthorized as isAuthorized,
  ubDateKey,
  decideEvening,
  decideMorning,
  goalText,
  plusDays,
  runKey,
} from "../api/_lib/push.ts";

const KINDS = { daily: 0, competition: 0, goalToday: 0, goalTomorrow: 0, goalWeek: 0, goalDaily: 0 };

const TOKEN_A = "fcm-token-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:APA91b";
const TOKEN_B = "fcm-token-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:APA91b";
const TOKEN_C = "fcm-token-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC:APA91b";

// 2026-10-14 12:00 UTC == 2026-10-14 20:00 Ulaanbaatar
const T_CRON = Date.parse("2026-10-14T12:00:00Z");

// ---------------------------------------------------------------------------
// helpers / pure functions
// ---------------------------------------------------------------------------

test("ubDateKey: Ulaanbaatar day (UTC+8) — 17:00 UTC is already tomorrow in UB", () => {
  assert.equal(ubDateKey(Date.parse("2026-10-14T12:00:00Z")), "2026-10-14");
  assert.equal(ubDateKey(Date.parse("2026-10-14T16:30:00Z")), "2026-10-15");
  assert.equal(ubDateKey(Date.parse("2026-10-14T15:59:59Z")), "2026-10-14");
});

test("token format: URL-safe, 20..4096 chars", () => {
  assert.ok(TOKEN_RE.test(TOKEN_A));
  assert.ok(!TOKEN_RE.test("short"));
  assert.ok(!TOKEN_RE.test("has space " + "x".repeat(30)));
  assert.ok(!TOKEN_RE.test("x".repeat(5000)));
});

test("parseRegisterBody: defaults platform/lang, rejects bad tokens", () => {
  assert.deepEqual(parseRegisterBody({ token: TOKEN_A, platform: "ios-pwa", lang: "en" }), { token: TOKEN_A, platform: "ios-pwa", lang: "en" });
  assert.deepEqual(parseRegisterBody({ token: TOKEN_A, platform: "tv", lang: "de" }), { token: TOKEN_A, platform: "desktop", lang: "mn" });
  assert.equal(parseRegisterBody({ token: "" }), null);
  assert.equal(parseRegisterBody(null), null);
});

test("texts: three languages, child names and titles interpolated", () => {
  assert.equal(dailyText("mn", ["Тэмүүлэн"]).body, "Тэмүүлэн: өнөөдрийн бэлтгэлээ тэмдэглэх үү?");
  assert.equal(dailyText("en", ["Anar", "Temuulen"]).body, "Anar, Temuulen: log today's practice?");
  assert.equal(dailyText("ru", ["Анар"]).body, "Анар: отметить сегодняшнюю тренировку?");
  assert.equal(competitionText("mn", "Хотын аварга", "Анар").body, "Маргааш: Хотын аварга (Анар). Амжилт хүсье!");
  assert.equal(competitionText("en", "City cup", "Anar").body, "Tomorrow: City cup (Anar). Good luck!");
  assert.equal(competitionText("ru", "Кубок", "Анар").body, "Завтра: Кубок (Анар). Удачи!");
  assert.equal(dailyText("xx", ["A"]).title, "ChampStep"); // unknown lang falls back to mn
});

test("decide: competition tomorrow beats the daily reminder (max one per user)", () => {
  const kids = [{ childId: "k1", name: "Анар" }, { childId: "k2", name: "Тэмүүлэн" }];
  const d = decide({ uid: "u", daily: true, competition: true }, kids, new Set(), [{ childId: "k2", title: "Аварга" }]);
  assert.deepEqual(d, { kind: "competition", childName: "Тэмүүлэн", title: "Аварга" });
});

test("decide: daily names only the children without a log today", () => {
  const kids = [{ childId: "k1", name: "Анар" }, { childId: "k2", name: "Тэмүүлэн" }];
  assert.deepEqual(decide({ uid: "u", daily: true, competition: false }, kids, new Set(["k1"]), []), { kind: "daily", childNames: ["Тэмүүлэн"] });
  assert.deepEqual(decide({ uid: "u", daily: true, competition: false }, kids, new Set(["k1", "k2"]), []), { kind: "none", reason: "all-logged" });
  assert.deepEqual(decide({ uid: "u", daily: true, competition: true }, [], new Set(), []), { kind: "none", reason: "no-children" });
  assert.deepEqual(decide({ uid: "u", daily: false, competition: false }, kids, new Set(), []), { kind: "none", reason: "disabled" });
  // competition toggle on but no event tomorrow and daily off -> nothing
  assert.deepEqual(decide({ uid: "u", daily: false, competition: true }, kids, new Set(), []), { kind: "none", reason: "disabled" });
});

test("messagesFor: one message per token in that token's language, same tag per day", () => {
  const msgs = messagesFor({ kind: "daily", childNames: ["Анар"] }, [{ token: TOKEN_A, lang: "mn" }, { token: TOKEN_B, lang: "en" }], "2026-10-14");
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].body, "Анар: өнөөдрийн бэлтгэлээ тэмдэглэх үү?");
  assert.equal(msgs[1].body, "Анар: log today's practice?");
  assert.equal(msgs[0].url, "/today");
  assert.equal(msgs[0].tag, "reminder-2026-10-14");
  assert.equal(messagesFor({ kind: "competition", childName: "A", title: "T" }, [{ token: TOKEN_A, lang: "mn" }], "2026-10-14")[0].url, "/");
  assert.deepEqual(messagesFor({ kind: "none", reason: "disabled" }, [{ token: TOKEN_A, lang: "mn" }], "x"), []);
});

test("cron auth: exact Bearer match, never without a configured secret", () => {
  assert.ok(isAuthorized("Bearer s3cret", "s3cret"));
  assert.ok(!isAuthorized("Bearer other", "s3cret"));
  assert.ok(!isAuthorized("s3cret", "s3cret"));
  assert.ok(!isAuthorized(undefined, "s3cret"));
  assert.ok(!isAuthorized("Bearer ", ""));
  assert.ok(!isAuthorized("Bearer undefined", undefined));
});

// ---------------------------------------------------------------------------
// register / unregister
// ---------------------------------------------------------------------------

function makePushWorld() {
  const tokens = new Map(); // token -> { uid, platform, lang, createdAt, lastSeenAt }
  let clock = T_CRON;
  const deps = {
    async verifyToken(idToken) { return idToken === "id-u1" ? { uid: "u1" } : idToken === "id-u2" ? { uid: "u2" } : null; },
    async upsertToken(token, data, nowMs) {
      const prev = tokens.get(token);
      tokens.set(token, { ...data, createdAt: prev?.createdAt ?? nowMs, lastSeenAt: nowMs });
    },
    async deleteToken(token, uid) {
      const d = tokens.get(token);
      if (!d) return true;
      if (d.uid !== uid) return false;
      tokens.delete(token);
      return true;
    },
    now: () => clock,
  };
  return { tokens, deps, tick: (ms) => { clock += ms; } };
}

test("register: 401 without a valid ID token, 400 on a bad token, 200 stores uid/platform/lang", async () => {
  const w = makePushWorld();
  assert.equal((await processRegister(w.deps, "nope", { token: TOKEN_A })).status, 401);
  assert.equal((await processRegister(w.deps, "id-u1", { token: "bad" })).status, 400);
  const r = await processRegister(w.deps, "id-u1", { token: TOKEN_A, platform: "ios-pwa", lang: "en" });
  assert.equal(r.status, 200);
  assert.deepEqual(w.tokens.get(TOKEN_A), { uid: "u1", platform: "ios-pwa", lang: "en", createdAt: T_CRON, lastSeenAt: T_CRON });
});

test("register again: lastSeenAt moves, createdAt stays; token can move to another uid (shared device)", async () => {
  const w = makePushWorld();
  await processRegister(w.deps, "id-u1", { token: TOKEN_A, platform: "android", lang: "mn" });
  w.tick(60_000);
  await processRegister(w.deps, "id-u1", { token: TOKEN_A, platform: "android", lang: "ru" });
  assert.equal(w.tokens.get(TOKEN_A).createdAt, T_CRON);
  assert.equal(w.tokens.get(TOKEN_A).lastSeenAt, T_CRON + 60_000);
  assert.equal(w.tokens.get(TOKEN_A).lang, "ru");
  await processRegister(w.deps, "id-u2", { token: TOKEN_A, platform: "android", lang: "mn" });
  assert.equal(w.tokens.get(TOKEN_A).uid, "u2");
});

test("unregister: only the owner can delete; unknown token is a no-op 200", async () => {
  const w = makePushWorld();
  await processRegister(w.deps, "id-u1", { token: TOKEN_A, platform: "desktop", lang: "mn" });
  assert.equal((await processUnregister(w.deps, "bad", { token: TOKEN_A })).status, 401);
  assert.equal((await processUnregister(w.deps, "id-u2", { token: TOKEN_A })).status, 403);
  assert.ok(w.tokens.has(TOKEN_A));
  assert.equal((await processUnregister(w.deps, "id-u1", { token: TOKEN_A })).status, 200);
  assert.ok(!w.tokens.has(TOKEN_A));
  assert.equal((await processUnregister(w.deps, "id-u1", { token: TOKEN_A })).status, 200);
  assert.equal((await processUnregister(w.deps, "id-u1", { token: "x" })).status, 400);
});

// ---------------------------------------------------------------------------
// cron
// ---------------------------------------------------------------------------

/** In-memory world for runReminders. */
function makeReminderWorld() {
  const users = new Map();      // uid -> { daily, competition }
  const children = new Map();   // childId -> { parentId, name }
  const logs = [];              // { childId, date }
  const achievements = [];      // { childId, title, date }
  const tokens = new Map();     // token -> { uid, lang }
  const goals = [];             // { id, childId, title, date, status }
  const goalLogs = [];          // { goalId, date }
  const runs = new Map();       // dateKey -> doc
  const sent = [];              // every message handed to FCM
  const failWith = new Map();   // token -> errorCode
  let clock = T_CRON;
  const deps = {
    now: () => clock,
    async listReminderUsers() {
      return [...users.entries()].filter(([, r]) => r.daily || r.competition).map(([uid, r]) => ({ uid, daily: !!r.daily, competition: !!r.competition }));
    },
    async childrenOf(uid) { return [...children.entries()].filter(([, c]) => c.parentId === uid).map(([childId, c]) => ({ childId, name: c.name })); },
    async childrenWithLogOn(ids, date) { return new Set(logs.filter((l) => ids.includes(l.childId) && l.date === date).map((l) => l.childId)); },
    async achievementsOn(ids, date) { return achievements.filter((a) => ids.includes(a.childId) && a.date === date).map(({ childId, title }) => ({ childId, title })); },
    async activeGoalsOf(ids) { return goals.filter((g) => ids.includes(g.childId) && g.status === "active").map(({ id, childId, title, date }) => ({ id, childId, title, date })); },
    async goalStatsOf(goalId) { const mine = goalLogs.filter((l) => l.goalId === goalId); return { sessions: mine.length, days: new Set(mine.map((l) => l.date)).size }; },
    async tokensOf(uid) { return [...tokens.entries()].filter(([, t]) => t.uid === uid).map(([token, t]) => ({ token, lang: t.lang })); },
    async send(messages) {
      sent.push(...messages);
      return messages.map((m) => failWith.has(m.token) ? { token: m.token, ok: false, errorCode: failWith.get(m.token) } : { token: m.token, ok: true });
    },
    async deleteTokens(list) { for (const t of list) tokens.delete(t); },
    async claimRun(dateKey, nowMs) { if (runs.has(dateKey)) return false; runs.set(dateKey, { status: "running", startedAt: nowMs }); return true; },
    async finishRun(dateKey, summary) { runs.set(dateKey, { ...runs.get(dateKey), status: "done", ...summary }); },
  };
  return { users, children, logs, achievements, tokens, goals, goalLogs, runs, sent, failWith, deps, tick: (ms) => { clock += ms; } };
}

test("cron: daily reminder to a parent with no log today, in each token's language", async () => {
  const w = makeReminderWorld();
  w.users.set("u1", { daily: true, competition: false });
  w.children.set("k1", { parentId: "u1", name: "Анар" });
  w.tokens.set(TOKEN_A, { uid: "u1", lang: "mn" });
  w.tokens.set(TOKEN_B, { uid: "u1", lang: "en" });
  const { claimed, summary } = await runReminders(w.deps);
  assert.ok(claimed);
  assert.equal(summary.date, "2026-10-14");
  assert.equal(summary.users, 1);
  assert.equal(summary.notified, 1);
  assert.equal(summary.sent, 2);
  assert.deepEqual(summary.byKind, { ...KINDS, daily: 1 });
  assert.equal(w.sent.length, 2);
  assert.equal(w.sent[0].body, "Анар: өнөөдрийн бэлтгэлээ тэмдэглэх үү?");
  assert.equal(w.sent[1].body, "Анар: log today's practice?");
  assert.equal(w.runs.get("2026-10-14").status, "done");
});

test("cron: a log written today (UB date) suppresses the daily reminder", async () => {
  const w = makeReminderWorld();
  w.users.set("u1", { daily: true, competition: false });
  w.children.set("k1", { parentId: "u1", name: "Анар" });
  w.tokens.set(TOKEN_A, { uid: "u1", lang: "mn" });
  w.logs.push({ childId: "k1", date: "2026-10-14" });
  const { summary } = await runReminders(w.deps);
  assert.equal(summary.notified, 0);
  assert.equal(summary.skippedAlreadyLogged, 1);
  assert.equal(w.sent.length, 0);
});

test("cron: competition tomorrow → one competition message, not two notifications", async () => {
  const w = makeReminderWorld();
  w.users.set("u1", { daily: true, competition: true });
  w.children.set("k1", { parentId: "u1", name: "Анар" });
  w.tokens.set(TOKEN_A, { uid: "u1", lang: "mn" });
  w.achievements.push({ childId: "k1", title: "Хотын аварга", date: "2026-10-15" });
  w.achievements.push({ childId: "k1", title: "Хуучин", date: "2026-10-01" });
  const { summary } = await runReminders(w.deps);
  assert.equal(summary.notified, 1);
  assert.deepEqual(summary.byKind, { ...KINDS, competition: 1 });
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].body, "Маргааш: Хотын аварга (Анар). Амжилт хүсье!");
  assert.equal(w.sent[0].url, "/");
});

test("cron: idempotent per day — second run is skipped, next day runs again", async () => {
  const w = makeReminderWorld();
  w.users.set("u1", { daily: true, competition: false });
  w.children.set("k1", { parentId: "u1", name: "Анар" });
  w.tokens.set(TOKEN_A, { uid: "u1", lang: "mn" });
  assert.ok((await runReminders(w.deps)).claimed);
  w.tick(5 * 60_000);
  const second = await runReminders(w.deps);
  assert.equal(second.claimed, false);
  assert.equal(w.sent.length, 1);
  w.tick(24 * 60 * 60_000);
  const third = await runReminders(w.deps);
  assert.ok(third.claimed);
  assert.equal(third.summary.date, "2026-10-15");
  assert.equal(w.sent.length, 2);
});

test("cron: dead tokens are deleted, other failures are only counted", async () => {
  const w = makeReminderWorld();
  w.users.set("u1", { daily: true, competition: false });
  w.children.set("k1", { parentId: "u1", name: "Анар" });
  w.tokens.set(TOKEN_A, { uid: "u1", lang: "mn" });
  w.tokens.set(TOKEN_B, { uid: "u1", lang: "mn" });
  w.tokens.set(TOKEN_C, { uid: "u1", lang: "mn" });
  w.failWith.set(TOKEN_A, "messaging/registration-token-not-registered");
  w.failWith.set(TOKEN_B, "messaging/internal-error");
  const { summary } = await runReminders(w.deps);
  assert.equal(summary.sent, 1);
  assert.equal(summary.failed, 2);
  assert.equal(summary.deletedTokens, 1);
  assert.ok(!w.tokens.has(TOKEN_A));
  assert.ok(w.tokens.has(TOKEN_B));
  assert.ok(w.tokens.has(TOKEN_C));
  assert.equal(summary.notified, 1);
  assert.ok(DEAD_TOKEN_CODES.has("messaging/registration-token-not-registered"));
});

test("cron: users without tokens or children are skipped; teachers (no children) get nothing", async () => {
  const w = makeReminderWorld();
  w.users.set("u1", { daily: true, competition: false });   // parent, no token
  w.children.set("k1", { parentId: "u1", name: "Анар" });
  w.users.set("t1", { daily: true, competition: true });    // teacher: no children docs with parentId
  w.tokens.set(TOKEN_C, { uid: "t1", lang: "mn" });
  const { summary } = await runReminders(w.deps);
  assert.equal(summary.users, 2);
  assert.equal(summary.skippedNoTokens, 1);
  assert.equal(summary.skippedNoChildren, 1);
  assert.equal(w.sent.length, 0);
});

// ---------------------------------------------------------------------------
// goals
// ---------------------------------------------------------------------------

const KIDS = [{ childId: "k1", name: "Анар" }];
const U = { uid: "u", daily: true, competition: true };
const ctx = (goals, stats = null, today = "2026-10-14") => ({ goals, stats, today });

test("plusDays / runKey", () => {
  assert.equal(plusDays("2026-10-14", 7), "2026-10-21");
  assert.equal(plusDays("2026-12-31", 1), "2027-01-01");
  assert.equal(runKey("2026-10-14", "evening"), "2026-10-14");
  assert.equal(runKey("2026-10-14", "morning"), "2026-10-14-morning");
});

test("goal texts in three languages", () => {
  const g = { title: "Хотын аварга", childName: "Анар", days: 43, sessions: 50, daysLeft: 12 };
  assert.equal(goalText("mn", "goalToday", g).body, "Өнөөдөр Хотын аварга! Анар бэлэн.");
  assert.equal(goalText("mn", "goalTomorrow", g).body, "Маргааш Хотын аварга! 43 өдөр бэлтгэсэн — амжилт хүсье.");
  assert.equal(goalText("mn", "goalWeek", g).body, "7 хоногийн дараа Хотын аварга. Одоогоор 50 бэлтгэл.");
  assert.equal(goalText("mn", "goalDaily", g).body, "Хотын аварга хүртэл 12 өдөр — өнөөдрийн бэлтгэлээ тэмдэглэ");
  assert.equal(goalText("en", "goalDaily", g).body, "12 days until Хотын аварга — log today's practice");
  assert.equal(goalText("ru", "goalTomorrow", g).body, "Завтра Хотын аварга! 43 дней подготовки — удачи.");
  assert.equal(goalText("xx", "goalWeek", g).title, "ChampStep");
});

test("evening priority: goal tomorrow > achievement tomorrow > goal in 7 days > goal countdown > plain daily", () => {
  const ev = [{ childId: "k1", title: "Ach" }];
  const gT = { id: "a", childId: "k1", title: "Tomorrow cup", date: "2026-10-15" };
  const gW = { id: "b", childId: "k1", title: "Week cup", date: "2026-10-21" };
  const gL = { id: "c", childId: "k1", title: "Later cup", date: "2026-12-13" };
  assert.equal(decideEvening(U, KIDS, new Set(), ev, ctx([gT, gW, gL], { sessions: 9, days: 7 })).kind, "goalTomorrow");
  const dT = decideEvening(U, KIDS, new Set(), [], ctx([gT], { sessions: 9, days: 7 }));
  assert.equal(dT.days, 7, "tomorrow line carries the practised days");
  assert.equal(decideEvening(U, KIDS, new Set(), ev, ctx([gW, gL], { sessions: 9, days: 7 })).kind, "competition");
  const dW = decideEvening(U, KIDS, new Set(), [], ctx([gW, gL], { sessions: 9, days: 7 }));
  assert.equal(dW.kind, "goalWeek");
  assert.equal(dW.sessions, 9);
  const dD = decideEvening(U, KIDS, new Set(), [], ctx([gL]));
  assert.deepEqual([dD.kind, dD.daysLeft, dD.url], ["goalDaily", 60, "/today"]);
  assert.equal(decideEvening(U, KIDS, new Set(), [], ctx([])).kind, "daily");
});

test("evening: logged today → nothing even with a goal; competition day → nothing; toggles respected", () => {
  const gL = { id: "c", childId: "k1", title: "Later cup", date: "2026-12-13" };
  assert.deepEqual(decideEvening(U, KIDS, new Set(["k1"]), [], ctx([gL])), { kind: "none", reason: "all-logged" });
  assert.deepEqual(decideEvening(U, KIDS, new Set(), [], ctx([{ ...gL, date: "2026-10-14" }])), { kind: "none", reason: "competition-day" });
  // competition off: tomorrow/week lines never fire, countdown still does (daily on)
  assert.equal(decideEvening({ ...U, competition: false }, KIDS, new Set(), [], ctx([{ ...gL, date: "2026-10-15" }, gL])).kind, "goalDaily");
  // daily off: no countdown, no plain daily
  assert.deepEqual(decideEvening({ ...U, daily: false }, KIDS, new Set(), [], ctx([gL])), { kind: "none", reason: "disabled" });
  assert.deepEqual(decideEvening({ uid: "u", daily: false, competition: false }, KIDS, new Set(), [], ctx([gL])), { kind: "none", reason: "disabled" });
});

test("morning: only a goal dated today; any toggle on; nothing otherwise", () => {
  const gToday = { id: "t", childId: "k1", title: "Хотын аварга", date: "2026-10-14" };
  const d = decideMorning({ uid: "u", daily: true, competition: false }, KIDS, [gToday], "2026-10-14");
  assert.deepEqual([d.kind, d.title, d.childName, d.url], ["goalToday", "Хотын аварга", "Анар", "/today"]);
  assert.deepEqual(decideMorning(U, KIDS, [{ ...gToday, date: "2026-10-15" }], "2026-10-14"), { kind: "none", reason: "no-goal-today" });
  assert.deepEqual(decideMorning({ uid: "u", daily: false, competition: false }, KIDS, [gToday], "2026-10-14"), { kind: "none", reason: "disabled" });
  assert.deepEqual(decideMorning(U, [], [gToday], "2026-10-14"), { kind: "none", reason: "no-children" });
});

test("cron: morning slot sends the competition-day push once, evening the same day stays separate (max 2/day)", async () => {
  const w = makeReminderWorld();
  w.users.set("u1", { daily: true, competition: true });
  w.children.set("k1", { parentId: "u1", name: "Анар" });
  w.tokens.set(TOKEN_A, { uid: "u1", lang: "mn" });
  w.goals.push({ id: "g", childId: "k1", title: "Хотын аварга", date: "2026-10-14", status: "active" });
  const m = await runReminders(w.deps, "morning");
  assert.ok(m.claimed);
  assert.equal(m.summary.slot, "morning");
  assert.deepEqual(m.summary.byKind, { ...KINDS, goalToday: 1 });
  assert.equal(w.sent[0].body, "Өнөөдөр Хотын аварга! Анар бэлэн.");
  assert.equal(w.sent[0].url, "/today");
  assert.equal((await runReminders(w.deps, "morning")).claimed, false, "morning is idempotent");
  const e = await runReminders(w.deps, "evening");
  assert.ok(e.claimed, "evening run doc is a different key");
  assert.equal(e.summary.notified, 0, "competition day: no evening nudge");
  assert.equal(w.sent.length, 1);
  assert.ok(w.runs.has("2026-10-14-morning") && w.runs.has("2026-10-14"));
});

test("cron: goal tomorrow uses the goal's own log stats; goal countdown replaces the plain daily", async () => {
  const w = makeReminderWorld();
  w.users.set("u1", { daily: true, competition: true });
  w.children.set("k1", { parentId: "u1", name: "Анар" });
  w.tokens.set(TOKEN_A, { uid: "u1", lang: "mn" });
  w.goals.push({ id: "g", childId: "k1", title: "Хотын аварга", date: "2026-10-15", status: "active" });
  w.goals.push({ id: "done", childId: "k1", title: "Old", date: "2026-10-15", status: "done" });
  w.goalLogs.push({ goalId: "g", date: "2026-10-10" }, { goalId: "g", date: "2026-10-10" }, { goalId: "g", date: "2026-10-12" });
  const r = await runReminders(w.deps);
  assert.deepEqual(r.summary.byKind, { ...KINDS, goalTomorrow: 1 });
  assert.equal(w.sent[0].body, "Маргааш Хотын аварга! 2 өдөр бэлтгэсэн — амжилт хүсье.");

  const w2 = makeReminderWorld();
  w2.users.set("u1", { daily: true, competition: false });
  w2.children.set("k1", { parentId: "u1", name: "Анар" });
  w2.tokens.set(TOKEN_A, { uid: "u1", lang: "en" });
  w2.goals.push({ id: "g", childId: "k1", title: "City cup", date: "2026-12-13", status: "active" });
  const r2 = await runReminders(w2.deps);
  assert.deepEqual(r2.summary.byKind, { ...KINDS, goalDaily: 1 });
  assert.equal(w2.sent[0].body, "60 days until City cup — log today's practice");
});
