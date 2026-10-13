// Guest ("continue without an account") mode in production: everything stays in
// localStorage, nothing touches Firestore; the data survives a reload; signing up
// from the banner offers to move the trial data into the new account once.
import { test, expect } from "./fixtures";
import { childIdsOf, cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, waitForDashboard, tr, PASSWORD, addAchievement, fillAddChildModal, card } from "./helpers/app";

const acc = { email: testEmail("guest"), password: PASSWORD, name: "QA Guest", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("guest: add child + achievement locally, survive reload, migrate on sign-up", async ({ context }) => {
  const page = await newPage(context);
  await page.goto("/");
  await page.getByRole("button", { name: tr("auth.continueOffline") }).click();

  // first run: the add-child modal opens by itself; the child is stored locally only
  await expect(page.getByPlaceholder(tr("children.namePlaceholder"))).toBeVisible({ timeout: 30_000 });
  await fillAddChildModal(page, "Тэмүүлэн", "2014-02-11");
  await waitForDashboard(page);
  await expect(page.getByTestId("guest-banner")).toBeVisible();
  await expect(page.getByTestId("guest-banner")).toContainText(tr("guest.banner"));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("champstep.child.v1") ?? "null")?.name)).toBe("Тэмүүлэн");

  // achievement without photos (the photo step explains that photos need an account)
  await page.getByRole("button", { name: tr("app.addAchievement"), exact: true }).click();
  await page.getByPlaceholder(tr("form.fields.titlePlaceholder")).fill("Туршилтын амжилт");
  await page.getByPlaceholder(tr("form.fields.locationPlaceholder")).fill("УБ");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByPlaceholder(tr("form.fields.descriptionPlaceholder")).fill("Локал горимд бичсэн.");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await expect(page.getByTestId("photos-locked")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.saveForChild", { name: "Тэмүүлэн" }) }).click();
  await expect(card(page, "Туршилтын амжилт")).toBeVisible();
  await addAchievement(page, { title: "Хоёр дахь амжилт", location: "Сургууль", category: "Academic", award: "Silver", description: "Мөн локал.", childName: "Тэмүүлэн" });

  // reload: guest session, child and both achievements are still there; no error toast
  await page.reload();
  await waitForDashboard(page);
  await expect(page.getByTestId("guest-banner")).toBeVisible();
  await expect(card(page, "Туршилтын амжилт")).toBeVisible();
  await expect(card(page, "Хоёр дахь амжилт")).toBeVisible();
  await expect(page.getByText(tr("status.errorSaving"))).toHaveCount(0);

  // banner → sign-up form (opens in sign-up mode) → migration prompt
  await page.getByTestId("guest-signup").click();
  await expect(page.locator("#displayName")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: tr("login.parent") }).click();
  await page.locator("#displayName").fill(acc.name);
  await page.locator("#email").fill(acc.email);
  await page.locator("#password").fill(acc.password);
  await page.getByRole("button", { name: tr("auth.signUp"), exact: true }).click();
  await expect(page.getByTestId("migrate-yes")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(tr("guest.migrateTitle"))).toBeVisible();
  expect(await childIdsOf(acc.email)).toEqual([]);

  await page.getByTestId("migrate-yes").click();
  await waitForDashboard(page);
  await expect(page.getByText(tr("app.achievementsTitle", { name: "Тэмүүлэн" }))).toBeVisible({ timeout: 30_000 });
  await expect(card(page, "Туршилтын амжилт")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("guest-banner")).toHaveCount(0);
  expect((await childIdsOf(acc.email)).length).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("champstep.child.v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("champstep.offlineUser.v1"))).toBeNull();

  // a reload now shows the account's data from Firestore
  await page.reload();
  await waitForDashboard(page);
  await expect(card(page, "Туршилтын амжилт")).toBeVisible({ timeout: 30_000 });
});
