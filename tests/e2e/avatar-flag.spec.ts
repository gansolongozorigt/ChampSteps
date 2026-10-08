// Avatar prototype — flag ON (VITE_AVATAR_DEV=1 dev server on AVATAR_FLAG_URL):
// the avatar sits under the child's name on the achievements screen, greets on
// app:open, reacts to a practice log, and resets when the child changes.
import { test, expect } from "./fixtures";
import { AVATAR_FLAG_URL } from "../../playwright.config";
import { cleanupTestUser, createChildFor, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, nav, tr, PASSWORD } from "./helpers/app";

test.use({ baseURL: AVATAR_FLAG_URL });
test.describe.configure({ mode: "serial" });
const acc = { email: testEmail("avatar-on"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("flag ON: avatar under the name, wave on open → idle, happy after a practice log, reset on child switch", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  const slot = page.getByTestId("avatar-slot");
  await expect(slot).toBeVisible({ timeout: 20_000 });
  // placed right under the profile header, before the medal summary
  const order = await page.evaluate(() => {
    const h = document.querySelector("main header");
    const slot = document.querySelector('[data-testid="avatar-slot"]');
    return !!h && !!slot && !!(h.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  const stage = page.getByTestId("avatar-stage");
  // app:open → wave (1.8 s) → idle
  await expect(stage).toHaveAttribute("data-state", /wave|idle/);
  await expect(stage).toHaveAttribute("data-state", "idle", { timeout: 6_000 });
  // energy ring reflects "no practice yet" (10 %)
  await expect(stage).toHaveAttribute("data-energy", "10");
  await page.screenshot({ path: "scratch/avatar-dev/achievements-flag-on.png" });

  // add a practice log → practice:added → happy; energy 10 → 25
  await nav(page, "practice");
  await page.getByRole("button", { name: tr("practice.addButton"), exact: true }).click();
  await page.getByPlaceholder(tr("practice.fields.notesPlaceholder")).fill("Дасгал 30 мин");
  await page.getByRole("button", { name: tr("practice.actions.save"), exact: true }).click();
  await expect(page.getByPlaceholder(tr("practice.fields.notesPlaceholder"))).toHaveCount(0, { timeout: 20_000 }); // form closes on success
  await nav(page, "achievements");
  // the slot remounts when we come back (section switch); the happy hold (2.2 s) may have elapsed — assert via energy
  await expect(page.getByTestId("avatar-stage")).toHaveAttribute("data-energy", "25", { timeout: 15_000 });

  // second child → slot resets (new key), greets again
  await setTier(acc.email, "master");
  await createChildFor(acc.email, "Анар");
  await page.reload();
  await waitForDashboard(page);
  await page.locator("aside").getByRole("button", { name: /(^|\s)Анар$/ }).click();
  await expect(page.getByText(tr("app.achievementsTitle", { name: "Анар" }))).toBeVisible();
  await expect(page.getByTestId("avatar-stage")).toHaveAttribute("aria-label", /^Анар:/);
  await expect(page.getByTestId("avatar-stage")).toHaveAttribute("data-energy", "10"); // Анар has no logs
});
