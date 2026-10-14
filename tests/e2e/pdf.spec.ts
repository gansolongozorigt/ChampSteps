import { test, expect } from "./fixtures";
import { cleanupTestUser, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav, addAchievement } from "./helpers/app";

const acc = { email: testEmail("pdf"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

const TEMPLATES = ["official", "framed", "portfolio"] as const;

test("pdf: free plan sees 3 templates, official opens, framed/portfolio are locked and route to upgrade", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await addAchievement(page, { title: "PDF тест амжилт", location: "УБ", category: "Sports", description: "PDF-д орох бичлэг.", childName: "Хүүхэд" });

  await nav(page, "pdf");
  for (const id of TEMPLATES) await expect(page.getByTestId(`pdf-template-${id}`)).toBeVisible();
  await expect(page.getByTestId("pdf-template-official")).not.toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("pdf-template-framed")).toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("pdf-template-portfolio")).toHaveAttribute("data-locked", "true");
  // no emoji in the template names
  for (const id of TEMPLATES) expect(tr(`pdf.${id}`)).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);

  // Official works on the free plan: preview opens with the segmented control, 2 locked segments
  await page.getByTestId("pdf-template-official").click();
  await expect(page.getByText(tr("pdfPreview.title"))).toBeVisible();
  await expect(page.getByTestId("pdf-segment-official")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pdf-segment-framed")).toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("pdf-segment-portfolio")).toHaveAttribute("data-locked", "true");
  await expect(page.getByRole("button", { name: tr("pdf.openFullscreen") })).toBeEnabled({ timeout: 45_000 });

  // a locked segment routes to the subscription modal
  await page.getByTestId("pdf-segment-framed").click();
  await expect(page.getByRole("heading", { name: tr("sub.title") })).toBeVisible();
});

test("pdf: paid plan can pick all 3 templates, preview re-renders, fullscreen tab, download", async ({ context }) => {
  const page = await newPage(context);
  await page.goto("/");
  await page.locator("#email").fill(acc.email);
  await page.locator("#password").fill(acc.password);
  await page.getByRole("button", { name: tr("auth.signIn"), exact: true }).click();
  await waitForDashboard(page);
  await setTier(acc.email, "master");
  await page.reload();
  await waitForDashboard(page);

  await nav(page, "pdf");
  for (const id of TEMPLATES) await expect(page.getByTestId(`pdf-template-${id}`)).not.toHaveAttribute("data-locked", "true");
  await page.getByTestId("pdf-template-official").click();
  await expect(page.getByText(tr("pdfPreview.title"))).toBeVisible();
  const fullscreen = page.getByRole("button", { name: tr("pdf.openFullscreen") });
  await expect(fullscreen).toBeEnabled({ timeout: 45_000 });
  await expect(page.locator("iframe")).toBeVisible();

  for (const id of ["framed", "portfolio"] as const) {
    await page.getByTestId(`pdf-segment-${id}`).click();
    await expect(page.getByTestId(`pdf-segment-${id}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("pdf-template-desc")).toContainText(tr(`pdf.${id}Desc`));
    await expect(fullscreen).toBeEnabled({ timeout: 45_000 });
  }

  const downloadBtn = page.getByRole("button", { name: new RegExp("^" + tr("pdfPreview.downloadN", { n: 1 }).replace(/[()]/g, "\\$&")) });
  await expect(downloadBtn).toBeEnabled();

  const [popup] = await Promise.all([context.waitForEvent("page"), fullscreen.click()]);
  expect(popup.url()).toMatch(/^blob:/);
  await popup.close();

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45_000 }),
    downloadBtn.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/_portfolio\.pdf$/i);
});
