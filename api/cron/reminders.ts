// api/cron/reminders.ts — evening reminder push (Vercel Cron, vercel.json: 12:00 UTC = 20:00 Ulaanbaatar).
// api/cron/reminders-morning.ts reuses makeCronHandler("morning") for the competition-day push (00:00 UTC = 08:00 UB).
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the env var is set.
// A manual run is the same request (curl with that header). Idempotent per Ulaanbaatar day via
// system/reminderRuns/days/{YYYY-MM-DD}; a second call on the same day answers { skipped: true }.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminReminderDeps } from "../_lib/adminPushDeps.js";
import { isCronAuthorized, runReminders, type RunSlot } from "../_lib/push.js";

export function makeCronHandler(slot: RunSlot) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: "cron_not_configured" });
  if (!isCronAuthorized(req.headers.authorization, secret)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { claimed, summary } = await runReminders(adminReminderDeps, slot);
    if (!claimed) {
      console.log(`[reminders:${slot}] ${summary.date}: already ran, skipped`);
      return res.status(200).json({ skipped: true, date: summary.date, slot });
    }
    // Counts only — never uids or names.
    console.log(`[reminders:${slot}] ${summary.date}: users=${summary.users} notified=${summary.notified} sent=${summary.sent} failed=${summary.failed} deadTokens=${summary.deletedTokens} byKind=${JSON.stringify(summary.byKind)}`);
    return res.status(200).json({ skipped: false, ...summary });
  } catch (err) {
    console.error(`[reminders:${slot}] error:`, err);
    return res.status(500).json({ error: "Internal server error" });
  }
  };
}

/** Evening run — vercel.json cron "0 12 * * *" (20:00 Ulaanbaatar). */
export default makeCronHandler("evening");
