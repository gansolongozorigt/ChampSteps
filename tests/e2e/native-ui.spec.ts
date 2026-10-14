// Store app rules without a device: Capacitor decides "native" from window.androidBridge, so an
// init script turns the web build into the Android shell. Plugin calls have no bridge and
// fail quietly; what we check is the UI: no purchase entry points, no install banner.
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, openUserMenu } from "./helpers/app";

const acc = { email: testEmail("native"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("native shell: no pay / upgrade / promo UI, plan + expiry only, no install banner", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    (window as unknown as { androidBridge: unknown }).androidBridge = { postMessage: () => {} };
    try { localStorage.setItem("champstep.openCount", "5"); } catch {}
  });
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  expect(await page.evaluate(() => (window as unknown as { Capacitor?: { isNativePlatform(): boolean } }).Capacitor?.isNativePlatform())).toBe(true);

  // no upgrade bar, no star button, no install banner (free tier would show all three on the web)
  await expect(page.getByTestId("upgrade-bar")).toBeHidden();
  await expect(page.locator("header").first().getByTitle(tr("nav.subscription"))).toHaveCount(0);
  await expect(page.getByTestId("install-banner")).toBeHidden();
  await expect(page.getByText(tr("sub.upgrade"), { exact: true })).toHaveCount(0);

  // subscription page: plan only, no renew / change plan / payments list
  await openUserMenu(page);
  await page.getByRole("button", { name: tr("nav.subscriptionPage") }).click();
  const sub = page.getByTestId("subscription-page");
  await expect(sub).toContainText(tr("sub.tierNames.free"));
  await expect(sub).toContainText(tr("sub.nativeNote"));
  await expect(sub.getByRole("button", { name: tr("sub.changePlan") })).toHaveCount(0);
  await expect(sub.getByRole("button", { name: tr("sub.renew") })).toHaveCount(0);
  await expect(page.getByText(tr("sub.paymentsTitle"))).toHaveCount(0);
  await expect(page.getByText(tr("promo.label"), { exact: false })).toHaveCount(0);
  await context.close();
});
