// node --test tests/qpay-token.test.mjs — QPay access token caching (api/_lib/qpay.ts)
// QPay-ийн шаардлага: хүсэлт бүрт /v2/auth/token дуудахгүй; expires_in-д тулгуурлан
// кэшлэж, хугацаа дуусахаас 60с өмнө шинэчилнэ; зэрэг хүсэлтэд давхар auth хийхгүй.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createQPayClient,
  isFresh,
  tokenExpiresAt,
  REFRESH_MARGIN_MS,
  LOCK_TTL_MS,
  LOCK_POLL_MS,
  QPayError,
} from "../api/_lib/qpay.ts";

const ENV = {
  QPAY_BASE_URL: "https://merchant.qpay.mn",
  QPAY_USERNAME: "u",
  QPAY_PASSWORD: "p",
  QPAY_INVOICE_CODE: "CODE",
  QPAY_CALLBACK_SECRET: "sec",
  APP_URL: "https://www.champstep.mn/",
};
const T0 = Date.parse("2026-10-13T10:00:00Z");
const EXPIRES_IN = 3600; // seconds (duration form)

function jsonRes(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

/** Fake QPay: counts auth calls, issues token-N, rejects tokens listed in `revoked`. */
function makeQPay() {
  const calls = { auth: 0, invoice: 0, check: 0 };
  const revoked = new Set();
  const fetch = async (url, init) => {
    const u = String(url);
    if (u.endsWith("/v2/auth/token")) {
      calls.auth++;
      assert.match(init.headers.Authorization, /^Basic /);
      return jsonRes(200, { access_token: `token-${calls.auth}`, expires_in: EXPIRES_IN });
    }
    const bearer = init.headers.Authorization.replace("Bearer ", "");
    if (revoked.has(bearer)) return jsonRes(401, { message: "unauthorized" });
    if (u.endsWith("/v2/invoice")) {
      calls.invoice++;
      return jsonRes(200, { invoice_id: "INV-1", qr_text: "qr", qr_image: "", urls: [] });
    }
    if (u.endsWith("/v2/payment/check")) {
      calls.check++;
      return jsonRes(200, { count: 1, rows: [{ payment_id: "P1", payment_status: "PAID", payment_amount: 9900 }] });
    }
    throw new Error(`unexpected url ${u}`);
  };
  return { calls, revoked, fetch };
}

/** In-memory stand-in for system/qpayToken with the same lock semantics as firestoreTokenStore. */
function makeStore() {
  const doc = {}; // { token, expiresAt, lockedAt }
  const ops = [];
  return {
    doc,
    ops,
    async load() {
      ops.push("load");
      return typeof doc.token === "string" && typeof doc.expiresAt === "number" ? { token: doc.token, expiresAt: doc.expiresAt } : null;
    },
    async tryLock(nowMs, ttlMs, rejectedToken) {
      ops.push("lock");
      if (isFresh({ token: doc.token, expiresAt: doc.expiresAt }, nowMs) && doc.token !== rejectedToken) return false;
      if (typeof doc.lockedAt === "number" && nowMs - doc.lockedAt < ttlMs) return false;
      doc.lockedAt = nowMs;
      return true;
    },
    async save(rec) {
      ops.push("save");
      doc.token = rec.token;
      doc.expiresAt = rec.expiresAt;
      delete doc.lockedAt;
    },
  };
}

function makeClient({ qpay, store, clock, env = ENV, sleep } = {}) {
  qpay ??= makeQPay();
  clock ??= { now: T0 };
  return {
    qpay,
    store,
    clock,
    client: createQPayClient({
      fetch: qpay.fetch,
      now: () => clock.now,
      env: (n) => env[n],
      store: store ?? null,
      sleep: sleep ?? (async (ms) => { clock.now += ms; }),
    }),
  };
}

test("tokenExpiresAt: duration seconds vs epoch seconds vs unknown", () => {
  assert.equal(tokenExpiresAt(3600, T0), T0 + 3600 * 1000, "duration form");
  assert.equal(tokenExpiresAt("3600", T0), T0 + 3600 * 1000, "string duration");
  const epochSec = Math.floor(T0 / 1000) + 7200;
  assert.equal(tokenExpiresAt(epochSec, T0), epochSec * 1000, "epoch form");
  assert.equal(tokenExpiresAt(undefined, T0), T0 + 3600 * 1000, "unknown → 1h");
  assert.equal(tokenExpiresAt(-5, T0), T0 + 3600 * 1000, "garbage → 1h");
});

test("isFresh: token is fresh until 60s before expiry, then stale", () => {
  const rec = { token: "t", expiresAt: T0 + 1000 * 1000 };
  assert.equal(isFresh(rec, T0), true);
  assert.equal(isFresh(rec, rec.expiresAt - REFRESH_MARGIN_MS - 1), true, "61s before expiry: fresh");
  assert.equal(isFresh(rec, rec.expiresAt - REFRESH_MARGIN_MS), false, "exactly 60s before: refresh");
  assert.equal(isFresh(rec, rec.expiresAt), false);
  assert.equal(isFresh(null, T0), false);
  assert.equal(isFresh({ token: "", expiresAt: T0 + 1e9 }, T0), false, "empty token never fresh");
});

test("one auth for many sequential calls; refresh happens 60s before expiry, not per request", async () => {
  const { client, qpay, clock } = makeClient();
  for (let i = 0; i < 20; i++) await client.checkPayment("INV-1");
  assert.equal(qpay.calls.auth, 1, "20 requests → 1 auth");
  assert.equal(qpay.calls.check, 20);

  clock.now = T0 + EXPIRES_IN * 1000 - REFRESH_MARGIN_MS - 1000; // 61s before expiry
  await client.checkPayment("INV-1");
  assert.equal(qpay.calls.auth, 1, "61s before expiry: still cached");

  clock.now = T0 + EXPIRES_IN * 1000 - REFRESH_MARGIN_MS; // 60s before expiry
  await client.checkPayment("INV-1");
  assert.equal(qpay.calls.auth, 2, "60s before expiry: refreshed once");
  await client.createInvoice({ orderId: "CS-1", amount: 9900, description: "d", receiverCode: "u1" });
  assert.equal(qpay.calls.auth, 2, "new token reused");
});

test("concurrent requests on one instance share a single auth call (single-flight)", async () => {
  const { client, qpay } = makeClient();
  const tokens = await Promise.all(Array.from({ length: 8 }, () => client.getToken()));
  assert.equal(qpay.calls.auth, 1);
  assert.ok(tokens.every((t) => t === "token-1"));
  await Promise.all([client.checkPayment("A"), client.checkPayment("B"), client.createInvoice({ orderId: "CS-2", amount: 1, description: "d", receiverCode: "u" })]);
  assert.equal(qpay.calls.auth, 1, "authed calls in parallel still one auth");
});

test("shared store: a second instance (cold start) reuses the stored token without calling auth", async () => {
  const store = makeStore();
  const qpay = makeQPay();
  const a = makeClient({ qpay, store });
  await a.client.getToken();
  assert.equal(qpay.calls.auth, 1);
  assert.equal(store.doc.token, "token-1", "persisted to system/qpayToken");
  assert.equal(store.doc.expiresAt, T0 + EXPIRES_IN * 1000);
  assert.equal(store.doc.lockedAt, undefined, "lock released after save");

  const b = makeClient({ qpay, store, clock: { now: T0 + 5000 } }); // another serverless instance
  const t = await b.client.getToken();
  assert.equal(t, "token-1");
  assert.equal(qpay.calls.auth, 1, "no second auth");
  await b.client.checkPayment("INV-1");
  assert.equal(qpay.calls.auth, 1);
});

test("shared store: instances racing on a stale token — only the lock holder calls auth, the other waits and reuses", async () => {
  const store = makeStore();
  const qpay = makeQPay();
  const clock = { now: T0 };
  // leader: slow auth so the follower sees the lock
  let releaseAuth;
  const slowAuth = new Promise((r) => { releaseAuth = r; });
  const leaderFetch = async (url, init) => {
    if (String(url).endsWith("/v2/auth/token")) await slowAuth;
    return qpay.fetch(url, init);
  };
  const leader = createQPayClient({ fetch: leaderFetch, now: () => clock.now, env: (n) => ENV[n], store, sleep: async () => {} });
  const followerSleeps = [];
  const follower = createQPayClient({
    fetch: qpay.fetch, now: () => clock.now, env: (n) => ENV[n], store,
    sleep: async (ms) => { followerSleeps.push(ms); clock.now += ms; if (followerSleeps.length === 2) releaseAuth(); },
  });

  const pLeader = leader.getToken();
  await new Promise((r) => setImmediate(r)); // let the leader take the lock
  assert.equal(typeof store.doc.lockedAt, "number", "leader holds lock");
  const pFollower = follower.getToken();

  const [tl, tf] = await Promise.all([pLeader, pFollower]);
  assert.equal(qpay.calls.auth, 1, "exactly one auth across both instances");
  assert.equal(tl, "token-1");
  assert.equal(tf, "token-1", "follower got the leader's token from the store");
  assert.ok(followerSleeps.length >= 1 && followerSleeps.every((ms) => ms === LOCK_POLL_MS));
});

test("shared store: an abandoned lock (older than LOCK_TTL_MS) does not block refresh forever", async () => {
  const store = makeStore();
  store.doc.lockedAt = T0 - LOCK_TTL_MS - 1; // instance died mid-refresh
  const { client, qpay } = makeClient({ store });
  await client.getToken();
  assert.equal(qpay.calls.auth, 1);
  assert.equal(store.doc.token, "token-1");
});

test("401 on an API call: caches are dropped and auth is retried exactly once", async () => {
  const store = makeStore();
  const qpay = makeQPay();
  const { client } = makeClient({ qpay, store });
  await client.checkPayment("INV-1");
  assert.equal(qpay.calls.auth, 1);
  qpay.revoked.add("token-1"); // QPay invalidated it server-side
  const r = await client.checkPayment("INV-1");
  assert.equal(r.paid, true);
  assert.equal(qpay.calls.auth, 2, "one re-auth");
  assert.equal(store.doc.token, "token-2", "shared store updated too");
  await client.checkPayment("INV-1");
  assert.equal(qpay.calls.auth, 2);
});

test("store failures degrade to memory-only caching, never break the request", async () => {
  const broken = { load: async () => { throw new Error("firestore down"); }, tryLock: async () => { throw new Error("down"); }, save: async () => { throw new Error("down"); } };
  const origWarn = console.warn; const warned = [];
  console.warn = (...a) => warned.push(a.join(" "));
  try {
    const { client, qpay } = makeClient({ store: broken });
    await client.checkPayment("INV-1");
    await client.checkPayment("INV-1");
    assert.equal(qpay.calls.auth, 1, "still cached in memory");
    assert.ok(warned.some((w) => w.includes("token store")), "warned about the store");
  } finally {
    console.warn = origWarn;
  }
});

test("auth failure surfaces as QPayError; missing env is a 500 QPayError", async () => {
  const qpay = makeQPay();
  qpay.fetch = async () => jsonRes(401, { error: "bad creds" });
  const { client } = makeClient({ qpay });
  await assert.rejects(client.getToken(), (e) => e instanceof QPayError && e.status === 401);
  const { client: c2 } = makeClient({ env: { ...ENV, QPAY_PASSWORD: "" } });
  assert.equal(c2.isConfigured(), false);
  await assert.rejects(c2.getToken(), (e) => e instanceof QPayError && e.status === 500 && /QPAY_PASSWORD/.test(e.message));
});

test("isSandbox follows QPAY_BASE_URL; createInvoice builds the callback URL from APP_URL + secret", async () => {
  const { client, qpay } = makeClient();
  assert.equal(client.isSandbox(), false);
  assert.equal(makeClient({ env: { ...ENV, QPAY_BASE_URL: "https://merchant-sandbox.qpay.mn" } }).client.isSandbox(), true);
  let sent;
  const f = qpay.fetch;
  qpay.fetch = async (url, init) => { if (String(url).endsWith("/v2/invoice")) sent = JSON.parse(init.body); return f(url, init); };
  const { client: c } = makeClient({ qpay });
  await c.createInvoice({ orderId: "CS-9", amount: 9900, description: "d", receiverCode: "uid" });
  assert.equal(sent.invoice_code, "CODE");
  assert.equal(sent.amount, 9900);
  assert.equal(sent.callback_url, "https://www.champstep.mn/api/qpay/callback?order=CS-9&s=sec");
});
