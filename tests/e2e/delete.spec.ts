// Child + account deletion (branch child-delete).
// Runs against the production Firebase project with qa+ accounts this spec creates
// and removes itself; /api/child/delete and /api/account/delete are served by the
// local E2E API server (real handlers, Admin SDK) — see helpers/api-server.mjs.
import { test, expect } from "./fixtures";
import { authUserGone, childFootprint, childIdsOf, cleanupTestUser, testEmail, uidByEmail, userDocExists } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav, addAchievement, expectToast, openUserMenu, fillAddChildModal } from "./helpers/app";

test.describe.configure({ mode: "serial" });
const parent = { email: testEmail("delete"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
const teacher = { email: testEmail("delete-t"), password: PASSWORD, name: "QA Teacher", role: "teacher" as const };
test.afterAll(async () => { await cleanupTestUser(parent.email); await cleanupTestUser(teacher.email); });

const EMPTY = { achievements: 0, practiceLogs: 0, reflections: 0, coachNotes: 0, inviteCodes: 0, childDoc: 0, aiInsight: 0, storageFiles: 0 };

test("parent: delete child → Firestore + Storage footprint is zero; delete account → auth user gone", async ({ context }) => {
  test.setTimeout(180_000);
  const page = await newPage(context);
  await signUp(page, parent);
  await waitForDashboard(page);

  // data to be deleted: 1 achievement with 1 photo, 1 practice log
  await addAchievement(page, { title: "Устгах тест", location: "УБ", category: "Sports", description: "Устгагдах бичлэг.", photos: 1, childName: "Хүүхэд" });
  await nav(page, "practice");
  await page.getByRole("button", { name: tr("practice.addButton") }).click();
  await page.getByPlaceholder(tr("practice.fields.notesPlaceholder")).fill("30 минут бэлтгэл.");
  await page.getByRole("button", { name: tr("practice.actions.save"), exact: true }).click();
  await expect(page.getByPlaceholder(tr("practice.fields.notesPlaceholder"))).toBeHidden();
  await nav(page, "achievements");

  const [childId] = await childIdsOf(parent.email);
  expect(childId).toBeTruthy();
  const before = await childFootprint(childId);
  expect(before.childDoc).toBe(1);
  expect(before.achievements).toBe(1);
  expect(before.practiceLogs).toBe(1);
  expect(before.storageFiles).toBe(1);

  // profile editor → Danger zone → confirm modal
  await page.getByText(tr("app.editProfile"), { exact: false }).first().click();
  await expect(page.getByRole("heading", { name: tr("profile.heading") })).toBeVisible();
  await page.getByTestId("child-delete-open").click();
  await expect(page.getByRole("heading", { name: tr("danger.child.title", { name: "Хүүхэд" }) })).toBeVisible();
  await expect(page.getByText(tr("danger.child.summary", { achievements: 1, photos: 1, practice: 1, reflections: 0 }))).toBeVisible();
  const confirm = page.getByTestId("delete-child-confirm");
  await expect(confirm).toBeDisabled();
  await page.getByTestId("delete-child-name").fill("Хүү");
  await expect(confirm).toBeDisabled();
  await page.getByTestId("delete-child-name").fill("Хүүхэд");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expectToast(page, tr("danger.child.done", { name: "Хүүхэд" }));
  await expect(page.getByRole("heading", { name: tr("children.empty.title") })).toBeVisible();
  expect(await childFootprint(childId)).toEqual(EMPTY);

  // reload: still the empty state, no default child re-created, no auto modal
  await page.reload();
  await expect(page.getByRole("heading", { name: tr("children.empty.title") })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByPlaceholder(tr("children.namePlaceholder"))).toBeHidden();
  expect(await childIdsOf(parent.email)).toEqual([]);

  // a new child can be added from the empty state; then the whole account goes
  await page.getByRole("button", { name: tr("children.empty.add") }).click();
  await fillAddChildModal(page, "Анар", "2016-02-20");
  await waitForDashboard(page);
  const uid = await uidByEmail(parent.email);
  const [childId2] = await childIdsOf(parent.email);
  expect(childId2).toBeTruthy();

  await openUserMenu(page);
  await page.getByRole("button", { name: tr("danger.account.menu") }).click();
  await expect(page.getByRole("heading", { name: tr("danger.account.heading") })).toBeVisible();
  await page.getByTestId("account-delete-open").click();
  const ok = page.getByTestId("account-delete-confirm");
  await expect(ok).toBeDisabled();
  await page.getByTestId("account-delete-email").fill(parent.email);
  await expect(ok).toBeEnabled();
  await ok.click();
  await expect(page.locator("#email")).toBeVisible({ timeout: 30_000 }); // back on the login page
  await expect(page.getByText(tr("danger.account.done"))).toBeVisible();

  expect(await authUserGone(parent.email)).toBe(true);
  expect(await userDocExists(uid)).toBe(false);
  expect(await childFootprint(childId2)).toEqual(EMPTY);
});

test("teacher: delete account from the no-students screen", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, teacher);
  await expect(page.getByRole("heading", { name: tr("invite.teacher.noStudentsTitle") })).toBeVisible({ timeout: 30_000 });
  const uid = await uidByEmail(teacher.email);
  await page.getByRole("button", { name: tr("danger.account.menu") }).click();
  await page.getByTestId("account-delete-open").click();
  await page.getByTestId("account-delete-email").fill(teacher.email);
  await page.getByTestId("account-delete-confirm").click();
  await expect(page.locator("#email")).toBeVisible({ timeout: 30_000 });
  expect(await authUserGone(teacher.email)).toBe(true);
  expect(await userDocExists(uid)).toBe(false);
});
