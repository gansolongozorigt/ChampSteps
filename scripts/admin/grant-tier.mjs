// scripts/admin/grant-tier.mjs — give a user a paid tier directly (partner / goodwill),
// without a payment. Mirrors api/_lib/activate.ts subscriptionFields().
//
//   node scripts/admin/grant-tier.mjs <email> <family|master|coach> <days> [--note "text"] [--role parent|teacher]
//
// Writes users/{uid}: subscriptionTier, subscriptionActivatedAt, subscriptionExpiresAt (= now + days),
// subscription { plan, provider: "grant", startedAt, expiresAt, note }, clears expiredFrom/expiredAt,
// optional grantNote and role. No payments document. The previous users doc is saved to
// scratch/grant-backup-<timestamp>.json (gitignored) so the change can be reverted by hand.
import { mkdirSync, writeFileSync } from "node:fs";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { admin, DAY_MS, PLAN_IDS } from "./_admin.mjs";

const [email, tier, daysRaw, ...rest] = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const note = opt("--note");
const role = opt("--role");
const days = Number(daysRaw);
if (!email || !PLAN_IDS.includes(tier) || !Number.isInteger(days) || days < 1 || (role && !["parent", "teacher"].includes(role))) {
  console.error("usage: node scripts/admin/grant-tier.mjs <email> <family|master|coach> <days> [--note \"text\"] [--role parent|teacher]");
  process.exit(2);
}

const { auth, db } = admin();
const user = await auth.getUserByEmail(email);
const ref = db.collection("users").doc(user.uid);
const before = (await ref.get()).data() ?? {};

mkdirSync(new URL("../../scratch/", import.meta.url), { recursive: true });
const backup = new URL(`../../scratch/grant-backup-${Date.now()}.json`, import.meta.url);
writeFileSync(backup, JSON.stringify({ email, uid: user.uid, before }, (k, v) => (v && typeof v.toDate === "function" ? v.toDate().toISOString() : v), 2));

const now = new Date();
const expiresAt = new Date(now.getTime() + days * DAY_MS);
const startTs = Timestamp.fromDate(now), expTs = Timestamp.fromDate(expiresAt);
const update = {
  subscriptionTier: tier,
  subscriptionActivatedAt: startTs,
  subscriptionExpiresAt: expTs,
  expiredFrom: FieldValue.delete(),
  expiredAt: FieldValue.delete(),
  subscription: { plan: tier, provider: "grant", startedAt: startTs, expiresAt: expTs, ...(note ? { note } : {}) },
  updatedAt: FieldValue.serverTimestamp(),
  ...(note ? { grantNote: note } : {}),
  ...(role ? { role } : {}),
};
await ref.set(update, { merge: true });

const after = (await ref.get()).data();
console.log(JSON.stringify({
  email,
  before: { role: before.role, tier: before.subscriptionTier ?? "free", expiresAt: before.subscriptionExpiresAt?.toDate?.().toISOString() ?? null },
  after: { role: after.role, tier: after.subscriptionTier, expiresAt: after.subscriptionExpiresAt.toDate().toISOString(), grantNote: after.grantNote ?? null },
  backup: backup.pathname.replace(/.*\/scratch\//, "scratch/"),
}, null, 1));
process.exit(0);
