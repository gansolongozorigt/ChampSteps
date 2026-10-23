// Child age from the birth date: a guest child (localStorage only, nothing reaches
// Firestore) born 2014-07-20 shows "N настай" under the name; the profile editor
// shows the "now N — updates automatically" hint, warns when the bio has a typed-in
// age, and the header then shows "N настай · <bio without the stale age>".
import { test, expect } from "./fixtures";
import { ageFromBirthDate } from "../../shared/age.js";
import { newPage, waitForDashboard, tr, fillAddChildModal } from "./helpers/app";

const BIRTH = "2014-07-20";
/** mn has the same text for every count ("{{count}} настай"). */
const ageText = (n: number) => tr("age.years_other", { count: n });

test("guest child with a birth date: dashboard shows the computed age, profile hints, bio age stripped", async ({ context }) => {
  const age = ageFromBirthDate(BIRTH, new Date());
  expect(age).not.toBeNull();
  const page = await newPage(context);
  await page.goto("/");
  await page.getByRole("button", { name: tr("auth.continueOffline") }).click();
  await expect(page.getByPlaceholder(tr("children.namePlaceholder"))).toBeVisible({ timeout: 30_000 });
  await fillAddChildModal(page, "Үүлэн", BIRTH);
  await waitForDashboard(page);

  // header: age only (the new child has no bio)
  const line = page.getByTestId("child-age-bio");
  await expect(line).toHaveText(ageText(age!));

  // profile editor: age hint under the birth date, placeholder without an age
  await page.getByText(tr("app.editProfile")).first().click();
  await expect(page.getByTestId("profile-age-hint")).toHaveText(tr("profile.fields.ageNow", { age: ageText(age!) }));
  const bio = page.getByPlaceholder(tr("profile.fields.bioPlaceholder"));
  expect(tr("profile.fields.bioPlaceholder")).not.toMatch(/настай/);
  await expect(page.getByTestId("profile-bio-age-hint")).toHaveCount(0);
  await bio.fill("11 настай · Бүжгийн спорт, Хийл хөгжим");
  await expect(page.getByTestId("profile-bio-age-hint")).toHaveText(tr("profile.fields.bioAgeHint"));
  await page.getByRole("button", { name: tr("profile.actions.save"), exact: true }).click();
  await expect(page.getByTestId("profile-age-hint")).toBeHidden();

  // the stored bio keeps what was typed; the header shows the computed age instead of "11 настай"
  await expect(line).toHaveText(`${ageText(age!)} · Бүжгийн спорт, Хийл хөгжим`);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("champstep.child.v1") ?? "null")?.bio)).toBe("11 настай · Бүжгийн спорт, Хийл хөгжим");

  // reload: still computed from the birth date
  await page.reload();
  await waitForDashboard(page);
  await expect(page.getByTestId("child-age-bio")).toHaveText(`${ageText(age!)} · Бүжгийн спорт, Хийл хөгжим`);
});
