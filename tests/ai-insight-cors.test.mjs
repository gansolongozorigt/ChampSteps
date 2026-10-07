// Unit tests for the pure guards behind /api/ai-insight (api/_lib/aiGuard.ts).
// node --test tests/ai-insight-cors.test.mjs  (Node strips the types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AI_RATE_LIMIT,
  AI_RATE_WINDOW_MS,
  bearerToken,
  buildAllowList,
  effectiveTier,
  isAllowedOrigin,
  nextRateWindow,
  tierHasAI,
  toMillis,
} from "../api/_lib/aiGuard.ts";

const H = 60 * 60 * 1000;

test("buildAllowList: APP_URL first, falsy dropped, trailing slash trimmed", () => {
  const list = buildAllowList("https://app.example.com/");
  assert.equal(list[0], "https://app.example.com");
  assert.ok(list.includes("https://champstep.mn"));
  assert.ok(list.includes("http://localhost:5173"));
  assert.deepEqual(buildAllowList(undefined), buildAllowList(""));
  assert.ok(!buildAllowList(undefined).includes(""));
});

test("isAllowedOrigin: exact match only; absent Origin is fine", () => {
  const list = buildAllowList("https://app.example.com");
  assert.equal(isAllowedOrigin(undefined, list), true);
  assert.equal(isAllowedOrigin("", list), true);
  assert.equal(isAllowedOrigin("https://champstep.mn", list), true);
  assert.equal(isAllowedOrigin("https://www.champstep.mn", list), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:5174", list), true);
  assert.equal(isAllowedOrigin("https://evil.com", list), false);
  assert.equal(isAllowedOrigin("https://champstep.mn.evil.com", list), false);
  assert.equal(isAllowedOrigin("http://champstep.mn", list), false, "scheme matters");
  assert.equal(isAllowedOrigin("http://localhost:5174", list), false, "port matters");
  assert.equal(isAllowedOrigin("null", list), false);
});

test("effectiveTier: default free, unknown tier free, expiry honoured", () => {
  const now = Date.parse("2026-10-07T00:00:00Z");
  assert.equal(effectiveTier(undefined, now), "free");
  assert.equal(effectiveTier({}, now), "free");
  assert.equal(effectiveTier({ subscriptionTier: "platinum" }, now), "free");
  assert.equal(effectiveTier({ subscriptionTier: "master" }, now), "master", "no expiry → keep");
  assert.equal(effectiveTier({ subscriptionTier: "coach", subscriptionExpiresAt: null }, now), "coach");
  // ISO strings
  assert.equal(effectiveTier({ subscriptionTier: "master", subscriptionExpiresAt: "2027-01-01T00:00:00Z" }, now), "master");
  assert.equal(effectiveTier({ subscriptionTier: "master", subscriptionExpiresAt: "2026-01-01" }, now), "free");
  // Firestore Timestamp-like objects
  const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
  assert.equal(effectiveTier({ subscriptionTier: "coach", subscriptionExpiresAt: ts(now + H) }, now), "coach");
  assert.equal(effectiveTier({ subscriptionTier: "coach", subscriptionExpiresAt: ts(now - 1) }, now), "free");
  assert.equal(effectiveTier({ subscriptionTier: "family", subscriptionExpiresAt: { seconds: (now + H) / 1000 } }, now), "family");
  // Date and number
  assert.equal(effectiveTier({ subscriptionTier: "master", subscriptionExpiresAt: new Date(now + 1) }, new Date(now)), "master");
  assert.equal(effectiveTier({ subscriptionTier: "master", subscriptionExpiresAt: now }, now), "free", "exactly now = expired");
  // garbage expiry fails closed
  assert.equal(effectiveTier({ subscriptionTier: "master", subscriptionExpiresAt: "not a date" }, now), "free");
  assert.equal(toMillis("not a date"), null);
});

test("tierHasAI mirrors shared/plans.js", () => {
  assert.equal(tierHasAI("free"), false);
  assert.equal(tierHasAI("family"), false);
  assert.equal(tierHasAI("master"), true);
  assert.equal(tierHasAI("coach"), true);
});

test("nextRateWindow: 10 per rolling hour, reset after window, denial keeps state", () => {
  const t0 = 1_700_000_000_000;
  let d = nextRateWindow(undefined, t0);
  assert.deepEqual(d, { windowStart: t0, count: 1, allowed: true, retryAfterSec: 0 });
  for (let i = 2; i <= AI_RATE_LIMIT; i++) {
    d = nextRateWindow(d, t0 + i * 1000);
    assert.equal(d.allowed, true, `request ${i}`);
    assert.equal(d.count, i);
    assert.equal(d.windowStart, t0);
  }
  const denied = nextRateWindow(d, t0 + 30 * 60 * 1000);
  assert.equal(denied.allowed, false);
  assert.equal(denied.count, AI_RATE_LIMIT);
  assert.equal(denied.windowStart, t0);
  assert.equal(denied.retryAfterSec, 30 * 60);
  // one hour later the window resets
  const reset = nextRateWindow(denied, t0 + AI_RATE_WINDOW_MS);
  assert.deepEqual(reset, { windowStart: t0 + AI_RATE_WINDOW_MS, count: 1, allowed: true, retryAfterSec: 0 });
  // corrupt state behaves like an empty one
  assert.equal(nextRateWindow({ windowStart: NaN, count: 99 }, t0).allowed, true);
  assert.equal(nextRateWindow({ windowStart: null, count: 99 }, t0).count, 1);
  // retryAfterSec is at least 1
  assert.equal(nextRateWindow({ windowStart: t0, count: AI_RATE_LIMIT }, t0 + AI_RATE_WINDOW_MS - 1).retryAfterSec, 1);
});

test("bearerToken parses the Authorization header", () => {
  assert.equal(bearerToken("Bearer abc.def"), "abc.def");
  assert.equal(bearerToken("bearer   abc"), "abc");
  assert.equal(bearerToken(["Bearer x", "Bearer y"]), "x");
  assert.equal(bearerToken("Basic abc"), null);
  assert.equal(bearerToken("Bearer "), null);
  assert.equal(bearerToken(undefined), null);
});
