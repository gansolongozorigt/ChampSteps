// Offline: a practice log written with the network cut is queued by Firestore's
// persistent cache, shown at once (pending), and reaches the server after reconnect.
import { test, expect } from "./fixtures";
import { cleanupTestUser, countChildDocs, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav } from "./helpers/app";

const acc = { email: testEmail("offline"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("offline write → banner + queued confirm → synced to Firestore after reconnect", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await nav(page, "today");
  await expect(page.getByTestId("today-empty")).toBeVisible(); // listener is live
  await expect(page.getByTestId("offline-banner")).toBeHidden();

  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toContainText(tr("offline.banner"));

  const TEXT = "Офлайн бичлэг.";
  await page.getByPlaceholder(tr("today.whatPlaceholder")).fill(TEXT);
  await page.getByTestId("today-save").click();
  await expect(page.getByTestId("today-flash")).toContainText(tr("today.queued"));
  await expect(page.getByTestId("today-entries").locator("li").filter({ hasText: TEXT })).toBeVisible();
  await expect(page.getByTestId("offline-banner")).toContainText(tr("offline.pending_one", { count: 1 }));
  expect(await countChildDocs(acc.email, "practiceLogs")).toBe(0); // not on the server yet

  await context.setOffline(false);
  await expect(page.getByTestId("offline-banner")).toBeHidden({ timeout: 90_000 }); // ack arrived, queue empty
  await expect.poll(() => countChildDocs(acc.email, "practiceLogs"), { timeout: 60_000 }).toBe(1);
  await context.close();
});
