// iOS Safari (not installed): install banner from the 2nd open, 3-step guide, 7-day snooze,
// and the reminder toggle pointing at "install first". Runs in the mobile project (390×844).
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, openUserMenu } from "./helpers/app";

const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const acc = { email: testEmail("install"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });
test.use({ actionTimeout: 15_000 });

test("iOS tab: no banner on first open, banner + guide on second, snoozed after 'later'", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IOS_UA });
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await expect(page.getByTestId("install-banner")).toBeHidden(); // first open

  await page.reload();
  await waitForDashboard(page);
  const banner = page.getByTestId("install-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(tr("install.bannerTitle"));
  await banner.getByRole("button", { name: tr("install.how") }).click();
  const guide = page.getByTestId("install-guide");
  await expect(guide).toBeVisible();
  await expect(guide.locator("ol > li")).toHaveCount(3);
  await expect(guide).toContainText(tr("install.step2"));
  await guide.getByRole("button", { name: tr("install.done") }).click();
  await expect(guide).toBeHidden();
  await expect(banner).toBeHidden(); // snoozed

  await page.reload();
  await waitForDashboard(page);
  await expect(page.getByTestId("install-banner")).toBeHidden();

  // reminders toggle on an iOS tab → "install first" + link to the guide
  await openUserMenu(page);
  await page.getByRole("button", { name: tr("danger.account.menu") }).click();
  const rem = page.getByTestId("reminder-settings");
  await expect(rem).toBeVisible();
  await rem.getByRole("switch").first().click();
  await expect(page.getByTestId("reminder-note")).toContainText(tr("reminders.installFirst"));
  await expect(rem.getByRole("switch").first()).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: tr("reminders.howToInstall") }).click();
  await expect(page.getByTestId("install-guide")).toBeVisible();
  await context.close();
});

test("'later' on the banner snoozes it for 7 days", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IOS_UA });
  await context.addInitScript(() => { try { localStorage.setItem("champstep.openCount", "5"); } catch {} });
  const page = await newPage(context);
  await page.goto("/");
  await page.locator("#email").fill(acc.email);
  await page.locator("#password").fill(acc.password);
  await page.getByRole("button", { name: tr("auth.signIn"), exact: true }).click();
  await waitForDashboard(page);
  const banner = page.getByTestId("install-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: tr("install.later") }).click();
  await expect(banner).toBeHidden();
  const snoozedAt = await page.evaluate(() => Number(localStorage.getItem("champstep.installSnoozedAt")));
  expect(Date.now() - snoozedAt).toBeLessThan(60_000);
  await page.reload();
  await waitForDashboard(page);
  await expect(page.getByTestId("install-banner")).toBeHidden();
  await context.close();
});
