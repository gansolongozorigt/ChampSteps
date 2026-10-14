// Unit tests for the prompt builder / cache / ownership helpers behind
// /api/ai-insight (api/_lib/aiInsight.ts).  node --test tests/ai-insight-prompt.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_TTL_MS,
  DEFAULT_MODEL,
  HEADINGS,
  MAX_ACHIEVEMENTS,
  MAX_TOKENS,
  TEMPERATURE,
  anthropicRequestBody,
  buildInsightInput,
  buildSystemPrompt,
  childAge,
  computeDataHash,
  extractText,
  isCacheFresh,
  isGen5Model,
  normalizeLanguage,
  resolveChildAccess,
  resolveModel,
} from "../api/_lib/aiInsight.ts";

const NOW = Date.parse("2026-10-08T00:00:00Z");
const A = "child_A", B = "child_B";
const PARENT = "parent_1", TEACHER = "teacher_1", OTHER = "other_1";
const childA = { childId: A, parentId: PARENT, teacherIds: [TEACHER], name: "Үүлэн", birthDate: "2017-03-15", bio: "шатар, зураг" };
const childB = { childId: B, parentId: PARENT, teacherIds: [], name: "Анар", birthDate: "2020-01-01" };

// Mixed list — exactly what a buggy caller might hand over.
const achievements = [
  { id: "a1", childId: A, title: "ALPHA Chess Cup", date: "2026-09-20", category: "Academic", awardType: "Gold", location: "Улаанбаатар", updatedAt: 1000 },
  { id: "a2", childId: A, title: "Alpha Art Show", date: "2026-08-01", category: "Arts", awardType: "Participant", createdAt: 900 },
  { id: "b1", childId: B, title: "BETA Swim Meet", date: "2026-09-25", category: "Sports", awardType: "Silver", updatedAt: 1100 },
];
const practiceLogs = [
  { id: "p1", childId: A, date: "2026-10-01", duration: 30, createdAt: 50 },
  { id: "p2", childId: A, date: "2026-08-01", duration: 20, createdAt: 40 },
  { id: "p3", childId: B, date: "2026-10-02", duration: 45, createdAt: 60 },
];

test("buildInsightInput: only the selected child's documents reach the prompt", () => {
  const input = buildInsightInput({ childId: A, child: childA, achievements, practiceLogs, reflectionsCount: 2, language: "mn", now: NOW });
  assert.equal(input.child.name, "Үүлэн");
  assert.equal(input.child.age, 9);
  assert.equal(input.child.interests, "шатар, зураг");
  assert.deepEqual(input.achievements.map((a) => a.title), ["ALPHA Chess Cup", "Alpha Art Show"], "newest first, no child B");
  assert.ok(!JSON.stringify(input).includes("BETA"), "child B's achievement must not appear");
  assert.deepEqual(input.achievements[0], { date: "2026-09-20", title: "ALPHA Chess Cup", category: "Academic", award: "Gold", place: "Улаанбаатар" });
  assert.deepEqual(input.practiceLogs, { count: 2, last30Days: 1, lastDate: "2026-10-01" });
  assert.equal(input.reflectionsCount, 2);
  assert.equal(input.language, "mn");

  const inputB = buildInsightInput({ childId: B, child: childB, achievements, practiceLogs, language: "en", now: NOW });
  assert.deepEqual(inputB.achievements.map((a) => a.title), ["BETA Swim Meet"]);
  assert.ok(!JSON.stringify(inputB).includes("ALPHA"));
  assert.equal(inputB.practiceLogs.count, 1);
  assert.equal("reflectionsCount" in inputB, false, "teacher/no-count: field omitted");
  assert.equal(inputB.child.interests, null);
});

test("buildInsightInput: caps at 30 newest achievements; empty data is explicit", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, childId: A, title: `T${i}`, date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`, category: "Sports", awardType: "Gold" }));
  const input = buildInsightInput({ childId: A, child: childA, achievements: many, practiceLogs: [], language: "mn", now: NOW });
  assert.equal(input.achievements.length, MAX_ACHIEVEMENTS);
  assert.equal(input.achievements[0].date, "2025-01-28");
  assert.deepEqual(input.practiceLogs, { count: 0, last30Days: 0, lastDate: null });
  const empty = buildInsightInput({ childId: A, child: { name: "X" }, achievements: [], practiceLogs: [], language: "ru", now: NOW });
  assert.deepEqual(empty.achievements, []);
  assert.equal(empty.child.age, null);
});

test("childAge / normalizeLanguage", () => {
  assert.equal(childAge("2017-03-15", NOW), 9);
  assert.equal(childAge("2017-10-09", NOW), 8, "birthday tomorrow → not yet 9");
  assert.equal(childAge("2017-10-08", NOW), 9, "birthday today");
  assert.equal(childAge("", NOW), null);
  assert.equal(childAge("nope", NOW), null);
  assert.equal(childAge(undefined, NOW), null);
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("ru"), "ru");
  assert.equal(normalizeLanguage("mn-MN"), "mn");
  assert.equal(normalizeLanguage(undefined), "mn");
  assert.equal(normalizeLanguage("fr"), "mn");
});

test("resolveChildAccess: owner / teacher / stranger (→ 403 in the handler)", () => {
  assert.equal(resolveChildAccess(childA, PARENT), "owner");
  assert.equal(resolveChildAccess(childA, TEACHER), "teacher");
  assert.equal(resolveChildAccess(childA, OTHER), null);
  assert.equal(resolveChildAccess(childB, TEACHER), null, "not in this child's teacherIds");
  assert.equal(resolveChildAccess({ childId: "legacy", parentId: PARENT }, TEACHER), null, "missing teacherIds → no teacher");
  assert.equal(resolveChildAccess({ childId: "legacy", parentId: PARENT }, PARENT), "owner");
  assert.equal(resolveChildAccess(undefined, PARENT), null);
  assert.equal(resolveChildAccess(childA, ""), null);
});

test("computeDataHash: per child, order-independent, changes with edits", () => {
  const h = computeDataHash({ childId: A, child: childA, achievements, practiceLogs });
  const hShuffled = computeDataHash({ childId: A, child: childA, achievements: [...achievements].reverse(), practiceLogs: [...practiceLogs].reverse() });
  assert.equal(h, hShuffled);
  assert.match(h, /^[0-9a-f]{32}$/);
  // child B's docs do not influence child A's hash
  const hNoB = computeDataHash({ childId: A, child: childA, achievements: achievements.filter((a) => a.childId === A), practiceLogs: practiceLogs.filter((p) => p.childId === A) });
  assert.equal(h, hNoB);
  assert.notEqual(h, computeDataHash({ childId: B, child: childB, achievements, practiceLogs }));
  // an edit (updatedAt), a new log, or a rename changes it
  const edited = achievements.map((a) => (a.id === "a1" ? { ...a, updatedAt: 2000 } : a));
  assert.notEqual(h, computeDataHash({ childId: A, child: childA, achievements: edited, practiceLogs }));
  assert.notEqual(h, computeDataHash({ childId: A, child: childA, achievements, practiceLogs: [...practiceLogs, { id: "p9", childId: A, date: "2026-10-05" }] }));
  assert.notEqual(h, computeDataHash({ childId: A, child: { ...childA, name: "Өөр" }, achievements, practiceLogs }));
  // Firestore Timestamp-like updatedAt is understood
  const ts = achievements.map((a) => (a.id === "a1" ? { ...a, updatedAt: { toMillis: () => 1000 } } : a));
  assert.equal(h, computeDataHash({ childId: A, child: childA, achievements: ts, practiceLogs }));
});

test("isCacheFresh: same hash + language + < 24h", () => {
  const cached = { text: "ok", dataHash: "h1", language: "mn", createdAt: NOW - 1000 };
  assert.equal(isCacheFresh(cached, "h1", "mn", NOW), true);
  assert.equal(isCacheFresh(cached, "h2", "mn", NOW), false, "data changed");
  assert.equal(isCacheFresh(cached, "h1", "en", NOW), false, "other language");
  assert.equal(isCacheFresh({ ...cached, createdAt: NOW - CACHE_TTL_MS }, "h1", "mn", NOW), false, "24h old");
  assert.equal(isCacheFresh({ ...cached, createdAt: NOW - CACHE_TTL_MS + 1 }, "h1", "mn", NOW), true);
  assert.equal(isCacheFresh({ ...cached, createdAt: { toMillis: () => NOW - 5 } }, "h1", "mn", NOW), true);
  assert.equal(isCacheFresh({ ...cached, text: "" }, "h1", "mn", NOW), false);
  assert.equal(isCacheFresh({ ...cached, createdAt: undefined }, "h1", "mn", NOW), false);
  assert.equal(isCacheFresh(undefined, "h1", "mn", NOW), false);
});

test("system prompt: parent-facing, 3 headings, output language per request", () => {
  const mn = buildSystemPrompt("mn");
  for (const h of HEADINGS.mn) assert.ok(mn.includes(h), h);
  assert.ok(mn.includes("гуравдугаар биеэр"));
  assert.ok(mn.includes("120 үгээс"));
  assert.ok(mn.includes("\"сайхан\""));
  assert.ok(mn.endsWith("Хариултыг зөвхөн монгол хэлээр бич."));
  const en = buildSystemPrompt("en");
  assert.ok(en.includes("Strengths / Observations / Next steps"));
  assert.ok(en.includes("англи хэлээр"));
  const ru = buildSystemPrompt("ru");
  assert.ok(ru.includes("Сильные стороны / Наблюдения / Следующие шаги"));
  // the stable part (everything before the language line) is identical across languages → cacheable prefix
  const stable = (s) => s.slice(0, s.lastIndexOf("Гаралтын хэл:"));
  assert.equal(stable(mn), stable(en));
  assert.equal(stable(mn), stable(ru));
});

test("request body: default Sonnet, max_tokens 600, model-aware sampling, env override", () => {
  assert.equal(DEFAULT_MODEL, "claude-sonnet-5-5");
  assert.equal(MAX_TOKENS, 600);
  assert.equal(TEMPERATURE, 0.4);
  assert.equal(resolveModel({}), DEFAULT_MODEL);
  assert.equal(resolveModel({ AI_INSIGHT_MODEL: " claude-sonnet-4-6 " }), "claude-sonnet-4-6");
  assert.equal(resolveModel({ AI_INSIGHT_MODEL: "bad model!" }), DEFAULT_MODEL);
  assert.equal(isGen5Model("claude-sonnet-5-5"), true);
  assert.equal(isGen5Model("claude-opus-5"), true);
  assert.equal(isGen5Model("claude-sonnet-4-6"), false);
  assert.equal(isGen5Model("claude-haiku-4-5"), false);

  const input = buildInsightInput({ childId: A, child: childA, achievements, practiceLogs, language: "mn", now: NOW });
  const sonnet = anthropicRequestBody("claude-sonnet-5-5", "mn", input);
  assert.equal(sonnet.model, "claude-sonnet-5-5");
  assert.equal(sonnet.max_tokens, 600);
  assert.deepEqual(sonnet.thinking, { type: "between_tools" });
  assert.equal("temperature" in sonnet, false, "5.x rejects non-default sampling");
  assert.equal(sonnet.system[0].cache_control.type, "ephemeral");
  assert.equal(sonnet.messages[0].role, "user");
  const sent = JSON.parse(sonnet.messages[0].content);
  assert.deepEqual(sent, input);
  assert.ok(!sonnet.messages[0].content.includes("BETA"));

  const opus = anthropicRequestBody("claude-opus-5-5", "mn", input);
  assert.deepEqual(opus.output_config, { effort: "low" });
  assert.equal("thinking" in opus, false);
  assert.equal("temperature" in opus, false);

  const legacy = anthropicRequestBody("claude-sonnet-4-6", "en", input);
  assert.equal(legacy.temperature, 0.4);
  assert.equal("thinking" in legacy, false);
  assert.ok(legacy.system[0].text.includes("Strengths"));
});

test("extractText: text blocks by type, never by position", () => {
  assert.equal(extractText({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: "Давуу тал\nA" }, { type: "text", text: "B" }] }), "Давуу тал\nA\nB");
  assert.equal(extractText({ content: [] }), "");
  assert.equal(extractText(undefined), "");
});
