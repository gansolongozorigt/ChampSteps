import { test, expect } from "./fixtures";
import { cleanupTestUser, createInviteCodeFor, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav } from "./helpers/app";

// not serial: each test is self-sufficient (invite code is created server-side in test 2)
const parent = { email: testEmail("tparent"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
const teacher = { email: testEmail("teacher"), password: PASSWORD, name: "QA Teacher", role: "teacher" as const };
let parentPage: import("@playwright/test").Page;
let teacherPage: import("@playwright/test").Page;

test.beforeAll(async ({ browser }) => {
  parentPage = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(parentPage, parent);
  await waitForDashboard(parentPage);
  teacherPage = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(teacherPage, teacher);
});
test.afterAll(async () => { await cleanupTestUser(parent.email); await cleanupTestUser(teacher.email); });

test("new teacher lands in teacher mode and can create an invite code", async () => {
  // Expected: teacher banner + coach section reachable right after sign-up.
  await expect(teacherPage.getByText(tr("status.teacherMode"))).toBeVisible({ timeout: 20_000 });
  // no students yet → the invite panel is shown directly (no dashboard/nav)
  await expect(teacherPage.getByText(tr("invite.teacher.noStudentsTitle"))).toBeVisible();
  await teacherPage.getByRole("button", { name: tr("invite.teacher.createButton") }).click();
  const code = teacherPage.getByText(tr("invite.teacher.codeLabel")).locator("xpath=following-sibling::p[1]");
  await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
});

test("parent links with invite code → teacher sees child, writes coach note, cannot see reflections", async () => {
  const code = await createInviteCodeFor(teacher.email, teacher.name); // server-side, independent of the previous test
  await nav(parentPage, "coach");
  await parentPage.getByPlaceholder(tr("invite.parent.placeholder")).fill(code);
  await parentPage.getByRole("button", { name: tr("invite.parent.connectButton") }).click();
  await expect(parentPage.getByText(tr("invite.parent.success"))).toBeVisible();

  await teacherPage.reload();
  await expect(teacherPage.getByText(tr("status.teacherMode"))).toBeVisible({ timeout: 20_000 });
  await expect(teacherPage.locator("aside").getByRole("button", { name: "Хүүхэд" })).toBeVisible();
  await nav(teacherPage, "coach");
  await teacherPage.getByPlaceholder(tr("coach.placeholder", { name: "Хүүхэд" })).fill("Багш: дараагийн долоо хоногт техник дээр ажиллана.");
  await teacherPage.getByRole("button", { name: tr("coach.addButton") }).click();
  await expect(teacherPage.getByText("Багш: дараагийн долоо хоногт техник дээр ажиллана.")).toBeVisible();
  await nav(teacherPage, "reflection");
  await expect(teacherPage.getByText(tr("reflection.parentOnly"))).toBeVisible();
  // parent sees the note too
  await nav(parentPage, "coach");
  await expect(parentPage.getByText("Багш: дараагийн долоо хоногт техник дээр ажиллана.")).toBeVisible();
});

test("invalid invite code shows an error, not success", async () => {
  await nav(parentPage, "coach");
  const reconnect = parentPage.getByRole("button", { name: tr("invite.parent.reconnect") });
  if (await reconnect.isVisible()) await reconnect.click();
  await parentPage.getByPlaceholder(tr("invite.parent.placeholder")).fill("ZZZZZ9");
  await parentPage.getByRole("button", { name: tr("invite.parent.connectButton") }).click();
  await expect(parentPage.getByText(tr("invite.parent.errors.invalid"))).toBeVisible();
  await expect(parentPage.getByText(tr("invite.parent.success"))).toBeHidden();
});
