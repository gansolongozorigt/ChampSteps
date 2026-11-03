import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav, logPractice } from "./helpers/app";

const acc = { email: testEmail("logs"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
let page: import("@playwright/test").Page;
test.beforeAll(async ({ browser }) => {
  page = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(page, acc);
  await waitForDashboard(page);
});
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("practice log: yesterday via the date row, other duration, add and delete", async () => {
  await nav(page, "practice");
  await page.getByRole("button", { name: tr("today.prevDay") }).click();
  await expect(page.getByTestId("practice-date")).toContainText(tr("today.isYesterday"));
  await expect(page.getByRole("button", { name: tr("today.nextDay") })).toBeEnabled();
  await logPractice(page, { content: "Өчигдөр 90 минут бэлтгэл хийсэн.", toImprove: "Хэмнэл", minutes: 90 });
  const item = page.getByTestId("practice-entry").filter({ hasText: "Өчигдөр 90 минут бэлтгэл хийсэн." });
  await expect(item).toBeVisible();
  await expect(item.getByTestId("practice-entry-meta")).toContainText(tr("today.minutes", { count: 90 }));
  await expect(item.getByTestId("practice-answers")).toContainText(tr("practice.q.toImprove"));
  // yesterday is logged, today is not → the streak still counts it
  await expect(page.getByTestId("practice-streak")).toContainText(tr("today.streak_one", { count: 1 }));
  await page.getByRole("button", { name: tr("today.backToToday") }).click();
  await expect(page.getByTestId("practice-date")).toContainText(tr("today.isToday"));
  await expect(page.getByRole("button", { name: tr("today.nextDay") })).toBeDisabled();
  await item.getByRole("button", { name: tr("practice.actions.delete"), exact: true }).click();
  await page.getByRole("button", { name: tr("practice.actions.confirmDelete"), exact: true }).last().click();
  await expect(item).toBeHidden();
  await expect(page.getByTestId("practice-empty")).toBeVisible();
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
