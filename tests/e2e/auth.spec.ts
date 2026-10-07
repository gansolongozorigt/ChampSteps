import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, signIn, signOut, waitForDashboard, tr, PASSWORD } from "./helpers/app";

test.describe.configure({ mode: "serial" });
const acc = { email: testEmail("auth"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("parent: sign up → dashboard → sign out → sign in again", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await expect(page.getByText(tr("app.achievementsTitle", { name: "Хүүхэд" }))).toBeVisible();
  await signOut(page);
  await signIn(page, acc);
  await waitForDashboard(page);
});
