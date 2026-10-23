// scripts/admin/metrics.mjs — campaign / weekly metrics from Firestore (Admin SDK, READ-ONLY).
//
//   npm run metrics -- --from 2026-10-20 --to 2026-10-26 [--json scratch/metrics.json] [--quiet]
//
// Dates are Ulaanbaatar calendar days (UTC+8), both ends inclusive. Prints a markdown table
// and, after it, the same numbers as JSON (or writes the JSON to --json). Nothing is written to
// Firestore; no uid / e-mail is printed. Credentials: FIREBASE_SERVICE_ACCOUNT_B64 (env or .env).
//
// Metrics (all "in range" unless noted):
//   signups            users created (by role)            users.createdAt (Timestamp or ISO string → full scan, users are few)
//   guestToSignup      guest trial migrated into account  users.guestMigratedAt (written by the app since marketing-assets)
//   children           children created                   children.createdAt
//   goals              goals created                      goals.createdAt
//   remindersOn        users who turned a reminder on     users.reminders.updatedAt in range AND daily||competition true
//   remindersOnTotal   users with any reminder on now     (all time)
//   practiceLogs       practice entries                   practiceLogs.createdAt  (count() aggregation)
//   achievements       achievements                       achievements.createdAt  (count() aggregation)
//   promoRedeemed      promo activations                  users.subscription.provider == "promo" && subscriptionActivatedAt in range (by code)
//   promoCodes         usedCount per code                 promoCodes (all time, for the campaign ceiling)
//   payments           orders created / paid / MNT        payments.createdAt (paid: status == "paid", amount summed), by plan
import { writeFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { admin } from "./_admin.mjs";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const from = opt("--from"), to = opt("--to"), jsonPath = opt("--json"), quiet = args.includes("--quiet");
if (!DATE_RE.test(from ?? "") || !DATE_RE.test(to ?? "") || from > to) {
  console.error("usage: node scripts/admin/metrics.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--json <file>] [--quiet]");
  process.exit(2);
}

// Ulaanbaatar day boundaries: 00:00 UB = 16:00Z the day before.
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;
const startMs = Date.parse(from + "T00:00:00Z") - UB_OFFSET_MS;
const endMs = Date.parse(to + "T00:00:00Z") - UB_OFFSET_MS + 24 * 60 * 60 * 1000; // exclusive
const start = new Date(startMs), end = new Date(endMs);
const startTs = Timestamp.fromMillis(startMs), endTs = Timestamp.fromMillis(endMs);

/** Firestore Timestamp | Date | ISO string | epoch → ms | null */
function toMs(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object" && typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v === "string" || typeof v === "number") { const t = new Date(v).getTime(); return Number.isNaN(t) ? null : t; }
  return null;
}
const inRange = (v) => { const ms = toMs(v); return ms !== null && ms >= startMs && ms < endMs; };
const bump = (obj, key, by = 1) => { obj[key] = (obj[key] ?? 0) + by; };

const { db } = admin();

async function countCreated(col) {
  const agg = await db.collection(col).where("createdAt", ">=", startTs).where("createdAt", "<", endTs).count().get();
  return agg.data().count;
}

// ---- users: one scan serves signups, guest migrations, reminders and promo activations ----
const users = await db.collection("users").get();
const signups = { total: 0, byRole: {} };
let guestToSignup = 0;
const reminders = { turnedOnInRange: 0, onTotal: 0 };
const promo = { redeemed: 0, byCode: {} };
let usersTotal = 0;
for (const d of users.docs) {
  const u = d.data();
  usersTotal++;
  if (inRange(u.createdAt)) { signups.total++; bump(signups.byRole, u.role ?? "unknown"); }
  if (inRange(u.guestMigratedAt)) guestToSignup++;
  const r = u.reminders;
  const anyOn = !!(r && (r.daily === true || r.competition === true));
  if (anyOn) reminders.onTotal++;
  if (anyOn && inRange(r.updatedAt)) reminders.turnedOnInRange++;
  if (u.subscription?.provider === "promo" && inRange(u.subscriptionActivatedAt)) {
    promo.redeemed++;
    bump(promo.byCode, String(u.subscription.promoCode ?? "?"));
  }
}

// ---- promoCodes: all-time use counters (campaign ceiling) ----
const promoCodes = {};
for (const d of (await db.collection("promoCodes").get()).docs) {
  const p = d.data();
  promoCodes[d.id] = {
    used: Array.isArray(p.usedBy) ? p.usedBy.length : Number(p.usedCount) || 0,
    maxUses: Number(p.maxUses) || 0,
    active: p.active !== false,
    expiresAt: toMs(p.expiresAt) ? new Date(toMs(p.expiresAt)).toISOString().slice(0, 10) : null,
  };
}

// ---- children / goals / logs / achievements (createdAt is a server Timestamp in every writer) ----
const [children, goals, practiceLogs, achievements] = await Promise.all([
  countCreated("children"), countCreated("goals"), countCreated("practiceLogs"), countCreated("achievements"),
]);

// ---- payments ----
const paySnap = await db.collection("payments").where("createdAt", ">=", startTs).where("createdAt", "<", endTs).get();
const payments = { created: 0, paid: 0, paidMnt: 0, byPlan: {} };
for (const d of paySnap.docs) {
  const p = d.data();
  payments.created++;
  if (p.status === "paid") {
    payments.paid++;
    payments.paidMnt += Number(p.amount) || 0;
    const plan = p.appliedAs?.tier ?? p.plan ?? "?";
    payments.byPlan[plan] = payments.byPlan[plan] ?? { paid: 0, mnt: 0 };
    payments.byPlan[plan].paid++;
    payments.byPlan[plan].mnt += Number(p.amount) || 0;
  }
}

const result = {
  range: { from, to, tz: "Asia/Ulaanbaatar", startUtc: start.toISOString(), endUtcExclusive: end.toISOString() },
  generatedAt: new Date().toISOString(),
  signups, guestToSignup, children, goals, reminders, practiceLogs, achievements, promo, promoCodes, payments,
  usersTotal,
};

const fmtRole = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(", ") || "—";
const fmtCodes = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(", ") || "—";
const fmtPlans = (o) => Object.entries(o).map(([k, v]) => `${k} ${v.paid} (${v.mnt.toLocaleString("en-US")}₮)`).join(", ") || "—";
const md = [
  `### ChampStep хэмжилт · ${from} → ${to} (УБ цаг)`,
  "",
  "| Үзүүлэлт | Тоо | Тайлбар |",
  "|---|---:|---|",
  `| Шинэ бүртгэл | ${signups.total} | ${fmtRole(signups.byRole)} |`,
  `| Зочин → бүртгэл | ${guestToSignup} | туршилтын өгөгдлөө бүртгэлд шилжүүлсэн |`,
  `| Үүсгэсэн хүүхэд | ${children} | |`,
  `| Үүсгэсэн зорилго | ${goals} | |`,
  `| Сануулга асаасан хэрэглэгч | ${reminders.turnedOnInRange} | нийт асаалттай: ${reminders.onTotal} |`,
  `| Бэлтгэлийн бичлэг | ${practiceLogs} | |`,
  `| Амжилт | ${achievements} | |`,
  `| Промо ашигласан | ${promo.redeemed} | ${fmtCodes(promo.byCode)} |`,
  `| Төлбөр (захиалга / төлсөн) | ${payments.created} / ${payments.paid} | ${payments.paidMnt.toLocaleString("en-US")}₮ · ${fmtPlans(payments.byPlan)} |`,
  "",
  `Промо кодын нийт хэрэглээ (бүх цаг): ${Object.entries(promoCodes).map(([c, v]) => `${c} ${v.used}/${v.maxUses || "∞"}${v.active ? "" : " (идэвхгүй)"}`).join(", ") || "—"}`,
  `Нийт хэрэглэгч: ${usersTotal}`,
].join("\n");

if (!quiet) console.log(md);
if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  if (!quiet) console.log(`\nJSON → ${jsonPath}`);
} else {
  console.log((quiet ? "" : "\n") + JSON.stringify(result, null, 2));
}
process.exit(0);
