// node --test tests/subscription-math.test.mjs — renewal / upgrade / expiry arithmetic
import { test } from "node:test";
import assert from "node:assert/strict";
import { planNextSubscription, effectiveTier, currentFromUserDoc, DAY_MS } from "../api/_lib/subscriptionMath.ts";
import { PLANS, PLAN_DURATION_MS } from "../shared/plans.js";

const now = new Date("2026-10-07T00:00:00Z");
const days = (n) => new Date(now.getTime() + n * DAY_MS);

test("renewal of the same tier extends from the current expiry (not from now)", () => {
  const r = planNextSubscription({ tier: "family", expiresAt: days(10) }, "family", now);
  assert.equal(r.ok, true); assert.equal(r.kind, "renew");
  assert.equal(r.expiresAt.getTime(), days(10).getTime() + PLAN_DURATION_MS);
});

test("upgrade with remaining days converts them into new-plan days (floor)", () => {
  // family 9,900 with 10 days left → master 24,900: floor(10 × 9900 / 24900) = 3 credit days
  const r = planNextSubscription({ tier: "family", expiresAt: days(10) }, "master", now);
  assert.equal(r.ok, true); assert.equal(r.kind, "upgrade");
  assert.equal(r.creditDays, Math.floor((10 * PLANS.family.amount) / PLANS.master.amount));
  assert.equal(r.expiresAt.getTime(), now.getTime() + PLAN_DURATION_MS + r.creditDays * DAY_MS);
});

test("upgrade on an expired plan is a plain new purchase (no credit)", () => {
  const r = planNextSubscription({ tier: "family", expiresAt: days(-1) }, "master", now);
  assert.equal(r.ok, true); assert.equal(r.kind, "new"); assert.equal(r.creditDays, 0);
  assert.equal(r.expiresAt.getTime(), now.getTime() + PLAN_DURATION_MS);
});

test("downgrade while a higher tier is active is refused", () => {
  const r = planNextSubscription({ tier: "master", expiresAt: days(5) }, "family", now);
  assert.equal(r.ok, false); assert.equal(r.reason, "downgrade"); assert.equal(r.activeTier, "master");
});

test("legacy doc without expiry: active, renew = now + duration, upgrade credit 0", () => {
  assert.equal(effectiveTier({ tier: "master", expiresAt: null }, now), "master");
  const renew = planNextSubscription({ tier: "master", expiresAt: null }, "master", now);
  assert.equal(renew.expiresAt.getTime(), now.getTime() + PLAN_DURATION_MS);
  const up = planNextSubscription({ tier: "family", expiresAt: null }, "coach", now);
  assert.equal(up.ok, true); assert.equal(up.creditDays, 0);
});

test("expired → effective tier free; promo months use a custom duration", () => {
  assert.equal(effectiveTier({ tier: "coach", expiresAt: days(-30) }, now), "free");
  const r = planNextSubscription({ tier: "free", expiresAt: null }, "family", now, 3 * PLAN_DURATION_MS);
  assert.equal(r.expiresAt.getTime(), now.getTime() + 3 * PLAN_DURATION_MS);
});

test("currentFromUserDoc parses Firestore-like timestamps", () => {
  const c = currentFromUserDoc({ subscriptionTier: "family", subscriptionExpiresAt: { seconds: Math.floor(days(3).getTime() / 1000) } });
  assert.equal(c.tier, "family"); assert.equal(c.expiresAt.getTime(), Math.floor(days(3).getTime() / 1000) * 1000);
  assert.deepEqual(currentFromUserDoc({ subscriptionTier: "weird" }), { tier: "free", expiresAt: null });
});
