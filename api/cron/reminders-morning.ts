// api/cron/reminders-morning.ts — competition-day push, 00:00 UTC = 08:00 Ulaanbaatar (vercel.json).
// Only users with an active goal dated today get "Өнөөдөр {goal}! {name} бэлэн."; idempotent via
// system/reminderRuns/days/{YYYY-MM-DD}-morning. Same CRON_SECRET as the evening run.
import { makeCronHandler } from "./reminders.js";

export default makeCronHandler("morning");
