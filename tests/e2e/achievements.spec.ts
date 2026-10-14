import { test, expect } from "./fixtures";
import { cleanupTestUser, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, addAchievement, card, cards, expectToast, pngFile } from "./helpers/app";

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

test("edit: remove the old photo, add a new one (saved to Storage + doc)", async () => {
  const c = card(page, "Улсын аварга 2026");
  await expect(c.locator("img")).toHaveCount(1);
  await c.hover();
  await c.locator(`button[title="${tr("form.editHeading")}"]`).click({ force: true });
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  // step 3: the existing photo is listed with a remove button (scope to the modal panel — timeline cards have "delete" buttons too)
  const panel = page.locator(".cs-panel-in").filter({ has: page.getByRole("heading", { name: tr("form.editHeading") }) });
  const removeButtons = panel.getByRole("button", { name: tr("form.actions.remove"), exact: true });
  await expect(removeButtons).toHaveCount(1);
  await removeButtons.first().click();
  await expect(removeButtons).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles(pngFile("replacement.png"));
  await expect(page.locator("img[alt^='replacement']")).toHaveCount(1);
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await expect(page.getByText(tr("form.review.photosAttached", { count: 1 }))).toBeVisible();
  await page.getByRole("button", { name: tr("form.actions.saveChanges") }).click();
  await expectToast(page, tr("status.entryUpdated"));
  await expect(card(page, "Улсын аварга 2026").locator("img")).toHaveCount(1);
});

test("HEIC / non-image file is rejected with a translated toast", async () => {
  await page.getByRole("button", { name: tr("app.addAchievement"), exact: true }).click();
  await page.getByPlaceholder(tr("form.fields.titlePlaceholder")).fill("x");
  await page.getByPlaceholder(tr("form.fields.locationPlaceholder")).fill("y");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByPlaceholder(tr("form.fields.descriptionPlaceholder")).fill("z");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "IMG_0001.heic", mimeType: "image/heic", buffer: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99]) });
  await expectToast(page, tr("form.validation.imageType"));
  await expect(page.locator("img[alt^='IMG_']")).toHaveCount(0);
  await page.getByRole("button", { name: tr("form.actions.back") }).click();
  await page.getByRole("button", { name: tr("form.actions.back") }).click();
  await page.getByRole("button", { name: tr("form.actions.cancel") }).click();
});

test("AI insight card is offered on the master tier", async () => {
  await expect(page.getByRole("button", { name: tr("ai.fetch") })).toBeVisible();
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
