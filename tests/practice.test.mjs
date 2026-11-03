// node --import tsx --test tests/practice.test.mjs — practice log helpers (src/lib/practice.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { answeredQuestions, buildPracticeLog, hasPracticeText, practiceNoteText } from "../src/lib/practice.ts";

const d = { date: "2026-11-04", duration: 30, content: "" };

test("save needs at least one text: the note or any of the three answers", () => {
  assert.equal(hasPracticeText(d), false);
  assert.equal(hasPracticeText({ ...d, content: "   " }), false);
  assert.equal(hasPracticeText({ ...d, content: "Давтсан" }), true);
  assert.equal(hasPracticeText({ ...d, wentWell: "Эргэлт" }), true);
  assert.equal(hasPracticeText({ ...d, toImprove: " x " }), true);
  assert.equal(hasPracticeText({ ...d, learned: "Алхам" }), true);
});

test("buildPracticeLog: trimmed, empty answers and goalId left out, content always a string, 300 cap", () => {
  const out = buildPracticeLog({ ...d, content: "  Давтсан ", wentWell: " Эргэлт ", toImprove: "  ", learned: "я".repeat(320) });
  assert.deepEqual(Object.keys(out).sort(), ["content", "date", "duration", "learned", "wentWell"]);
  assert.equal(out.content, "Давтсан");
  assert.equal(out.wentWell, "Эргэлт");
  assert.equal(out.learned.length, 300);
  const onlyAnswer = buildPracticeLog({ ...d, goalId: "g1", learned: "Шинэ" });
  assert.equal(onlyAnswer.content, "", "older app versions still render the entry");
  assert.equal(onlyAnswer.goalId, "g1");
  assert.equal(Object.values(onlyAnswer).includes(undefined), false, "never undefined (Firestore rejects it)");
});

test("history shows only answered questions, in form order", () => {
  assert.deepEqual(answeredQuestions({ learned: "L", wentWell: "W", toImprove: " " }), [{ key: "wentWell", text: "W" }, { key: "learned", text: "L" }]);
  assert.deepEqual(answeredQuestions({}), [], "old log: nothing extra");
});

test("one-line text (PDF): note, else learned, else wentWell", () => {
  assert.equal(practiceNoteText({ content: "Тэмдэглэл", learned: "L", wentWell: "W" }), "Тэмдэглэл");
  assert.equal(practiceNoteText({ content: "", learned: "L", wentWell: "W" }), "L");
  assert.equal(practiceNoteText({ content: "", wentWell: "W" }), "W");
  assert.equal(practiceNoteText({ content: "", toImprove: "I" }), "");
});
