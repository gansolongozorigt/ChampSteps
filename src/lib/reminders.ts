// =============================================================================
// reminders — turn the daily 20:00 reminder on from a tap (first-steps prompt).
// Same path as the account settings toggle (ReminderSettings): permission + FCM
// token via enablePush() when this device has none yet, then users/{uid}.reminders.
// =============================================================================

import { currentIdToken, setReminderPrefs, type ReminderPrefs } from "./firebase";
import { enablePush, storedPushToken, type EnableResult } from "./push";

export type ReminderFailure = Extract<EnableResult, { ok: false }>["reason"] | "error";

/** i18n key of the message shown when enabling failed (shared with ReminderSettings). */
export function reminderFailureKey(reason: ReminderFailure): string {
  switch (reason) {
    case "ios-not-installed": return "reminders.installFirst";
    case "denied": return "reminders.denied";
    case "unsupported": return "reminders.unsupported";
    case "not-configured": return "reminders.notConfigured";
    case "permission-dismissed": return "reminders.dismissed";
    default: return "reminders.error";
  }
}

/** Must run from a user gesture. Keeps the competition toggle as it was. */
export async function turnOnDailyReminder(uid: string, lang: string, current: ReminderPrefs | null): Promise<{ ok: true; prefs: ReminderPrefs } | { ok: false; reason: ReminderFailure }> {
  if (!storedPushToken()) {
    const r = await enablePush(currentIdToken, lang);
    if (!r.ok) return r;
  }
  const prefs: ReminderPrefs = { daily: true, competition: current?.competition ?? false };
  try {
    await setReminderPrefs(uid, prefs);
    return { ok: true, prefs };
  } catch (e) {
    console.warn("[reminders] save failed:", e);
    return { ok: false, reason: "error" };
  }
}
