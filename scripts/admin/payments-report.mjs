// scripts/admin/payments-report.mjs — payments collection as a table for the monthly books.
//
//   node scripts/admin/payments-report.mjs [days=30] [--status paid|pending|all] [--csv] [--order <orderId>]
//
// Read-only. Columns: orderId, uid, email, plan, amount, status, provider, paymentId,
// createdAt, paidAt, callback/activation data from the doc. `--order` prints one
// payment doc + the owner's users/{uid} subscription fields (for support cases).
// Credentials: FIREBASE_SERVICE_ACCOUNT_B64 (env or ../../.env). Never prints secrets.
import { admin, DAY_MS } from "./_admin.mjs";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(name);
const days = Number(args.find((a) => /^\d+$/.test(a)) ?? 30);
const status = opt("--status") ?? "all";
const orderId = opt("--order");
if (!Number.isInteger(days) || days < 1 || !["paid", "pending", "all"].includes(status)) {
  console.error("usage: node scripts/admin/payments-report.mjs [days=30] [--status paid|pending|all] [--csv] [--order <orderId>]");
  process.exit(2);
}

const { auth, db } = admin();
const iso = (v) => (v?.toDate ? v.toDate().toISOString() : v ? String(v) : "");
const emailCache = new Map();
async function emailOf(uid) {
  if (!emailCache.has(uid)) {
    emailCache.set(uid, await auth.getUser(uid).then((u) => u.email ?? "").catch(() => "(deleted)"));
  }
  return emailCache.get(uid);
}

if (orderId) {
  const snap = await db.collection("payments").doc(orderId).get();
  if (!snap.exists) { console.error(`payments/${orderId} not found`); process.exit(1); }
  const p = snap.data();
  const user = (await db.collection("users").doc(p.uid).get()).data() ?? {};
  console.log(JSON.stringify({
    payment: { orderId, ...p, createdAt: iso(p.createdAt), paidAt: iso(p.paidAt), resultingExpiresAt: iso(p.resultingExpiresAt) },
    user: {
      uid: p.uid, email: await emailOf(p.uid),
      subscriptionTier: user.subscriptionTier ?? null,
      subscriptionActivatedAt: iso(user.subscriptionActivatedAt),
      subscriptionExpiresAt: iso(user.subscriptionExpiresAt),
      subscription: user.subscription ? { ...user.subscription, startedAt: iso(user.subscription.startedAt), expiresAt: iso(user.subscription.expiresAt) } : null,
    },
  }, null, 2));
  process.exit(0);
}

const since = new Date(Date.now() - days * DAY_MS);
const snap = await db.collection("payments").where("createdAt", ">=", since).orderBy("createdAt", "desc").get();
const rows = [];
for (const d of snap.docs) {
  const p = d.data();
  if (status !== "all" && p.status !== status) continue;
  rows.push({
    orderId: d.id,
    uid: p.uid,
    email: await emailOf(p.uid),
    plan: p.plan,
    amount: p.amount,
    status: p.status,
    provider: p.provider ?? "",
    paymentId: p.paymentId ?? "",
    createdAt: iso(p.createdAt),
    paidAt: iso(p.paidAt),
    appliedAs: p.appliedAs ? `${p.appliedAs.tier}×${p.appliedAs.days}d` : "",
  });
}

const total = rows.filter((r) => r.status === "paid").reduce((s, r) => s + (Number(r.amount) || 0), 0);
if (flag("--csv")) {
  const cols = Object.keys(rows[0] ?? { orderId: 1 });
  console.log(cols.join(","));
  for (const r of rows) console.log(cols.map((c) => JSON.stringify(r[c] ?? "")).join(","));
} else {
  console.log(`payments since ${since.toISOString().slice(0, 10)} (${days}d, status=${status}): ${rows.length} rows`);
  if (rows.length) console.table(rows);
  console.log(`paid total: ${total.toLocaleString("mn-MN")} MNT across ${rows.filter((r) => r.status === "paid").length} paid orders`);
}
process.exit(0);
