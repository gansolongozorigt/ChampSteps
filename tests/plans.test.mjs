// Guards the single source of truth: client TIER_LIMITS and server PLANS must
// both be derived from shared/plans.js.  node --test tests/plans.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLANS, PLAN_IDS, PAID_PLAN_IDS, PLAN_DURATION_MS, formatMnt } from "../shared/plans.js";

test("shared plan table is well-formed", () => {
  assert.deepEqual(PLAN_IDS, ["free", "family", "master", "coach"]);
  for (const id of PLAN_IDS) {
    const p = PLANS[id];
    assert.ok(Number.isInteger(p.amount) && p.amount >= 0, id);
    assert.ok(p.maxChildren >= 1, id);
    assert.ok(p.maxAchievements === -1 || p.maxAchievements > 0, id);
    assert.equal(typeof p.hasPdf, "boolean"); assert.equal(typeof p.hasAI, "boolean");
    for (const l of ["mn", "en", "ru"]) assert.ok(p.label[l], `${id} label ${l}`);
  }
  assert.equal(PLANS.free.amount, 0);
  assert.equal(PLANS.coach.maxChildren, 30);
  assert.equal(PLAN_DURATION_MS, 30 * 864e5);
  assert.equal(formatMnt(9900), "₮9,900");
});

test("client (src/types) and server (api/_lib/plans.ts) read from shared/plans.js, not their own numbers", () => {
  const client = readFileSync(new URL("../src/types/index.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../api/_lib/plans.ts", import.meta.url), "utf8");
  const modal = readFileSync(new URL("../src/components/SubscriptionModal.tsx", import.meta.url), "utf8");
  assert.match(client, /from "\.\.\/\.\.\/shared\/plans\.js"/);
  assert.match(server, /from "\.\.\/\.\.\/shared\/plans\.js"/);
  assert.match(modal, /from "\.\.\/\.\.\/shared\/plans\.js"/);
  // no hard-coded prices / per-tier child counts left behind
  for (const [file, src] of [["types", client], ["api plans", server], ["modal", modal]]) {
    assert.doesNotMatch(src, /9[,.]?900|24[,.]?900|49[,.]?900/, `${file} still hard-codes a price`);
  }
  assert.doesNotMatch(modal, /sub\.children", \{ n: \d+ \}/, "modal hard-codes child counts");
});

test("server PaidPlan amounts equal the shared table", async () => {
  // api/_lib/plans.ts is TypeScript; evaluate it via Node's type stripping.
  const { PLANS: SERVER } = await import("../api/_lib/plans.ts");
  for (const id of PAID_PLAN_IDS) {
    assert.equal(SERVER[id].amount, PLANS[id].amount, id);
    assert.equal(SERVER[id].label, PLANS[id].label.mn, id);
  }
});
