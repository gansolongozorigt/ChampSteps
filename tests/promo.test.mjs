// node --test tests/promo.test.mjs — promoCodes plan/days resolution (api/_lib/promo.ts)
// and how it feeds the downgrade rule used by /api/promo/apply.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, MONTH_MS, PROMO_PLAN, promoDays, promoDurationMs, promoPlan, toView } from "../api/_lib/promo.ts";
import { planNextSubscription } from "../api/_lib/subscriptionMath.ts";

const now = new Date("2026-10-13T00:00:00Z");
const base = { code: "X", usedBy: [], maxUses: 5, active: true };

test("plan + days: coach for 365 days is granted verbatim", () => {
  const doc = { ...base, plan: "coach", days: 365, discountMonths: 12 };
  assert.equal(promoPlan(doc), "coach");
  assert.equal(promoDurationMs(doc), 365 * DAY_MS, "days wins over discountMonths");
  assert.equal(promoDays(doc), 365);
  const next = planNextSubscription({ tier: "free", expiresAt: null }, promoPlan(doc), now, promoDurationMs(doc));
  assert.equal(next.ok, true);
  assert.equal(next.expiresAt.getTime(), now.getTime() + 365 * DAY_MS);
  assert.equal(toView(doc).plan, "coach");
  assert.equal(toView(doc).days, 365);
  assert.equal(promoPlan({ ...base, plan: "master", days: 30 }), "master");
});

test("legacy format: no plan/days → family × discountMonths × 30 days; bad values fall back", () => {
  assert.equal(promoPlan({ ...base, discountMonths: 3 }), PROMO_PLAN);
  assert.equal(promoDurationMs({ ...base, discountMonths: 3 }), 3 * MONTH_MS);
  assert.equal(promoDurationMs({ ...base, months: 2 }), 2 * MONTH_MS, "old `months` name");
  assert.equal(promoDurationMs({ ...base }), 1 * MONTH_MS, "nothing → 1 month");
  assert.equal(promoDurationMs({ ...base, days: 0, discountMonths: 6 }), 6 * MONTH_MS, "days 0 → months");
  assert.equal(promoDurationMs({ ...base, days: "abc", discountMonths: 2 }), 2 * MONTH_MS);
  assert.equal(promoPlan({ ...base, plan: "free", days: 10 }), "family", "free is not a grantable plan");
  assert.equal(promoPlan({ ...base, plan: "platinum" }), "family");
  assert.equal(toView({ ...base, discountMonths: 12 }).days, 360);
});

test("downgrade: a family code on an active coach plan is refused; coach on family is an upgrade", () => {
  const active = { tier: "coach", expiresAt: new Date(now.getTime() + 100 * DAY_MS) };
  const familyCode = { ...base, discountMonths: 12 };
  const r = planNextSubscription(active, promoPlan(familyCode), now, promoDurationMs(familyCode));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "downgrade");
  const coachCode = { ...base, plan: "coach", days: 365 };
  const up = planNextSubscription({ tier: "family", expiresAt: new Date(now.getTime() + 10 * DAY_MS) }, promoPlan(coachCode), now, promoDurationMs(coachCode));
  assert.equal(up.ok, true);
  assert.equal(up.kind, "upgrade");
  const same = planNextSubscription(active, "coach", now, 365 * DAY_MS);
  assert.equal(same.kind, "renew", "same tier extends from the current expiry");
  assert.equal(same.expiresAt.getTime(), active.expiresAt.getTime() + 365 * DAY_MS);
});
