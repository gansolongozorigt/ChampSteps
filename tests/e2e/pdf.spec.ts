import { test, expect } from "./fixtures";
import { cleanupTestUser, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav, addAchievement } from "./helpers/app";

const acc = { email: testEmail("pdf"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("pdf: templates listed, preview opens, fullscreen tab, download", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await setTier(acc.email, "master");
  await page.reload();
  await waitForDashboard(page);
  await addAchievement(page, { title: "PDF тест амжилт", location: "УБ", category: "Sports", description: "PDF-д орох бичлэг.", childName: "Хүүхэд" });

  await nav(page, "pdf");
  const templates = ["official", "gold", "portfolio", "framed"].map((k) => page.getByRole("button", { name: tr(`pdf.${k}`) }));
  let visible = 0;
  for (const tpl of templates) if (await tpl.isVisible()) visible++;
  expect(visible).toBeGreaterThanOrEqual(3);

  await templates[0].click();
  await expect(page.getByText(tr("pdfPreview.title"))).toBeVisible();
  const fullscreen = page.getByRole("button", { name: tr("pdf.openFullscreen") });
  await expect(fullscreen).toBeEnabled({ timeout: 45_000 });
  await expect(page.locator("iframe")).toBeVisible();

  const [popup] = await Promise.all([context.waitForEvent("page"), fullscreen.click()]);
  expect(popup.url()).toMatch(/^blob:/);
  await popup.close();

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45_000 }),
    page.getByRole("button", { name: new RegExp("^" + tr("pdfPreview.downloadN", { n: 1 }).replace(/[()]/g, "\\$&")) }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
});
