// node --test tests/age.test.mjs — child age from birthDate (Ulaanbaatar date) + bio age stripping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageFromBirthDate, formatAge, stripAgeFromBio, bioMentionsAge, ageBioLine } from "../src/lib/age.ts";
import { makeT } from "./helpers/pdf-fixtures.mjs";

const at = (iso) => new Date(iso);

test("ageFromBirthDate: day before / on / after the birthday (UB noon)", () => {
  assert.equal(ageFromBirthDate("2014-07-20", at("2026-07-19T04:00:00Z")), 11, "day before");
  assert.equal(ageFromBirthDate("2014-07-20", at("2026-07-20T04:00:00Z")), 12, "birthday");
  assert.equal(ageFromBirthDate("2014-07-20", at("2026-07-21T04:00:00Z")), 12, "day after");
  assert.equal(ageFromBirthDate("2014-07-20", at("2026-10-21T04:00:00Z")), 12, "Үүлэн today");
  assert.equal(ageFromBirthDate("2026-10-21", at("2026-10-21T04:00:00Z")), 0, "born today");
});

test("ageFromBirthDate: UB midnight decides, not UTC or the device timezone", () => {
  // 2026-07-19T17:00Z = 2026-07-20 01:00 in Ulaanbaatar → already 12
  assert.equal(ageFromBirthDate("2014-07-20", at("2026-07-19T17:00:00Z")), 12);
  assert.equal(ageFromBirthDate("2014-07-20", at("2026-07-19T16:00:00Z")), 12, "UB 00:00 exactly");
  assert.equal(ageFromBirthDate("2014-07-20", at("2026-07-19T15:59:59Z")), 11, "UB 23:59:59 the day before");
  assert.equal(ageFromBirthDate("2014-07-20", Date.parse("2026-07-19T17:00:00Z")), 12, "epoch ms accepted");
});

test("ageFromBirthDate: 29 February birthday counts on 1 March in a common year", () => {
  assert.equal(ageFromBirthDate("2016-02-29", at("2027-02-28T04:00:00Z")), 10);
  assert.equal(ageFromBirthDate("2016-02-29", at("2027-03-01T04:00:00Z")), 11);
  assert.equal(ageFromBirthDate("2016-02-29", at("2028-02-29T04:00:00Z")), 12, "leap year: on the day");
  assert.equal(ageFromBirthDate("2016-02-29", at("2028-02-28T04:00:00Z")), 11);
});

test("ageFromBirthDate: empty, malformed, impossible and future dates → null", () => {
  const now = at("2026-10-21T04:00:00Z");
  for (const bad of ["", "   ", "2014-7-20", "20.07.2014", "2014-02-30", "2015-02-29", "2014-13-01", "nope", null, undefined, 20140720]) {
    assert.equal(ageFromBirthDate(bad, now), null, String(bad));
  }
  assert.equal(ageFromBirthDate("2026-10-22", now), null, "tomorrow");
  assert.equal(ageFromBirthDate("2030-01-01", now), null, "future year");
  assert.equal(ageFromBirthDate("1890-01-01", now), null, "≥ 120");
});

test("formatAge: mn / en (1 year old) / ru plurals", () => {
  const mn = makeT("mn"), en = makeT("en"), ru = makeT("ru");
  assert.equal(formatAge(12, mn), "12 настай");
  assert.equal(formatAge(1, mn), "1 настай");
  assert.equal(formatAge(1, en), "1 year old");
  assert.equal(formatAge(12, en), "12 years old");
  assert.equal(formatAge(0, en), "0 years old");
  assert.equal(formatAge(1, ru), "1 год");
  assert.equal(formatAge(21, ru), "21 год");
  assert.equal(formatAge(3, ru), "3 года");
  assert.equal(formatAge(12, ru), "12 лет");
  assert.equal(formatAge(5, ru), "5 лет");
});

test("stripAgeFromBio: leading age phrase + separator removed, nothing else touched", () => {
  assert.equal(stripAgeFromBio("11 настай · Бүжиг"), "Бүжиг");
  assert.equal(stripAgeFromBio("11 настай, шатар"), "шатар");
  assert.equal(stripAgeFromBio("Шатар, 11 настайгаас хойш"), "Шатар, 11 настайгаас хойш");
  assert.equal(stripAgeFromBio("12 years old - violin"), "violin");
  assert.equal(stripAgeFromBio("11 настай · Бүжгийн спорт, Хийл хөгжим"), "Бүжгийн спорт, Хийл хөгжим");
  assert.equal(stripAgeFromBio("11 нас, хөл бөмбөг"), "хөл бөмбөг");
  assert.equal(stripAgeFromBio("11 y/o · loves chess"), "loves chess");
  assert.equal(stripAgeFromBio("11-year-old, violin"), "violin");
  assert.equal(stripAgeFromBio("11 лет · шахматы"), "шахматы");
  assert.equal(stripAgeFromBio("3 года — плавание"), "плавание");
  assert.equal(stripAgeFromBio("11 настай"), "");
  assert.equal(stripAgeFromBio("11 настайгаас хойш шатар"), "11 настайгаас хойш шатар", "no word end → not an age");
  assert.equal(stripAgeFromBio("11 years of chess"), "11 years of chess");
  assert.equal(stripAgeFromBio("5-р анги · хөл бөмбөг"), "5-р анги · хөл бөмбөг");
  assert.equal(stripAgeFromBio("2014 онд төрсөн"), "2014 онд төрсөн");
  assert.equal(stripAgeFromBio(""), "");
  assert.equal(stripAgeFromBio(undefined), "");
});

test("bioMentionsAge: anywhere in the bio, word end required", () => {
  assert.equal(bioMentionsAge("11 настай · Бүжиг"), true);
  assert.equal(bioMentionsAge("Бүжиг · 11 настай"), true);
  assert.equal(bioMentionsAge("Шатар, 11 настайгаас хойш"), false);
  assert.equal(bioMentionsAge("бүжгийн спорт, хийл; шатарт дуртай"), false);
  assert.equal(bioMentionsAge(""), false);
});

test("ageBioLine: age · stripped bio; age only; bio as typed without a birth date", () => {
  const t = makeT("mn");
  const now = at("2026-10-21T04:00:00Z");
  assert.equal(ageBioLine({ birthDate: "2014-07-20", bio: "11 настай · Бүжгийн спорт, Хийл хөгжим" }, t, now), "12 настай · Бүжгийн спорт, Хийл хөгжим");
  assert.equal(ageBioLine({ birthDate: "2014-07-20", bio: "" }, t, now), "12 настай");
  assert.equal(ageBioLine({ birthDate: "2014-07-20", bio: "11 настай" }, t, now), "12 настай");
  assert.equal(ageBioLine({ birthDate: "", bio: "11 настай · Бүжиг" }, t, now), "11 настай · Бүжиг");
  assert.equal(ageBioLine({ birthDate: "", bio: "" }, t, now), "");
});
