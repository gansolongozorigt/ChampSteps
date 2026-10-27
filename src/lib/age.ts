// src/lib/age.ts — child age helpers for the app and the PDF. The logic lives in
// shared/age.js so api/ (AI insight) computes exactly the same age.
export { ageFromBirthDate, formatAge, stripAgeFromBio, bioMentionsAge, ageBioLine, ubDateParts } from "../../shared/age.js";
