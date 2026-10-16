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

// ---- redeem checks (promoRejectReason — what /api/promo/apply refuses before writing) ----
import { promoRejectReason } from "../api/_lib/promo.ts";

/** EHLEL2026 as scripts/admin/create-promo.mjs writes it: family × 30 days, 100 uses, until 2026-11-30. */
const EHLEL = {
  code: "EHLEL2026", plan: "family", days: 30, discountMonths: 1, maxUses: 100,
  usedBy: [], usedCount: 0, active: true, expiresAt: "2026-11-30T23:59:59.000Z",
};
const inCampaign = new Date("2026-10-20T08:00:00Z");

test("EHLEL2026: a fresh user redeems family for 30 days while the campaign runs", () => {
  assert.equal(promoRejectReason(EHLEL, "uid-1", inCampaign), null);
  assert.equal(promoPlan(EHLEL), "family");
  assert.equal(promoDays(EHLEL), 30);
  const next = planNextSubscription({ tier: "free", expiresAt: null }, promoPlan(EHLEL), inCampaign, promoDurationMs(EHLEL));
  assert.equal(next.ok, true);
  assert.equal(next.expiresAt.getTime(), inCampaign.getTime() + 30 * DAY_MS, "free → family expires exactly 30 days later (then the status endpoint drops it back to free)");
});

test("limit: the 100th user still gets in, the 101st is refused as exhausted; maxUses 0 means unlimited", () => {
  const ninetyNine = Array.from({ length: 99 }, (_, i) => `u${i}`);
  assert.equal(promoRejectReason({ ...EHLEL, usedBy: ninetyNine }, "u-100", inCampaign), null, "99 used → 100th ok");
  assert.equal(promoRejectReason({ ...EHLEL, usedBy: [...ninetyNine, "u-100"] }, "u-101", inCampaign), "exhausted");
  assert.equal(promoRejectReason({ ...EHLEL, maxUses: 0, usedBy: [...ninetyNine, "u-100", "u-101"] }, "u-102", inCampaign), null, "0 = unlimited");
  assert.equal(promoRejectReason({ ...EHLEL, maxUses: undefined, usedBy: ninetyNine }, "u-x", inCampaign), null, "absent = unlimited");
});

test("double use: a uid already in usedBy is refused as used, even when uses remain", () => {
  assert.equal(promoRejectReason({ ...EHLEL, usedBy: ["uid-1", "uid-2"] }, "uid-1", inCampaign), "used");
  assert.equal(promoRejectReason({ ...EHLEL, usedBy: ["uid-1", "uid-2"] }, "uid-3", inCampaign), null);
  // used wins over exhausted for the same uid (the user gets the clearer message)
  assert.equal(promoRejectReason({ ...EHLEL, maxUses: 2, usedBy: ["uid-1", "uid-2"] }, "uid-1", inCampaign), "used");
});

test("expired / inactive / not found: refused in that order; Timestamp-like and ISO expiry both work", () => {
  assert.equal(promoRejectReason(EHLEL, "uid-1", new Date("2026-12-01T00:00:00Z")), "expired");
  assert.equal(promoRejectReason(EHLEL, "uid-1", new Date("2026-11-30T23:59:58Z")), null, "last second of the campaign still works");
  assert.equal(promoRejectReason({ ...EHLEL, expiresAt: null }, "uid-1", new Date("2030-01-01T00:00:00Z")), null, "no expiry → never expires");
  assert.equal(promoRejectReason({ ...EHLEL, active: false }, "uid-1", inCampaign), "inactive");
  assert.equal(promoRejectReason({ ...EHLEL, active: false, expiresAt: "2020-01-01T00:00:00Z" }, "uid-1", inCampaign), "inactive", "inactive is checked before expiry");
  assert.equal(promoRejectReason(null, "uid-1", inCampaign), "not_found");
  assert.equal(promoRejectReason(undefined, "uid-1", inCampaign), "not_found");
});
