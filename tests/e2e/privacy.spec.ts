// Public privacy policy at /privacy (no sign-in) — the store listing URL.
import { test, expect } from "./fixtures";
import { newPage, tr } from "./helpers/app";

test("/privacy renders without sign-in, in mn and en, and links back", async ({ context }) => {
  const page = await newPage(context);
  await page.goto("/privacy");
  const main = page.getByTestId("privacy-page");
  await expect(main).toBeVisible();
  await expect(main).toContainText(tr("privacy.title"));
  await expect(main).toContainText(tr("privacy.s1Title"));
  await expect(main).toContainText("info@champstep.mn");
  await expect(page.locator("#email")).toHaveCount(0); // not the login page
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(main).toContainText(tr("privacy.title", {}, "en"));
  await expect(main).toContainText(tr("privacy.s3Title", {}, "en"));
});
