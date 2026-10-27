// scripts/admin/metrics.mjs — campaign / weekly metrics from Firestore (Admin SDK, READ-ONLY).
//
//   npm run metrics -- --from 2026-10-20 --to 2026-10-26 [--json scratch/metrics.json] [--quiet]
//
// Dates are Ulaanbaatar calendar days (UTC+8), both ends inclusive. Prints a markdown table
// and, after it, the same numbers as JSON (or writes the JSON to --json). Nothing is written to
// Firestore; no uid / e-mail is printed. Credentials: FIREBASE_SERVICE_ACCOUNT_B64 (env or .env).
//
// Owner / admin accounts are left out of every number: METRICS_EXCLUDE (env or .env) is a comma-separated
// list of e-mails and/or uids. Their users docs, children, and everything made for those children are
// skipped; the report says only how many accounts were excluded.
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
//   funnel             users who reached each first step  sign-up → child → goal → practice → achievement → reminder,
//                      counted per USER (≥1 of each, any time) for the accounts that signed up in range and for all
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

const { db, auth } = admin();

// ---- excluded accounts (METRICS_EXCLUDE, resolved after admin() has loaded .env) ----
const excludeList = (process.env.METRICS_EXCLUDE ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const excluded = new Set();
for (const id of excludeList) {
  try {
    excluded.add(id.includes("@") ? (await auth.getUserByEmail(id)).uid : (await auth.getUser(id)).uid);
  } catch {
    console.error(`METRICS_EXCLUDE: entry #${excludeList.indexOf(id) + 1} not found, ignored`);
  }
}
const excludedChildIds = [];
for (const uid of excluded) {
  for (const d of (await db.collection("children").where("parentId", "==", uid).get()).docs) excludedChildIds.push(d.id);
}

/** createdAt-in-range count minus the docs that belong to excluded accounts' children. */
async function countCreated(col) {
  const agg = await db.collection(col).where("createdAt", ">=", startTs).where("createdAt", "<", endTs).count().get();
  let minus = 0;
  // "in" takes ≤30 values; range is checked in memory so no composite index is needed (excluded data is small)
  for (let i = 0; i < excludedChildIds.length; i += 30) {
    const snap = await db.collection(col).where("childId", "in", excludedChildIds.slice(i, i + 30)).get();
    minus += snap.docs.filter((d) => inRange(d.get("createdAt"))).length;
  }
  return agg.data().count - minus;
}

// ---- users: one scan serves signups, guest migrations, reminders and promo activations ----
const users = await db.collection("users").get();
const signups = { total: 0, byRole: {} };
let guestToSignup = 0;
const reminders = { turnedOnInRange: 0, onTotal: 0 };
const cohort = new Set(), everyone = new Set(), reminderUsers = new Set();
const promo = { redeemed: 0, byCode: {} };
let usersTotal = 0;
for (const d of users.docs) {
  if (excluded.has(d.id)) continue;
  const u = d.data();
  usersTotal++;
  everyone.add(d.id);
  if (inRange(u.createdAt)) { signups.total++; bump(signups.byRole, u.role ?? "unknown"); cohort.add(d.id); }
  if (inRange(u.guestMigratedAt)) guestToSignup++;
  const r = u.reminders;
  const anyOn = !!(r && (r.daily === true || r.competition === true));
  if (anyOn) { reminders.onTotal++; reminderUsers.add(d.id); }
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

// ---- funnel: per user, from the owner of each child (collections are small → full scans) ----
const parentOf = new Map();
for (const d of (await db.collection("children").get()).docs) parentOf.set(d.id, d.get("parentId"));
async function ownersOf(col) {
  const owners = new Set();
  for (const d of (await db.collection(col).get()).docs) { const p = parentOf.get(d.get("childId")); if (p) owners.add(p); }
  return owners;
}
const [goalOwners, logOwners, achOwners] = await Promise.all([ownersOf("goals"), ownersOf("practiceLogs"), ownersOf("achievements")]);
const childOwners = new Set(parentOf.values());
const FUNNEL = [["signup", null], ["child", childOwners], ["goal", goalOwners], ["practice", logOwners], ["achievement", achOwners], ["reminder", reminderUsers]];
const funnelOf = (base) => Object.fromEntries(FUNNEL.map(([k, set]) => [k, set ? [...base].filter((uid) => set.has(uid)).length : base.size]));
const funnel = { cohort: funnelOf(cohort), all: funnelOf(everyone) };

// ---- payments ----
const paySnap = await db.collection("payments").where("createdAt", ">=", startTs).where("createdAt", "<", endTs).get();
const payments = { created: 0, paid: 0, paidMnt: 0, byPlan: {} };
for (const d of paySnap.docs) {
  const p = d.data();
  if (excluded.has(p.uid)) continue;
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
  signups, guestToSignup, children, goals, reminders, practiceLogs, achievements, promo, promoCodes, payments, funnel,
  usersTotal,
  excludedAccounts: excluded.size,
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
  `Хассан: ${excluded.size} бүртгэл (эзэмшигч/админ, METRICS_EXCLUDE)`,
  "",
  "#### Эхний алхмууд (хэрэглэгчийн тоо, ≥1 удаа, бүх цаг)",
  "",
  `| Алхам | Энэ хугацаанд бүртгүүлсэн (${funnel.cohort.signup}) | Бүх хэрэглэгч (${funnel.all.signup}) |`,
  "|---|---:|---:|",
  ...[["signup", "Бүртгэл"], ["child", "Хүүхэд нэмсэн"], ["goal", "Зорилго тавьсан"], ["practice", "Бэлтгэл бичсэн"], ["achievement", "Амжилт нэмсэн"], ["reminder", "Сануулга асаасан"]]
    .map(([k, label]) => `| ${label} | ${funnel.cohort[k]} | ${funnel.all[k]} |`),
].join("\n");

if (!quiet) console.log(md);
if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  if (!quiet) console.log(`\nJSON → ${jsonPath}`);
} else {
  console.log((quiet ? "" : "\n") + JSON.stringify(result, null, 2));
}
process.exit(0);
