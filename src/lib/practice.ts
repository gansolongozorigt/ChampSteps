// =============================================================================
// practice — pure helpers for practice logs (no React, no Firebase).
// A log has the old "what did you do" note (content) plus three optional
// questions the child answers: wentWell / toImprove / learned.
// Unit tests: tests/practice.test.mjs.
// =============================================================================

import { PRACTICE_TEXT_MAX, type PracticeLog } from "../types";

/** The three reflection questions, in the order the form asks them. */
export const PRACTICE_QUESTIONS = ["wentWell", "toImprove", "learned"] as const;
export type PracticeQuestion = (typeof PRACTICE_QUESTIONS)[number];

export interface PracticeDraft {
  date: string;
  duration: number;
  content: string;
  goalId?: string;
  wentWell?: string;
  toImprove?: string;
  learned?: string;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Save needs at least one non-empty text: the note or any of the three answers. */
export function hasPracticeText(d: Partial<Pick<PracticeLog, "content" | PracticeQuestion>>): boolean {
  return [d.content, ...PRACTICE_QUESTIONS.map((k) => d[k])].some((v) => clean(v).length > 0);
}

/**
 * What gets written: trimmed texts, empty answers left out (never `undefined` — Firestore rejects it),
 * `content` always a string so older app versions keep rendering the entry.
 */
export function buildPracticeLog(d: PracticeDraft): Omit<PracticeLog, "id" | "childId" | "createdAt"> {
  const out: Omit<PracticeLog, "id" | "childId" | "createdAt"> = {
    date: d.date,
    duration: d.duration,
    content: clean(d.content),
  };
  if (d.goalId) out.goalId = d.goalId;
  for (const k of PRACTICE_QUESTIONS) {
    const v = clean(d[k]).slice(0, PRACTICE_TEXT_MAX);
    if (v) out[k] = v;
  }
  return out;
}

/** Answered questions of a log, in form order (empty ones are not shown). */
export function answeredQuestions(log: Partial<Pick<PracticeLog, PracticeQuestion>>): { key: PracticeQuestion; text: string }[] {
  return PRACTICE_QUESTIONS.map((key) => ({ key, text: clean(log[key]) })).filter((x) => x.text.length > 0);
}

/** One line for a practice entry where only a single text fits (PDF): the note, else learned, else wentWell. */
export function practiceNoteText(log: Partial<Pick<PracticeLog, "content" | PracticeQuestion>>): string {
  return clean(log.content) || clean(log.learned) || clean(log.wentWell);
}
