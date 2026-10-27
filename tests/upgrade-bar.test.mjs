// node --test tests/upgrade-bar.test.mjs — mobile upgrade strip visibility (src/lib/upgradeBar.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { achNearLimit, showUpgradeBar } from "../src/lib/upgradeBar.ts";

const free = { isPremium: false, achCount: 0, maxAch: 30, childNear: false, dismissed: false };

test("free tier: hidden until 25/30, shown from 25 on", () => {
  for (const n of [0, 1, 10, 24]) assert.equal(showUpgradeBar({ ...free, achCount: n }), false, `n=${n}`);
  for (const n of [25, 26, 29, 30]) assert.equal(showUpgradeBar({ ...free, achCount: n }), true, `n=${n}`);
});

test("snooze works at 25–26, not from 27 (90 %)", () => {
  assert.equal(showUpgradeBar({ ...free, achCount: 25, dismissed: true }), false);
  assert.equal(showUpgradeBar({ ...free, achCount: 26, dismissed: true }), false);
  assert.equal(showUpgradeBar({ ...free, achCount: 27, dismissed: true }), true);
  assert.equal(achNearLimit({ isPremium: false, achCount: 27, maxAch: 30 }), true);
  assert.equal(achNearLimit({ isPremium: false, achCount: 26, maxAch: 30 }), false);
});

test("paid or unlimited: never", () => {
  assert.equal(showUpgradeBar({ ...free, isPremium: true, achCount: 30 }), false);
  assert.equal(showUpgradeBar({ ...free, maxAch: -1, achCount: 500 }), false);
});

test("a full (reachable) child limit shows it even when snoozed", () => {
  assert.equal(showUpgradeBar({ ...free, childNear: true, dismissed: true }), true);
});
