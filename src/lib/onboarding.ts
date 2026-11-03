// =============================================================================
// onboarding — "Эхлэх алхмууд" (first steps) for parents. Pure: the steps are
// derived from the data the dashboard already has (no new Firestore fields), so
// accounts that existed before this card see their real progress.
// Steps count across the whole account; dismissal / one-time prompts live in localStorage (per user).
// Tests: tests/onboarding.test.mjs.
// =============================================================================

export type StepId = "child" | "goal" | "practice" | "achievement" | "reminder";

export interface StepInput {
  hasChild: boolean;
  /** Goals in any status (a finished or cancelled goal still counts as "made one"), across the account — see accountStepCounts. */
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

/**
 * The steps are about learning the app, so they count for the whole account: a parent of three who
 * has done each step for one child must not see the card again on the second child.
 * `active` = live counts of the open child, `others` = "exists for another child" (null = not known yet).
 */
export function accountStepCounts(
  active: { goals: number; practiceLogs: number; achievements: number },
  others: { goal: boolean; practice: boolean; achievement: boolean } | null,
): { goals: number; practiceLogs: number; achievements: number } {
  return {
    goals: active.goals + (others?.goal ? 1 : 0),
    practiceLogs: active.practiceLogs + (others?.practice ? 1 : 0),
    achievements: active.achievements + (others?.achievement ? 1 : 0),
  };
}

/**
 * Parent's start tab once per app open (a deep link always wins): with an active goal the daily
 * habit (Practice), otherwise Goals ("what are we preparing for?"). Teachers: unchanged (null).
 */
export function defaultParentTab(opts: { role: string | null | undefined; hasActiveGoal: boolean; deepLinked: boolean }): "practice" | "goals" | null {
  if (opts.role !== "parent" || opts.deepLinked) return null;
  return opts.hasActiveGoal ? "practice" : "goals";
}

// ---- localStorage (every access wrapped: private mode / blocked storage must not break the app) ----

/** Per account. Before 2026-11 the card was closed per child: those keys still count (any child). */
const DISMISS_KEY = (uid: string) => `champstep.firstSteps.dismissed.${uid}`;
const LEGACY_DISMISS_PREFIX = (uid: string) => `champstep.firstSteps.dismissed.${uid}.`;
/** Set the first time every step is seen done: deleting data later must not bring the card back. */
const COMPLETE_KEY = (uid: string) => `champstep.firstSteps.complete.${uid}`;
const REMINDER_ASKED_KEY = (uid: string) => `champstep.firstSteps.reminderAsked.${uid}`;

function read(key: string): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
function write(key: string) {
  try { localStorage.setItem(key, "1"); } catch { /* private mode */ }
}

function anyLegacyDismissed(uid: string): boolean {
  try {
    const prefix = LEGACY_DISMISS_PREFIX(uid);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && localStorage.getItem(k) === "1") return true;
    }
  } catch { /* private mode */ }
  return false;
}
export const firstStepsDismissed = (uid: string) => read(DISMISS_KEY(uid)) || read(COMPLETE_KEY(uid)) || anyLegacyDismissed(uid);
export const dismissFirstSteps = (uid: string) => write(DISMISS_KEY(uid));
export const markFirstStepsComplete = (uid: string) => write(COMPLETE_KEY(uid));
/** "Remind me at 20:00?" is asked once per account per device, after the first practice log. */
export const reminderAsked = (uid: string) => read(REMINDER_ASKED_KEY(uid));
export const markReminderAsked = (uid: string) => write(REMINDER_ASKED_KEY(uid));
