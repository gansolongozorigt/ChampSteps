// =============================================================================
// onboarding — "Эхлэх алхмууд" (first steps) for parents. Pure: the steps are
// derived from the data the dashboard already has (no new Firestore fields), so
// accounts that existed before this card see their real progress.
// Dismissal / one-time prompts live in localStorage (per user, per child).
// Tests: tests/onboarding.test.mjs.
// =============================================================================

export type StepId = "child" | "goal" | "practice" | "achievement" | "reminder";

export interface StepInput {
  hasChild: boolean;
  /** Goals of the active child in any status (a finished or cancelled goal still counts as "made one"). */
  goals: number;
  practiceLogs: number;
  achievements: number;
  /** users/{uid}.reminders.daily || .competition; null = unknown yet (still loading). */
  remindersOn: boolean | null;
  /** Guests cannot get push reminders (account only), so that step is left out for them. */
  guest: boolean;
}

export interface Step {
  id: StepId;
  done: boolean;
}

export function firstSteps(s: StepInput): Step[] {
  const steps: Step[] = [
    { id: "child", done: s.hasChild },
    { id: "goal", done: s.goals > 0 },
    { id: "practice", done: s.practiceLogs > 0 },
    { id: "achievement", done: s.achievements > 0 },
  ];
  if (!s.guest) steps.push({ id: "reminder", done: s.remindersOn === true });
  return steps;
}

export function allStepsDone(steps: Step[]): boolean {
  return steps.every((x) => x.done);
}

/** The card is for parents only (teachers have their invite flow), until every step is done or it is closed. */
export function showFirstSteps(opts: { role: string | null | undefined; dismissed: boolean; steps: Step[]; remindersKnown: boolean }): boolean {
  if (opts.role !== "parent" || opts.dismissed) return false;
  // Wait for the reminder state before deciding, so the card does not flash for an account that is done.
  if (!opts.remindersKnown) return false;
  return !allStepsDone(opts.steps);
}

/** Parent opening the app with no practice log yet → start on the Today screen (the daily habit). */
export function preferTodayTab(opts: { role: string | null | undefined; practiceLogs: number; deepLinked: boolean }): boolean {
  return opts.role === "parent" && !opts.deepLinked && opts.practiceLogs === 0;
}

// ---- localStorage (every access wrapped: private mode / blocked storage must not break the app) ----

const DISMISS_KEY = (uid: string, childId: string) => `champstep.firstSteps.dismissed.${uid}.${childId}`;
const REMINDER_ASKED_KEY = (uid: string) => `champstep.firstSteps.reminderAsked.${uid}`;

function read(key: string): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
function write(key: string) {
  try { localStorage.setItem(key, "1"); } catch { /* private mode */ }
}

export const firstStepsDismissed = (uid: string, childId: string) => read(DISMISS_KEY(uid, childId));
export const dismissFirstSteps = (uid: string, childId: string) => write(DISMISS_KEY(uid, childId));
/** "Remind me at 20:00?" is asked once per account per device, after the first practice log. */
export const reminderAsked = (uid: string) => read(REMINDER_ASKED_KEY(uid));
export const markReminderAsked = (uid: string) => write(REMINDER_ASKED_KEY(uid));
