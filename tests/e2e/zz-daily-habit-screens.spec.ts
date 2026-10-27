// Screen capture for the daily-habit review — NOT part of the regular suite.
//   SCREENS=1 npx playwright test tests/e2e/zz-daily-habit-screens.spec.ts --project=desktop
// Writes scratch/daily-habit/*.png at phone width (390×844).
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav, openUserMenu } from "./helpers/app";
import { mkdirSync } from "node:fs";

const ON = process.env.SCREENS === "1";
const DIR = "scratch/daily-habit";
test.skip(!ON, "set SCREENS=1 to capture");
test.setTimeout(300_000);
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const acc = { email: testEmail("screens2"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { if (ON) await cleanupTestUser(acc.email); });

test("today / offline / install / reminders at phone width", async ({ browser }) => {
  mkdirSync(DIR, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IOS_UA });
  await context.addInitScript(() => { try { localStorage.setItem("champstep.openCount", "5"); } catch {} });
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await expect(page.getByTestId("install-banner")).toBeVisible();
  await page.screenshot({ path: `${DIR}/dashboard-install-banner-390.png` });
  await page.getByTestId("install-banner").getByRole("button", { name: tr("install.how") }).click();
  await expect(page.getByTestId("install-guide")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/install-guide-390.png` });
  await page.getByRole("button", { name: tr("install.done") }).click();

  await nav(page, "today");
  await expect(page.getByTestId("today-page")).toBeVisible();
  await page.getByPlaceholder(tr("today.whatPlaceholder")).fill("Хэмнэл, гамм 30 мин, шинэ хэсэг давтсан.");
  await page.getByTestId("today-save").click();
  await expect(page.getByTestId("today-flash")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/today-390.png` });

  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await page.getByPlaceholder(tr("today.whatPlaceholder")).fill("Офлайн бичлэг.");
  await page.getByTestId("today-save").click();
  await expect(page.getByTestId("today-flash")).toContainText(tr("today.queued"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/today-offline-390.png` });
  await context.setOffline(false);
  await expect(page.getByTestId("offline-banner")).toBeHidden({ timeout: 90_000 });

  await openUserMenu(page);
  await page.getByRole("button", { name: tr("danger.account.menu") }).click();
  await expect(page.getByTestId("reminder-settings")).toBeVisible();
  await page.getByTestId("reminder-settings").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/reminder-settings-390.png` });
  await context.close();
});
