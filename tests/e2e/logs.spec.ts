import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav } from "./helpers/app";

const acc = { email: testEmail("logs"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
let page: import("@playwright/test").Page;
test.beforeAll(async ({ browser }) => {
  page = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(page, acc);
  await waitForDashboard(page);
});
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("practice log: add and delete", async () => {
  await nav(page, "practice");
  await page.getByRole("button", { name: tr("practice.addButton") }).click();
  await page.getByPlaceholder(tr("practice.fields.notesPlaceholder")).fill("Өнөөдөр 60 минут бэлтгэл хийсэн.");
  await page.getByRole("button", { name: tr("practice.actions.save"), exact: true }).click();
  await expect(page.getByPlaceholder(tr("practice.fields.notesPlaceholder"))).toBeHidden(); // form closes after save
  const item = page.locator("p", { hasText: "Өнөөдөр 60 минут бэлтгэл хийсэн." });
  await expect(item).toBeVisible();
  await page.getByRole("button", { name: tr("practice.actions.delete"), exact: true }).first().click();
  await page.getByRole("button", { name: tr("practice.actions.confirmDelete"), exact: true }).last().click();
  await expect(item).toBeHidden();
});

test.describe("reflection", () => {
  const childNote = () => page.getByPlaceholder(tr("reflection.fields.childNotePlaceholder"));
  const parentNote = () => page.getByPlaceholder(tr("reflection.fields.parentNotePlaceholder"));
  const save = () => page.getByRole("button", { name: tr("reflection.actions.save"), exact: true });
  const openForm = async () => {
    await nav(page, "reflection");
    if (!(await childNote().isVisible())) await page.getByRole("button", { name: tr("reflection.addButton") }).click();
    await expect(childNote()).toBeVisible();
  };
  const saved = async (text: string) => {
    await expect(childNote()).toBeHidden(); // form closes once the write resolved
    await expect(page.locator("p", { hasText: text })).toBeVisible();
  };

  test("child note only saves", async () => {
    await openForm();
    await childNote().fill("Хүүхэд: өнөөдөр сайхан байлаа.");
    await expect(save()).toBeEnabled();
    await save().click();
    await saved("Хүүхэд: өнөөдөр сайхан байлаа.");
  });
  test("parent note only saves and is shown", async () => {
    await openForm();
    await parentNote().fill("Эцэг эх: ахиц гаргаж байна.");
    await expect(save()).toBeEnabled();
    await save().click();
    await saved("Эцэг эх: ахиц гаргаж байна."); // parent-only note is shown without expanding
  });
  test("both notes save", async () => {
    await openForm();
    await childNote().fill("Хоёулаа: хүүхэд.");
    await parentNote().fill("Хоёулаа: эцэг эх.");
    await save().click();
    await saved("Хоёулаа: хүүхэд.");
  });
  test("both empty → save disabled", async () => {
    await openForm();
    await expect(childNote()).toHaveValue("");
    await expect(parentNote()).toHaveValue("");
    await expect(save()).toBeDisabled();
  });
});
