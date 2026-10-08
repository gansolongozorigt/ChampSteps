// AI insight is scoped to the selected child. Server: real /api/ai-insight
// handler in mock mode (tests/e2e/helpers/api-server.mjs) — echoes the prompt
// JSON, so the text shows exactly which achievements reached the model.
import { test, expect } from "./fixtures";
import { AI_API_URL } from "../../playwright.config";
import {
  aiInsightDoc, childrenOf, cleanupTestUser, createAccount, createChildFor, idTokenFor, seedAchievement, setTier, testEmail, uidByEmail,
} from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, expectToast } from "./helpers/app";

test.describe.configure({ mode: "serial" });
const parent = { email: testEmail("ai"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
const stranger = { email: testEmail("ai-other"), password: PASSWORD };
const A_TITLE = "ALPHA-Chess-Cup-2026";
const B_TITLE = "BETA-Swim-Meet-2026";
let page: import("@playwright/test").Page;
let childA: { id: string; name: string };
let childB: { id: string; name: string };

const card = () => page.getByTestId("ai-insight-card");
const text = () => page.getByTestId("ai-insight-text");
// Sidebar child buttons read "<initial> <name>" (avatar letter + name).
const pick = (name: string) => page.locator("aside").getByRole("button", { name: new RegExp(`(^|\\s)${name}$`) }).click();

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await newPage(context);
  await signUp(page, parent);
  await waitForDashboard(page);
  await setTier(parent.email, "master"); // AI + multi-child
  [childA] = await childrenOf(parent.email);
  const bId = await createChildFor(parent.email, "Анар");
  childB = { id: bId, name: "Анар" };
  await seedAchievement(childA.id, { title: A_TITLE, date: "2026-09-20", category: "Academic", awardType: "Gold", location: "Улаанбаатар" });
  await seedAchievement(childA.id, { title: "Alpha-Art-Show", date: "2026-08-01", category: "Arts", awardType: "Participant" });
  await seedAchievement(childB.id, { title: B_TITLE, date: "2026-09-25", category: "Sports", awardType: "Silver" });
  await page.reload();
  await waitForDashboard(page);
});
test.afterAll(async () => { await cleanupTestUser(parent.email); await cleanupTestUser(stranger.email); });

test("child A: insight contains only A's achievements; cache doc written for A", async () => {
  await pick(childA.name);
  await expect(page.getByText(tr("app.achievementsTitle", { name: childA.name }))).toBeVisible();
  await expect(card()).toBeVisible();
  await expect(text()).toHaveCount(0);
  await card().getByRole("button", { name: tr("ai.fetch") }).click();
  await expect(text()).toBeVisible({ timeout: 30_000 });
  const t1 = (await text().innerText());
  expect(t1).toContain(A_TITLE);
  expect(t1).toContain("Alpha-Art-Show");
  expect(t1).not.toContain(B_TITLE);
  expect(t1).toContain(`"name":"${childA.name}"`);
  await expect(card().getByText(tr("ai.footer", { name: childA.name }))).toBeVisible();
  const doc = await aiInsightDoc(childA.id);
  expect(doc?.model).toBe("mock");
  expect(doc?.language).toBe("mn");
  expect(String(doc?.text)).toContain(A_TITLE);
  expect(await aiInsightDoc(childB.id)).toBeNull();
});

test("switch to child B: card resets, B's insight has only B's achievements", async () => {
  await pick(childB.name);
  await expect(page.getByText(tr("app.achievementsTitle", { name: childB.name }))).toBeVisible();
  await expect(card()).toBeVisible();
  // no leftover text from child A
  await expect(text()).toHaveCount(0);
  await expect(card().getByText(tr("ai.empty"))).toBeVisible();
  await card().getByRole("button", { name: tr("ai.fetch") }).click();
  await expect(text()).toBeVisible({ timeout: 30_000 });
  const t2 = await text().innerText();
  expect(t2).toContain(B_TITLE);
  expect(t2).not.toContain(A_TITLE);
  expect(t2).not.toContain("Alpha-Art-Show");
  expect(t2).toContain(`"name":"${childB.name}"`);
  await expect(card().getByText(tr("ai.footer", { name: childB.name }))).toBeVisible();
});

test("back to child A: unchanged data → server serves the cache and the card says so", async () => {
  await pick(childA.name);
  await expect(page.getByText(tr("app.achievementsTitle", { name: childA.name }))).toBeVisible();
  const before = await aiInsightDoc(childA.id);
  // The card shows A's cache when the client may read aiInsights (rules deployed);
  // otherwise it starts empty — either way the first click must show A's text, not B's.
  await card().getByRole("button", { name: new RegExp(`^(${tr("ai.fetch")}|${tr("ai.refresh")})$`) }).click();
  await expect(text()).toBeVisible({ timeout: 30_000 });
  expect(await text().innerText()).toContain(A_TITLE);
  expect(await text().innerText()).not.toContain(B_TITLE);
  // Refresh with no new data → same cache, toast
  await card().getByRole("button", { name: tr("ai.refresh") }).click();
  await expectToast(page, tr("ai.noNewData"));
  expect(await text().innerText()).toContain(A_TITLE);
  const after = await aiInsightDoc(childA.id);
  expect(after?.createdAt).toEqual(before?.createdAt);
  expect(after?.dataHash).toEqual(before?.dataHash);
  // New achievement → hash changes → regenerated on refresh (no toast, new createdAt)
  await seedAchievement(childA.id, { title: "ALPHA-New-Medal", date: "2026-10-05", category: "Sports", awardType: "Bronze" });
  await expect(page.getByRole("heading", { name: "ALPHA-New-Medal" })).toBeVisible({ timeout: 20_000 });
  await card().getByRole("button", { name: tr("ai.refresh") }).click();
  await expect(text()).toContainText("ALPHA-New-Medal", { timeout: 30_000 });
  const regenerated = await aiInsightDoc(childA.id);
  expect(regenerated?.dataHash).not.toEqual(before?.dataHash);
  expect(String(regenerated?.text)).not.toContain(B_TITLE);
});

test("server: another parent gets 403 for child A; missing childId → 400; no token → 401", async () => {
  await createAccount(stranger.email, stranger.password, "parent", "master");
  const strangerToken = await idTokenFor(stranger.email);
  const post = (token: string | null, body: unknown) =>
    fetch(`${AI_API_URL}/api/ai-insight`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  const forbidden = await post(strangerToken, { childId: childA.id, language: "mn" });
  expect(forbidden.status).toBe(403);
  expect((await forbidden.json()).error).toBe("forbidden");
  const missing = await post(strangerToken, { language: "mn" });
  expect(missing.status).toBe(400);
  const unauth = await post(null, { childId: childA.id });
  expect(unauth.status).toBe(401);
  // the owner, through the same server, is fine and gets the cache (no new data)
  const ownerToken = await idTokenFor(parent.email);
  const ok = await post(ownerToken, { childId: childA.id, language: "mn" });
  expect(ok.status).toBe(200);
  const body = await ok.json();
  expect(body.cached).toBe(true);
  expect(body.insight).toContain(A_TITLE);
  expect(body.insight).not.toContain(B_TITLE);
  // the stranger's attempt must not have written anything: the cache is still the owner's
  expect((await aiInsightDoc(childA.id))?.requestedBy).toBe(await uidByEmail(parent.email));
});
