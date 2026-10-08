// Screen capture for design review — NOT part of the regular suite.
//   SCREENS=1 SCREENS_LABEL=after npx playwright test tests/e2e/zz-screens.spec.ts --project=desktop
//   (before: start main on another port, then E2E_BASE_URL=http://127.0.0.1:5177 SCREENS_LABEL=before …)
// Writes scratch/design-refresh/<label>/<screen>-<width>.png at 390×844 and 1280×800.
import { test, expect } from "./fixtures";
import { cleanupTestUser, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, addAchievement, nav, openUserMenu } from "./helpers/app";
import { mkdirSync } from "node:fs";

const ON = process.env.SCREENS === "1";
const LABEL = process.env.SCREENS_LABEL ?? "after";
const DIR = `scratch/design-refresh/${LABEL}`;
test.skip(!ON, "set SCREENS=1 to capture");
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const acc = { email: testEmail("screens"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { if (ON) await cleanupTestUser(acc.email); });

const SIZES = [{ w: 390, h: 844 }, { w: 1280, h: 800 }];

test("capture every screen at phone and desktop width", async ({ browser }) => {
  mkdirSync(DIR, { recursive: true });
  // 1) data via a desktop context
  const setup = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p0 = await newPage(setup);
  await p0.goto("/");
  await p0.screenshot({ path: `${DIR}/login-1280.png` });
  await p0.setViewportSize({ width: 390, height: 844 });
  await p0.screenshot({ path: `${DIR}/login-390.png` });
  await p0.getByRole("button", { name: tr("auth.toggleToSignup") }).click();
  await p0.screenshot({ path: `${DIR}/signup-390.png` });
  await p0.setViewportSize({ width: 1280, height: 800 });
  await p0.goto("/");
  await signUp(p0, acc);
  await waitForDashboard(p0);
  await setTier(acc.email, "master");
  await p0.reload();
  await waitForDashboard(p0);
  const CHILD = "Хүүхэд";
  await addAchievement(p0, { title: "Улсын аварга 2026", location: "Улаанбаатар", category: "Sports", award: "Gold", description: "Жүдо бөхийн улсын аварга шалгаруулах тэмцээн.", photos: 1, childName: CHILD });
  await addAchievement(p0, { title: "Хөгжмийн наадам", location: "Дархан", category: "Arts", award: "Silver", description: "Морин хуурын тоглолт.", childName: CHILD });
  await addAchievement(p0, { title: "Математикийн олимпиад", location: "Эрдэнэт", category: "Academic", award: "Participant", description: "Аймгийн олимпиад.", childName: CHILD });
  await nav(p0, "practice");
  await p0.getByRole("button", { name: tr("practice.addButton") }).click();
  await p0.getByPlaceholder(tr("practice.fields.notesPlaceholder")).fill("Өнөөдөр 60 минут бэлтгэл хийсэн.");
  await p0.getByRole("button", { name: tr("practice.actions.save"), exact: true }).click();
  await expect(p0.getByPlaceholder(tr("practice.fields.notesPlaceholder"))).toBeHidden();
  await nav(p0, "reflection");
  if (!(await p0.getByPlaceholder(tr("reflection.fields.childNotePlaceholder")).isVisible())) await p0.getByRole("button", { name: tr("reflection.addButton") }).click();
  await p0.getByPlaceholder(tr("reflection.fields.childNotePlaceholder")).fill("Өнөөдөр сайн өдөр байлаа.");
  await p0.getByRole("button", { name: tr("reflection.actions.save"), exact: true }).click();
  await setup.close();

  // 2) capture at each size with a fresh signed-in context
  for (const { w, h } of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 });
    const page = await newPage(ctx);
    const shot = (name: string) => page.screenshot({ path: `${DIR}/${name}-${w}.png` });
    await page.goto("/");
    await page.locator("#email").fill(acc.email);
    await page.locator("#password").fill(acc.password);
    await page.getByRole("button", { name: tr("auth.signIn"), exact: true }).click();
    await waitForDashboard(page);
    await page.waitForTimeout(800);
    await shot("achievements");
    await page.getByRole("button", { name: tr("app.addAchievement"), exact: true }).click();
    await page.waitForTimeout(400);
    await shot("achievement-form");
    await page.keyboard.press("Escape").catch(() => {});
    await page.mouse.click(5, 300);
    await page.waitForTimeout(300);
    await nav(page, "practice"); await page.waitForTimeout(400); await shot("practice");
    await page.getByRole("button", { name: tr("practice.addButton") }).click(); await page.waitForTimeout(300); await shot("practice-form");
    await nav(page, "reflection"); await page.waitForTimeout(400); await shot("reflection");
    await nav(page, "coach"); await page.waitForTimeout(400); await shot("coach");
    await nav(page, "pdf"); await page.waitForTimeout(400); await shot("pdf");
    await page.getByRole("button", { name: tr("pdf.official") }).click();
    await expect(page.getByText(tr("pdfPreview.title"))).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500); await shot("pdf-preview");
    await page.keyboard.press("Escape").catch(() => {});
    await page.mouse.click(5, 300); await page.waitForTimeout(300);
    await page.locator("header").first().getByTitle(tr("nav.subscription")).click();
    await expect(page.getByRole("heading", { name: tr("sub.title") })).toBeVisible();
    await page.waitForTimeout(400); await shot("subscription-modal");
    await page.keyboard.press("Escape").catch(() => {});
    await page.mouse.click(5, 300); await page.waitForTimeout(300);
    await openUserMenu(page); await page.waitForTimeout(200); await shot("user-menu");
    await page.getByRole("button", { name: tr("nav.subscriptionPage") }).click(); await page.waitForTimeout(500); await shot("subscription-page");
    await nav(page, "about"); await page.waitForTimeout(400); await shot("about");
    await nav(page, "terms"); await page.waitForTimeout(400); await shot("terms");
    await page.getByRole("button", { name: tr("app.language") }).click(); await page.waitForTimeout(200); await shot("language-menu");
    await ctx.close();
  }
});
