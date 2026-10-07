import { test, expect } from "./fixtures";
import { cleanupTestUser, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, pngFile, expectToast } from "./helpers/app";

test.describe.configure({ mode: "serial" });
const acc = { email: testEmail("children"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("child: edit profile with avatar → add second child → switch", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await setTier(acc.email, "master"); // multi-child needs a paid tier
  await page.reload();
  await waitForDashboard(page);

  // edit profile (header button in the timeline)
  await page.getByText(tr("app.editProfile"), { exact: false }).first().click();
  await expect(page.getByRole("heading", { name: tr("profile.heading") })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(pngFile("avatar.png"));
  await expect(page.locator("img[alt]").first()).toBeVisible();
  const nameInput = page.locator("label", { hasText: tr("profile.fields.name") }).locator("input");
  await nameInput.fill("Тэмүүлэн");
  await page.getByRole("button", { name: tr("profile.actions.save"), exact: true }).click();
  await expectToast(page, tr("status.savedProfile"));
  await expect(page.getByText(tr("app.achievementsTitle", { name: "Тэмүүлэн" }))).toBeVisible();

  // second child
  await page.locator("aside").getByRole("button", { name: tr("children.addChild") }).click();
  await page.getByPlaceholder(tr("children.namePlaceholder")).fill("Анар");
  await page.getByPlaceholder(tr("children.namePlaceholder")).press("Enter");
  await expectToast(page, tr("status.childAdded", { name: "Анар" }));
  await expect(page.getByText(tr("app.achievementsTitle", { name: "Анар" }))).toBeVisible();

  // switch back and forth
  await page.locator("aside").getByRole("button", { name: "Тэмүүлэн" }).click();
  await expect(page.getByText(tr("app.achievementsTitle", { name: "Тэмүүлэн" }))).toBeVisible();
  await page.locator("aside").getByRole("button", { name: "Анар" }).click();
  await expect(page.getByText(tr("app.achievementsTitle", { name: "Анар" }))).toBeVisible();
});
