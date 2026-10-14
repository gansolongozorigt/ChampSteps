// api/cron/reminders.ts — daily reminder push (Vercel Cron, vercel.json: 12:00 UTC = 20:00 Ulaanbaatar).
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the env var is set.
// A manual run is the same request (curl with that header). Idempotent per Ulaanbaatar day via
// system/reminderRuns/days/{YYYY-MM-DD}; a second call on the same day answers { skipped: true }.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminReminderDeps } from "../_lib/adminPushDeps.js";
import { isCronAuthorized, runReminders } from "../_lib/push.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: "cron_not_configured" });
  if (!isCronAuthorized(req.headers.authorization, secret)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { claimed, summary } = await runReminders(adminReminderDeps);
    if (!claimed) {
      console.log(`[reminders] ${summary.date}: already ran today, skipped`);
      return res.status(200).json({ skipped: true, date: summary.date });
    }
    // Counts only — never uids or names.
    console.log(`[reminders] ${summary.date}: users=${summary.users} notified=${summary.notified} sent=${summary.sent} failed=${summary.failed} deadTokens=${summary.deletedTokens}`);
    return res.status(200).json({ skipped: false, ...summary });
  } catch (err) {
    console.error("[reminders] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
