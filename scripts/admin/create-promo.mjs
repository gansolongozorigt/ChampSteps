// scripts/admin/create-promo.mjs — create (or refuse to overwrite) a promoCodes document.
//
//   node scripts/admin/create-promo.mjs <CODE> <family|master|coach> <days> <maxUses> [--until YYYY-MM-DD] [--note "text"]
//
// /api/promo/apply.ts (api/_lib/promo.ts) honours plan + days verbatim (since 2026-10-13);
// discountMonths = round(days / 30) is stored too so the legacy admin UI list still reads it.
// Redeem rules (unit-tested in tests/promo.test.mjs): active, not past expiresAt, uid not in
// usedBy, usedBy.length < maxUses (0 = unlimited); the grant goes through the same
// subscription math as QPay (downgrade refused, same tier extends, higher tier credits days).
//
// Campaign code EHLEL2026 (family × 30 days, 100 uses, until 2026-11-30):
//   node scripts/admin/create-promo.mjs EHLEL2026 family 30 100 --until 2026-11-30 --note "Эхлэл 2026 campaign"
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
console.log(JSON.stringify({ created: code, ...doc, createdAt: undefined, expiresAt: doc.expiresAt?.toDate().toISOString() ?? null, grants: `${plan} × ${days} days` }, null, 1));
process.exit(0);
