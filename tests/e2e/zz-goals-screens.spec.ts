// Screen capture for the goals review — NOT part of the regular suite.
//   SCREENS=1 npx playwright test tests/e2e/zz-goals-screens.spec.ts --project=desktop
// Writes scratch/goals/*.png at phone width (390×844). Guest (local) mode: no rules needed.
import { test, expect } from "./fixtures";
import { newPage, waitForDashboard, tr, nav, fillAddChildModal } from "./helpers/app";
import { mkdirSync } from "node:fs";

const ON = process.env.SCREENS === "1";
const DIR = "scratch/goals";
test.skip(!ON, "set SCREENS=1 to capture");
test.setTimeout(300_000);
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

test("goal card / celebration / result form at phone width", async ({ browser }) => {
  mkdirSync(DIR, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await newPage(context);
  await page.goto("/");
  await page.getByRole("button", { name: tr("auth.continueOffline") }).click();
  await expect(page.getByPlaceholder(tr("children.namePlaceholder"))).toBeVisible({ timeout: 30_000 });
  await fillAddChildModal(page, "Тэмүүлэн", "2014-02-11");
  await waitForDashboard(page);
  await nav(page, "today");
  await page.getByTestId("goal-add-card").click();
  await page.waitForTimeout(4500); // add-child toast gone
  await page.screenshot({ path: `${DIR}/goal-form-390.png` });
  await page.getByTestId("goal-title").fill("Хотын аварга шалгаруулах тэмцээн");
  const DATE = inDays(14);
  await page.getByTestId("goal-date").fill(DATE);
  await page.getByTestId("goal-sessions").fill("4");
  await page.getByTestId("goal-submit").click();
  await expect(page.getByTestId("goal-card")).toBeVisible();
  for (const [text, min] of [["Гамм, этюд давтсан.", 45], ["Шинэ хэсэг сурсан.", 60]] as const) {
    await page.getByPlaceholder(tr("today.whatPlaceholder")).fill(text);
    await page.getByRole("button", { name: tr("today.minutes", { count: min }), exact: true }).click();
    await page.getByTestId("today-save").click();
    await expect(page.getByTestId("today-flash")).toBeVisible();
    await expect(page.getByTestId("today-flash")).toBeHidden({ timeout: 10_000 });
  }
  await page.locator("main").evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(4500); // toast gone
  await page.screenshot({ path: `${DIR}/today-goal-card-390.png` });
  await page.getByTestId("goal-card").click();
  await expect(page.getByTestId("goal-detail")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/goal-detail-390.png` });
  await page.getByTestId("goal-detail").getByRole("button", { name: tr("goals.detail.close"), exact: true }).click();

  await page.clock.install({ time: new Date(DATE + "T10:00:00") });
  await page.reload(); // URL stays /today
  await expect(page.getByTestId("celebration")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DIR}/competition-day-390.png` });
  await page.getByTestId("celebration-result").click();
  await expect(page.getByTestId("result-hint")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/result-form-390.png` });
  await context.close();
});
