// First run without a default child: a new parent sees the add-child modal once,
// closing it leaves the empty state, and the child they add becomes the dashboard.
import { test, expect } from "./fixtures";
import { childIdsOf, cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, fillAddChildModal } from "./helpers/app";

const acc = { email: testEmail("firstrun"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("new parent: no child is created; modal opens once; empty state; add child by hand", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc, { firstChild: false });

  // the modal opened by itself — nothing was created in Firestore
  await expect(page.getByPlaceholder(tr("children.namePlaceholder"))).toBeVisible({ timeout: 30_000 });
  expect(await childIdsOf(acc.email)).toEqual([]);

  // closing it → empty state, and a reload does NOT re-open the modal (once per device)
  await page.getByRole("button", { name: tr("form.actions.cancel"), exact: true }).click();
  await expect(page.getByRole("heading", { name: tr("children.empty.title") })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: tr("children.empty.title") })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByPlaceholder(tr("children.namePlaceholder"))).toBeHidden();
  expect(await childIdsOf(acc.email)).toEqual([]);

  // add by hand: name + birth date required
  await page.getByRole("button", { name: tr("children.empty.add") }).click();
  await page.getByPlaceholder(tr("children.namePlaceholder")).fill("Тэмүүлэн");
  await expect(page.getByTestId("add-child-submit")).toBeDisabled();
  await fillAddChildModal(page, "Тэмүүлэн", "2013-11-03");
  await waitForDashboard(page);
  await expect(page.getByText(tr("app.achievementsTitle", { name: "Тэмүүлэн" }))).toBeVisible();
  expect((await childIdsOf(acc.email)).length).toBe(1);
});
