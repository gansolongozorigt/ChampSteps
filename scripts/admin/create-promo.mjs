// scripts/admin/create-promo.mjs — create (or refuse to overwrite) a promoCodes document.
//
//   node scripts/admin/create-promo.mjs <CODE> <family|master|coach> <days> <maxUses> [--until YYYY-MM-DD] [--note "text"]
//
// What /api/promo/apply.ts honours TODAY (api/_lib/promo.ts): discountMonths (30-day months),
// maxUses, usedBy, expiresAt, active — and it ALWAYS grants the family plan (PROMO_PLAN).
// This script stores discountMonths = round(days / 30) so the code works now, and also
// stores plan / days so a later server change can honour the requested tier verbatim.
import { Timestamp } from "firebase-admin/firestore";
import { admin, PLAN_IDS } from "./_admin.mjs";

const [codeRaw, plan, daysRaw, maxUsesRaw, ...rest] = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const code = (codeRaw ?? "").trim().toUpperCase();
const days = Number(daysRaw), maxUses = Number(maxUsesRaw);
const until = opt("--until"), note = opt("--note");
if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !PLAN_IDS.includes(plan) || !Number.isInteger(days) || days < 1 || !Number.isInteger(maxUses) || maxUses < 1 || (until && !/^\d{4}-\d{2}-\d{2}$/.test(until))) {
  console.error("usage: node scripts/admin/create-promo.mjs <CODE> <family|master|coach> <days> <maxUses> [--until YYYY-MM-DD] [--note \"text\"]");
  process.exit(2);
}

const { db } = admin();
const ref = db.collection("promoCodes").doc(code);
if ((await ref.get()).exists) { console.error(`promoCodes/${code} already exists — not overwritten`); process.exit(1); }

const doc = {
  code,
  discountMonths: Math.max(1, Math.round(days / 30)),
  plan,
  days,
  maxUses,
  usedBy: [],
  usedCount: 0,
  active: true,
  expiresAt: until ? Timestamp.fromDate(new Date(until + "T23:59:59Z")) : null,
  createdAt: Timestamp.now(),
  createdBy: "scripts/admin/create-promo.mjs",
  ...(note ? { note } : {}),
};
await ref.set(doc);
console.log(JSON.stringify({ created: code, ...doc, createdAt: undefined, expiresAt: doc.expiresAt?.toDate().toISOString() ?? null, grantsToday: `family × ${doc.discountMonths} × 30 days (server PROMO_PLAN)` }, null, 1));
process.exit(0);
