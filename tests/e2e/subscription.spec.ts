import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD } from "./helpers/app";

const acc = { email: testEmail("sub"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("subscription modal opens; wrong promo code shows an error", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await page.locator("header").getByTitle(tr("nav.subscription")).click();
  await expect(page.getByRole("heading", { name: tr("sub.title") })).toBeVisible();
  await page.getByPlaceholder(tr("promo.placeholder")).fill("QA-WRONG-CODE-1");
  await page.getByRole("button", { name: tr("promo.apply"), exact: true }).click();
  const errors = ["promo.invalid", "promo.used", "promo.exhausted", "promo.expired"].map((k) => tr(k));
  await expect(page.getByText(new RegExp(errors.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")))).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(tr("promo.success", { months: 3 }).split("{{")[0].slice(0, 10))).toBeHidden();
});
