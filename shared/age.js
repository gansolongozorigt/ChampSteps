// shared/age.js — a child's age from Child.birthDate, shared by src/ (app, PDF)
// and api/ (AI insight). Plain JS + age.d.ts so plain Node, Vite and the Vercel
// functions can all import it (same pattern as shared/plans.js).
//
// The age is counted on the calendar date in Ulaanbaatar (UTC+8, no DST), so a
// child turns 12 at 00:00 UB time whatever the device or server timezone is.

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

/** "YYYY-MM-DD" → [y, m, d] when it is a real calendar date, else null. */
function parseYmd(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return [y, mo, d];
}

/** Today's calendar date in Ulaanbaatar as [y, m, d]. */
export function ubDateParts(today = new Date()) {
  const t = today instanceof Date ? today.getTime() : Number(today);
  const ub = new Date(t + UB_OFFSET_MS);
  return [ub.getUTCFullYear(), ub.getUTCMonth() + 1, ub.getUTCDate()];
}

/**
 * Whole years since `birthDate` (YYYY-MM-DD) on today's Ulaanbaatar date.
 * The birthday counts once its (month, day) is reached, so a 29 February child
 * turns a year older on 1 March in a common year. Empty, malformed or future
 * dates (and anything ≥ 120 years) → null.
 */
export function ageFromBirthDate(birthDate, today = new Date()) {
  const b = parseYmd(birthDate);
  if (!b) return null;
  const [y, m, d] = ubDateParts(today);
  let age = y - b[0];
  if (m < b[1] || (m === b[1] && d < b[2])) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** i18n age text: mn "12 настай", en "12 years old" / "1 year old", ru "12 лет" (plural via i18next count). */
export function formatAge(n, t) {
  return t("age.years", { count: n });
}

// An age phrase: "11 настай", "11 нас", "11 years old", "11-year-old", "11 y/o", "11 yo", "11 лет", "1 год", "3 года".
// Must end at a word end (Cyrillic has no \b in JS regexps) — "11 настайгаас" is not an age phrase.
const AGE_PHRASE = "\\d{1,2}\\s*(?:-\\s*)?(?:настай|нас|years?\\s*-?\\s*old|y\\s*\\/\\s*o|y\\.o\\.|yo|лет|года?)";
const END = "(?=$|[\\s·•,.;:!?)\\-–—|/])";
const LEADING_AGE = new RegExp(`^\\s*${AGE_PHRASE}${END}[\\s·•,;:\\-–—|/]*`, "i");
const ANY_AGE = new RegExp(`(?:^|[\\s·•,;:(\\-–—|/])${AGE_PHRASE}${END}`, "i");

/**
 * `bio` without an age phrase at its very start ("11 настай · Бүжиг" → "Бүжиг"),
 * for display only — the stored bio is never changed. Numbers further in stay.
 */
export function stripAgeFromBio(bio) {
  if (typeof bio !== "string") return "";
  const out = bio.replace(LEADING_AGE, "");
  return out === bio ? bio.trim() : out.trim();
}

/** True when the bio mentions an age anywhere ("Шатар · 11 настай") — the profile editor shows a hint. */
export function bioMentionsAge(bio) {
  return typeof bio === "string" && ANY_AGE.test(bio);
}

/** "12 настай · Бүжгийн спорт" — age (when known) + the bio without its leading age; "" when neither. */
export function ageBioLine(child, t, today = new Date()) {
  const age = ageFromBirthDate(child?.birthDate, today);
  const bio = stripAgeFromBio(child?.bio ?? "");
  if (age === null) return (child?.bio ?? "").trim();
  return bio ? `${formatAge(age, t)} · ${bio}` : formatAge(age, t);
}
