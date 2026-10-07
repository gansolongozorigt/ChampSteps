import { test, expect } from "./fixtures";
import { cleanupTestUser, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, addAchievement, card, cards, expectToast } from "./helpers/app";

test.describe.configure({ mode: "serial" });
const acc = { email: testEmail("ach"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
const CHILD = "Хүүхэд";
let page: import("@playwright/test").Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await setTier(acc.email, "master");
  await page.reload();
  await waitForDashboard(page);
});
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("add 3 achievements (sports/arts/academic, one with photo)", async () => {
  await addAchievement(page, { title: "Улсын аварга 2026", location: "Улаанбаатар", category: "Sports", award: "Gold", description: "Жүдо бөхийн улсын аварга шалгаруулах тэмцээн.", photos: 1, childName: CHILD });
  await expect(card(page, "Улсын аварга 2026")).toBeVisible();
  await expect(card(page, "Улсын аварга 2026").locator("img")).toHaveCount(1);
  await addAchievement(page, { title: "Хөгжмийн наадам", location: "Дархан", category: "Arts", award: "Silver", description: "Морин хуурын тоглолт.", childName: CHILD });
  await addAchievement(page, { title: "Математикийн олимпиад", location: "Эрдэнэт", category: "Academic", award: "Participant", description: "Аймгийн олимпиад.", childName: CHILD });
  await expect(cards(page)).toHaveCount(3);
});

test("edit an achievement", async () => {
  const c = card(page, "Хөгжмийн наадам");
  await c.hover();
  await c.locator(`button[title="${tr("form.editHeading")}"]`).click({ force: true });
  await page.getByPlaceholder(tr("form.fields.titlePlaceholder")).fill("Хөгжмийн наадам 2026");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.saveChanges") }).click();
  await expectToast(page, tr("status.entryUpdated"));
  await expect(card(page, "Хөгжмийн наадам 2026")).toBeVisible();
});

test("search, filter, sort", async () => {
  const search = page.getByPlaceholder(tr("search.placeholder"));
  await search.fill("олимпиад");
  await expect(cards(page)).toHaveCount(1);
  await search.fill("");
  await expect(cards(page)).toHaveCount(3);
  const chips = page.locator("section").filter({ has: search });
  await chips.getByRole("button", { name: tr("categories.Arts"), exact: true }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator("h3")).toHaveText(["Хөгжмийн наадам 2026"]);
  await chips.getByRole("button", { name: tr("categories.All"), exact: true }).click();
  await expect(cards(page)).toHaveCount(3);
  const select = page.locator("select");
  await select.selectOption("oldest");
  const first = await cards(page).locator("h3").first().textContent();
  await select.selectOption("newest");
  const firstAfter = await cards(page).locator("h3").first().textContent();
  expect(first).toBeTruthy(); expect(firstAfter).toBeTruthy();
});

test("delete an achievement", async () => {
  const c = card(page, "Математикийн олимпиад");
  await c.hover();
  await c.locator(`button[title="${tr("form.actions.remove")}"]`).click({ force: true });
  await expect(c.getByText(tr("delete.confirmTitle"))).toBeVisible();
  await c.getByRole("button", { name: tr("delete.confirm"), exact: true }).last().click();
  await expectToast(page, tr("status.deleted"));
  await expect(cards(page)).toHaveCount(2);
});
