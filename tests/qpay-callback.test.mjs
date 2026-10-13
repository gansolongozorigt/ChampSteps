// node --test tests/qpay-callback.test.mjs — /api/qpay/callback core (api/_lib/qpayCallback.ts)
// QPay-ийн шаардлага: callback ирсний дараа /v2/payment/check-ээр заавал баталгаажуулж
// байж л багц идэвхжүүлнэ; callback-ийн body-д итгэхгүй.
import { test } from "node:test";
import assert from "node:assert/strict";
import { processCallback } from "../api/_lib/qpayCallback.ts";
import { QPayError } from "../api/_lib/qpay.ts";

const SECRET = "s3cret";
const quiet = { log() {}, warn() {}, error() {} };

/** In-memory payments + spies. `check` = what /v2/payment/check will answer. */
function world({ payment, check } = {}) {
  const payments = new Map();
  if (payment !== null) {
    payments.set("CS-1", { uid: "u1", plan: "family", amount: 9900, status: "pending", provider: "qpay", invoiceId: "INV-1", ...(payment ?? {}) });
  }
  const calls = { check: [], activate: [] };
  const deps = {
    secret: SECRET,
    async getPayment(id) { return payments.get(id) ?? null; },
    async checkPayment(invoiceId) {
      calls.check.push(invoiceId);
      if (check instanceof Error) throw check;
      return check ?? { paid: false, paidAmount: 0 };
    },
    async activate(orderId, opts) {
      calls.activate.push({ orderId, ...opts });
      const p = payments.get(orderId);
      if (!p) return { ok: false, reason: "not_found" };
      const already = p.status === "paid";
      p.status = "paid";
      return { ok: true, alreadyPaid: already, plan: p.plan, expiresAt: new Date("2026-11-12T00:00:00Z") };
    },
    log: quiet,
  };
  return { deps, calls, payments };
}

test("happy path: callback → payment/check says PAID with full amount → activate", async () => {
  const { deps, calls, payments } = world({ check: { paid: true, paidAmount: 9900, paymentId: "QP-1" } });
  const r = await processCallback(deps, { order: "CS-1", s: SECRET });
  assert.deepEqual(r, { status: 200, body: "SUCCESS", activated: true });
  assert.deepEqual(calls.check, ["INV-1"], "check called with the invoice id from OUR payments doc");
  assert.deepEqual(calls.activate, [{ orderId: "CS-1", paymentId: "QP-1" }]);
  assert.equal(payments.get("CS-1").status, "paid");
});

test("callback alone is never trusted: check says not paid → PENDING, nothing activated", async () => {
  const { deps, calls, payments } = world({ check: { paid: false, paidAmount: 0 } });
  const r = await processCallback(deps, { order: "CS-1", s: SECRET });
  assert.deepEqual(r, { status: 200, body: "PENDING", activated: false });
  assert.equal(calls.check.length, 1, "payment/check WAS consulted");
  assert.equal(calls.activate.length, 0, "activate NOT called");
  assert.equal(payments.get("CS-1").status, "pending");
});

test("partial payment (paid < amount) is not enough", async () => {
  const { deps, calls } = world({ check: { paid: true, paidAmount: 5000, paymentId: "QP-2" } });
  const r = await processCallback(deps, { order: "CS-1", s: SECRET });
  assert.equal(r.body, "PENDING");
  assert.equal(calls.activate.length, 0);
});

test("extra 'paid' claims in the request are ignored — only the query order/secret are read", async () => {
  // processCallback has no body parameter at all; a forged body cannot reach it.
  // Simulate an attacker who knows the order id but not the secret.
  const { deps, calls } = world({ check: { paid: true, paidAmount: 9900 } });
  const forged = await processCallback(deps, { order: "CS-1", s: "wrong", payment_status: "PAID", paid_amount: 9900 });
  assert.deepEqual(forged, { status: 403, body: "FORBIDDEN", activated: false });
  assert.equal(calls.check.length, 0);
  assert.equal(calls.activate.length, 0);
  // With the right secret the decision STILL comes from payment/check, not from the claim.
  const { deps: d2, calls: c2 } = world({ check: { paid: false, paidAmount: 0 } });
  const r = await processCallback(d2, { order: "CS-1", s: SECRET, payment_status: "PAID", paid_amount: 9900 });
  assert.equal(r.body, "PENDING");
  assert.equal(c2.check.length, 1);
  assert.equal(c2.activate.length, 0);
});

test("secret guard: missing secret env, wrong secret, missing order", async () => {
  const { deps, calls } = world({ check: { paid: true, paidAmount: 9900 } });
  assert.equal((await processCallback({ ...deps, secret: undefined }, { order: "CS-1", s: SECRET })).status, 403, "no secret configured → refuse all");
  assert.equal((await processCallback(deps, { order: "CS-1" })).status, 403);
  assert.equal((await processCallback(deps, { order: "CS-1", s: "" })).status, 403);
  assert.deepEqual(await processCallback(deps, { s: SECRET }), { status: 400, body: "MISSING_ORDER", activated: false });
  assert.equal(calls.check.length, 0);
  assert.equal(calls.activate.length, 0);
});

test("idempotent: already-paid order answers SUCCESS without calling QPay again", async () => {
  const { deps, calls } = world({ payment: { status: "paid" }, check: { paid: true, paidAmount: 9900 } });
  const r = await processCallback(deps, { order: "CS-1", s: SECRET });
  assert.deepEqual(r, { status: 200, body: "SUCCESS", activated: false });
  assert.equal(calls.check.length, 0);
  assert.equal(calls.activate.length, 0);
});

test("unknown order → 404; order without invoiceId → PENDING (no check possible)", async () => {
  const { deps } = world({ payment: null });
  assert.equal((await processCallback(deps, { order: "CS-404", s: SECRET })).body, "NOT_FOUND");
  const { deps: d2, calls } = world({ payment: { invoiceId: null }, check: { paid: true, paidAmount: 9900 } });
  assert.equal((await processCallback(d2, { order: "CS-1", s: SECRET })).body, "PENDING");
  assert.equal(calls.check.length, 0);
  assert.equal(calls.activate.length, 0);
});

test("QPay check failure → 502 QPAY_ERROR (QPay will retry); other errors → 500", async () => {
  const { deps, calls } = world({ check: new QPayError("QPay /v2/payment/check failed", 503, { msg: "down" }) });
  assert.deepEqual(await processCallback(deps, { order: "CS-1", s: SECRET }), { status: 502, body: "QPAY_ERROR", activated: false });
  assert.equal(calls.activate.length, 0);
  const { deps: d2 } = world({ check: new Error("boom") });
  assert.equal((await processCallback(d2, { order: "CS-1", s: SECRET })).status, 500);
});
