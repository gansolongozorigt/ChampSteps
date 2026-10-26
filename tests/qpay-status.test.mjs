// node --test tests/qpay-status.test.mjs — /api/qpay/status fallback (processStatus in api/_lib/qpayCallback.ts)
// Callback ирэхгүй үед poll нь QPay payment/check-ээр давхар асууж, callback-тэй ижил activate()-г дуудна.
// Callback ба check аль нь түрүүлсэн ч багц НЭГ л удаа сунгагдах ёстой.
import { test } from "node:test";
import assert from "node:assert/strict";
import { processCallback, processStatus, CHECK_AFTER_MS, CHECK_GAP_MS } from "../api/_lib/qpayCallback.ts";
import { QPayError } from "../api/_lib/qpay.ts";

const SECRET = "s3cret";
const quiet = { log() {}, warn() {}, error() {} };
const T0 = Date.parse("2026-10-26T04:00:00Z");
const ts = (ms) => ({ toMillis: () => ms });

/**
 * One payments doc + a user whose expiry is extended by 30 days per activation.
 * activate() mimics activateSubscription's transaction: check status and flip it with no await in between.
 * Both processCallback and processStatus get deps from this same world.
 */
function world({ paidAtQPay = false, payment = {} } = {}) {
  const clock = { now: T0 + CHECK_AFTER_MS };
  const p = { uid: "u1", plan: "master", amount: 24900, status: "pending", provider: "qpay", invoiceId: "INV-1", createdAt: ts(T0), ...payment };
  const user = { expiresAt: new Date("2026-11-01T00:00:00Z"), extensions: 0 };
  const qpay = { paid: paidAtQPay };
  const calls = { check: 0, activate: 0 };
  let lastCheckAt = 0;
  const common = {
    async getPayment(id) { return id === "CS-1" ? p : null; },
    async checkPayment(invoiceId) {
      assert.equal(invoiceId, "INV-1");
      calls.check++;
      await Promise.resolve(); // a real network hop: lets a concurrent caller interleave
      if (qpay.error) throw qpay.error;
      return qpay.paid ? { paid: true, paidAmount: qpay.paidAmount ?? p.amount, paymentId: "QP-1" } : { paid: false, paidAmount: 0 };
    },
    async activate(orderId) {
      calls.activate++;
      if (p.status === "paid") return { ok: true, alreadyPaid: true, plan: p.plan, expiresAt: user.expiresAt };
      p.status = "paid";
      user.expiresAt = new Date(user.expiresAt.getTime() + 30 * 86400e3);
      user.extensions++;
      return { ok: true, alreadyPaid: false, plan: p.plan, expiresAt: user.expiresAt };
    },
    log: quiet,
  };
  const cbDeps = { ...common, secret: SECRET };
  const stDeps = {
    ...common,
    async claimCheck(_id, nowMs, gapMs) {
      if (p.status !== "pending" || nowMs - lastCheckAt < gapMs) return false;
      lastCheckAt = nowMs;
      return true;
    },
    async getExpiresAt() { return user.expiresAt; },
    now: () => clock.now,
  };
  return {
    p, user, qpay, calls, clock,
    callback: () => processCallback(cbDeps, { order: "CS-1", s: SECRET }),
    poll: (uid = "u1") => processStatus(stDeps, { uid, orderId: "CS-1" }),
  };
}

test("callback first: activates once; the next poll sees paid without calling QPay", async () => {
  const w = world({ paidAtQPay: true });
  assert.equal((await w.callback()).activated, true);
  const r = await w.poll();
  assert.equal(r.body.status, "paid");
  assert.equal(r.body.expiresAt, w.user.expiresAt.toISOString());
  assert.equal(r.checked, "skipped", "order already paid → no payment/check");
  assert.equal(w.calls.check, 1, "only the callback's check");
  assert.equal(w.user.extensions, 1);
});

test("check first (callback never arrives / arrives late): poll activates, late callback does not extend again", async () => {
  const w = world({ paidAtQPay: true });
  const r = await w.poll();
  assert.equal(r.checked, "activated");
  assert.equal(r.body.status, "paid");
  assert.equal(r.body.expiresAt, w.user.expiresAt.toISOString());
  const late = await w.callback();
  assert.deepEqual(late, { status: 200, body: "SUCCESS", activated: false });
  assert.equal(w.user.extensions, 1);
});

test("both at once: callback and poll race on the same order → exactly one extension", async () => {
  const w = world({ paidAtQPay: true });
  const [cb, st] = await Promise.all([w.callback(), w.poll()]);
  assert.equal(cb.status, 200);
  assert.equal(st.body.status, "paid");
  assert.equal(w.calls.check, 2, "both verified with QPay");
  assert.equal(w.calls.activate, 2, "both reached the shared activate()");
  assert.equal(w.user.extensions, 1, "activate is idempotent");
  assert.ok(cb.activated !== (st.checked === "activated"), "exactly one of them did the activation");
});

test("neither: QPay says unpaid and no callback → stays pending, nothing activated", async () => {
  const w = world({ paidAtQPay: false });
  const r = await w.poll();
  assert.deepEqual(r.body, { status: "pending", plan: "master", expiresAt: null });
  assert.equal(r.checked, "unpaid");
  assert.equal(w.calls.check, 1);
  assert.equal(w.calls.activate, 0);
  assert.equal(w.user.extensions, 0);
});

test("no QPay call before the order is CHECK_AFTER_MS old", async () => {
  const w = world({ paidAtQPay: true });
  w.clock.now = T0 + CHECK_AFTER_MS - 1;
  const r = await w.poll();
  assert.equal(r.checked, "skipped");
  assert.equal(r.body.status, "pending");
  assert.equal(w.calls.check, 0);
  w.clock.now = T0 + CHECK_AFTER_MS;
  assert.equal((await w.poll()).checked, "activated");
});

test("throttle: at most one payment/check per order per CHECK_GAP_MS", async () => {
  const w = world({ paidAtQPay: false });
  const start = w.clock.now;
  for (let t = 0; t < 15000; t += 1000) { // 15 polls, one per second
    w.clock.now = start + t;
    await w.poll();
  }
  assert.equal(w.calls.check, Math.ceil(15000 / CHECK_GAP_MS), "t=0, 5s, 10s");
  // concurrent polls at the same instant also share one check
  w.clock.now = start + 20000;
  await Promise.all([w.poll(), w.poll(), w.poll()]);
  assert.equal(w.calls.check, 4);
});

test("QPay error keeps the poll alive (200 pending) and the next allowed check can still activate", async () => {
  const w = world({ paidAtQPay: true });
  w.qpay.error = new QPayError("QPay /v2/payment/check failed", 503, { msg: "down" });
  const r = await w.poll();
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "pending");
  assert.equal(r.checked, "error");
  delete w.qpay.error;
  w.clock.now += CHECK_GAP_MS;
  assert.equal((await w.poll()).checked, "activated");
  assert.equal(w.user.extensions, 1);
});

test("partial payment is not activated; a foreign order is refused without calling QPay", async () => {
  const w = world({ paidAtQPay: true });
  w.qpay.paidAmount = 5000;
  const r = await w.poll();
  assert.equal(r.checked, "unpaid");
  assert.equal(r.body.status, "pending");
  assert.equal(w.calls.activate, 0);
  const other = world({ paidAtQPay: true });
  assert.equal((await other.poll("someone-else")).status, 403);
  assert.equal(other.calls.check, 0);
  assert.equal((await processStatus({ getPayment: async () => null }, { uid: "u1", orderId: "CS-404" })).status, 404);
});

test("order without invoiceId never calls QPay", async () => {
  const w = world({ paidAtQPay: true, payment: { invoiceId: null } });
  const r = await w.poll();
  assert.equal(r.checked, "skipped");
  assert.equal(w.calls.check, 0);
});
