import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav } from "./helpers/app";

const acc = { email: testEmail("mobile"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("390×844: bottom nav has 5 tabs; modal scrolls; save buttons reachable", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);

  const bottomNav = page.locator("nav").last();
  for (const s of ["achievements", "practice", "reflection", "coach", "pdf"]) await expect(bottomNav.getByRole("button", { name: tr(`nav.${s}`), exact: true })).toBeVisible();

  // upgrade bar (free tier): dismiss → hidden, stays hidden after reload (7-day snooze)
  const bar = page.getByTestId("upgrade-bar");
  await expect(bar).toBeVisible();
  await expect(bottomNav.getByRole("button")).toHaveCount(7); // 5 tabs + dismiss + upgrade
  await bar.getByRole("button", { name: tr("sub.upgradeBarDismiss") }).click();
  await expect(bar).toBeHidden();
  await page.reload();
  await waitForDashboard(page);
  await expect(page.getByTestId("upgrade-bar")).toBeHidden();
  await expect(bottomNav.getByRole("button")).toHaveCount(5);

  // iOS safe areas: header/nav carry env(safe-area-inset-*) padding; computed value is 0 outside iOS
  const header = page.locator("header").first();
  await expect(header).toHaveClass(/safe-area-inset-top/);
  expect(await header.evaluate((el) => getComputedStyle(el).paddingTop)).toBe("0px");
  const hasRule = await page.evaluate(() => Array.from(document.styleSheets).some((ss) => { try { return Array.from(ss.cssRules).some((r) => r.cssText.includes("padding-top: env(safe-area-inset-top)")); } catch { return false; } }));
  expect(hasRule).toBe(true);
  expect(await bottomNav.evaluate((el) => el.style.paddingBottom)).toContain("safe-area-inset-bottom");

  // add-achievement modal: reach step 4 and the save button must be in the viewport
  await page.getByRole("button", { name: tr("app.addAchievement"), exact: true }).click();
  await page.getByPlaceholder(tr("form.fields.titlePlaceholder")).fill("Мобайл тест");
  await page.getByPlaceholder(tr("form.fields.locationPlaceholder")).fill("УБ");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByPlaceholder(tr("form.fields.descriptionPlaceholder")).fill("Урт тайлбар. ".repeat(40));
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  const save = page.getByRole("button", { name: tr("form.actions.saveForChild", { name: "Хүүхэд" }) });
  await save.scrollIntoViewIfNeeded().catch(() => {});
  await expect(save).toBeInViewport();
  await page.getByRole("button", { name: tr("form.actions.back") }).click();
  await page.getByRole("button", { name: tr("form.actions.back") }).click();
  await page.getByRole("button", { name: tr("form.actions.back") }).click();
  await page.getByRole("button", { name: tr("form.actions.cancel") }).click();

  // reflection save button visible on phone
  await nav(page, "reflection");
  await page.getByRole("button", { name: tr("reflection.addButton") }).click();
  await page.getByPlaceholder(tr("reflection.fields.childNotePlaceholder")).fill("мобайл");
  const rsave = page.getByRole("button", { name: tr("reflection.actions.save"), exact: true });
  await rsave.scrollIntoViewIfNeeded().catch(() => {});
  await expect(rsave).toBeInViewport();

  // subscription modal must scroll to its pay button
  await page.locator("header").getByTitle(tr("nav.subscription")).click();
  const pay = page.getByRole("button", { name: new RegExp(`${tr("sub.pay")}|${tr("sub.freePlan")}|${tr("sub.currentPlan")}`) }).first();
  await pay.scrollIntoViewIfNeeded();
  await expect(pay).toBeInViewport();
});
