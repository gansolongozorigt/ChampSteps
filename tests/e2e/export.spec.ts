// "My data" export: a parent downloads champstep-export-YYYYMMDD.json from the
// account settings; the file parses and holds exactly their child + achievement.
import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, addAchievement, openUserMenu } from "./helpers/app";

const acc = { email: testEmail("export"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("my data: JSON download parses, children.length == 1, schemaVersion 1, photo URL listed", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await addAchievement(page, { title: "Экспортын амжилт", location: "УБ", category: "Sports", award: "Gold", description: "JSON-д орох бичлэг.", photos: 1, childName: "Хүүхэд" });

  await openUserMenu(page);
  await page.getByRole("button", { name: tr("danger.account.menu") }).click();
  await expect(page.getByRole("heading", { name: tr("danger.account.heading") })).toBeVisible();
  await expect(page.getByTestId("my-data")).toContainText(tr("myData.title"));
  await expect(page.getByTestId("export-zip")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45_000 }),
    page.getByTestId("export-json").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^champstep-export-\d{8}\.json$/);
  const path = await download.path();
  const file = JSON.parse(readFileSync(path!, "utf8"));
  expect(file.schemaVersion).toBe(1);
  expect(typeof file.exportedAt).toBe("string");
  expect(typeof file.appVersion).toBe("string");
  expect(file.scope).toBe("parent");
  expect(file.user.email).toBe(acc.email);
  expect(file.user.subscription).toBeUndefined();
  expect(file.children.length).toBe(1);
  expect(file.children[0].name).toBe("Хүүхэд");
  expect(file.children[0].achievements.length).toBe(1);
  expect(file.children[0].achievements[0].title).toBe("Экспортын амжилт");
  expect(file.children[0].achievements[0].imageURLs.length).toBe(1);
  expect(file.images.length).toBe(1);
  expect(file.images[0].zipPath).toMatch(/^images\/.+\/.+-1\.(jpg|png)$/);
  await expect(page.getByTestId("export-status")).toContainText("champstep-export-");
});
