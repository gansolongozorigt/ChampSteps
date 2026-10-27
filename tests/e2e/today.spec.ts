// "Today" screen (/today): quick practice log, streak, 7-day strip, date navigation,
// dashboard CTA and deep link. Writes the same practiceLogs docs as the "Бэлтгэл" section.
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav } from "./helpers/app";

const acc = { email: testEmail("today"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
let page: import("@playwright/test").Page;
test.beforeAll(async ({ browser }) => {
  page = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(page, acc);
  await waitForDashboard(page);
});
test.afterAll(async () => { await cleanupTestUser(acc.email); });

const TEXT = "Өнөөдөр хэмнэл дасгал хийсэн.";

test("quick log: one tap save, inline confirm, streak and strip update", async () => {
  await nav(page, "today");
  const today = page.getByTestId("today-page");
  await expect(today).toBeVisible();
  await expect(page.getByTestId("today-streak")).toContainText(tr("today.streakNone"));
  await expect(page.getByTestId("today-empty")).toBeVisible();

  await page.getByPlaceholder(tr("today.whatPlaceholder")).fill(TEXT);
  await page.getByRole("button", { name: tr("today.minutes", { count: 45 }), exact: true }).click();
  await page.getByTestId("today-save").click();
  await expect(page.getByTestId("today-flash")).toContainText(tr("today.saved"));
  await expect(page.getByPlaceholder(tr("today.whatPlaceholder"))).toHaveValue(""); // form cleared
  const entry = page.getByTestId("today-entries").locator("li").filter({ hasText: TEXT });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText("45m");
  await expect(page.getByTestId("today-streak")).toContainText(tr("today.streak_one", { count: 1 }));
  // last cell of the 7-day strip is today and now logged
  await expect(page.locator("[data-logged]").last()).toHaveAttribute("data-logged", "1");
  expect(await page.locator("[data-logged='1']").count()).toBe(1);
});

test("date navigation: yesterday is empty, back to today keeps the entry", async () => {
  await page.getByRole("button", { name: tr("today.prevDay") }).click();
  await expect(page.getByTestId("today-date")).toContainText(tr("today.isYesterday"));
  await expect(page.getByTestId("today-empty")).toBeVisible();
  await expect(page.getByRole("button", { name: tr("today.nextDay") })).toBeEnabled();
  await page.getByRole("button", { name: tr("today.backToToday") }).click();
  await expect(page.getByTestId("today-date")).toContainText(tr("today.isToday"));
  await expect(page.getByTestId("today-entries").locator("li").filter({ hasText: TEXT })).toBeVisible();
  await expect(page.getByRole("button", { name: tr("today.nextDay") })).toBeDisabled();
});

test("same collection: the entry shows in the practice section; dashboard CTA opens Today", async () => {
  await nav(page, "practice");
  await expect(page.locator("p", { hasText: TEXT })).toBeVisible();
  await nav(page, "achievements");
  await page.getByTestId("today-cta").click();
  await expect(page.getByTestId("today-page")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/today");
});

test("deep link /today opens the Today screen after reload", async () => {
  await page.goto("/today");
  await expect(page.getByTestId("today-page")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("today-entries").locator("li").filter({ hasText: TEXT })).toBeVisible();
  // delete from Today
  await page.getByRole("button", { name: tr("practice.actions.delete"), exact: true }).first().click();
  await page.getByRole("button", { name: tr("practice.actions.confirmDelete"), exact: true }).last().click();
  await expect(page.getByTestId("today-empty")).toBeVisible();
});
