import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail, countChildDocs } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav } from "./helpers/app";
const acc = { email: testEmail("dbg"), password: PASSWORD, name: "QA", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });
test("debug practice save", async ({ context }) => {
  const page = await newPage(context);
  page.on("console", (m) => { if (m.type() === "error" || m.text().includes("champstep")) console.log("BROWSER:", m.text().slice(0, 200)); });
  await signUp(page, acc); await waitForDashboard(page);
  await nav(page, "practice");
  await page.getByRole("button", { name: tr("practice.addButton") }).click();
  await page.getByPlaceholder(tr("practice.fields.notesPlaceholder")).fill("debug note");
  await page.getByRole("button", { name: tr("practice.actions.save"), exact: true }).click();
  await expect(page.getByPlaceholder(tr("practice.fields.notesPlaceholder"))).toBeHidden();
  await page.waitForTimeout(3000);
  console.log("practiceLogs docs in Firestore:", await countChildDocs(acc.email, "practiceLogs"));
  console.log("list text:", (await page.locator("main").innerText()).slice(0, 300).replace(/\n/g, " | "));
});
