import { test, expect } from "./fixtures";
import { cleanupTestUser, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav, addAchievement } from "./helpers/app";

const acc = { email: testEmail("i18n"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

const RAW_KEY = /\b(app|nav|auth|form|status|pdf|pdfPreview|sub|promo|pay|reflection|practice|coach|invite|children|about|terms|login|delete|card|search|summary|empty|profile|ai|admin|categories|awards)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/;

async function scan(page: import("@playwright/test").Page, label: string, problems: string[]) {
  const text = await page.locator("body").innerText();
  if (text.includes("[object")) problems.push(`${label}: "[object" in text`);
  if (/\bundefined\b|\bNaN\b/.test(text)) problems.push(`${label}: undefined/NaN in text`);
  const m = text.match(RAW_KEY);
  if (m) problems.push(`${label}: raw i18n key "${m[0]}"`);
  const empties = await page.locator("button:visible, h1:visible, h2:visible, h3:visible").evaluateAll((els) =>
    els.filter((e) => !e.textContent?.trim() && !e.getAttribute("aria-label") && !e.getAttribute("title") && !e.querySelector("svg,img")).length);
  if (empties) problems.push(`${label}: ${empties} empty button/heading(s)`);
}

test("MN → EN → RU: main screens show no raw keys / [object] / empty labels", async ({ context }) => {
  test.setTimeout(300_000); // 3 languages × 8 screens
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await setTier(acc.email, "master");
  await page.reload();
  await waitForDashboard(page);
  await addAchievement(page, { title: "i18n тест", location: "УБ", category: "Arts", description: "Орчуулгын шалгалт.", childName: "Хүүхэд" });

  const problems: string[] = [];
  let prev = "mn";
  for (const [code, name] of [["mn", "Монгол"], ["en", "English"], ["ru", "Русский"]] as const) {
    await page.getByRole("button", { name: tr("app.language", {}, prev) }).click();
    prev = code;
    await page.getByRole("button", { name }).click();
    await expect(page.locator("aside").getByRole("button", { name: tr("nav.achievements", {}, code), exact: true })).toBeVisible();
    for (const s of ["achievements", "practice", "reflection", "coach", "pdf", "about", "terms"] as const) {
      await page.locator("aside").getByRole("button", { name: tr(`nav.${s}`, {}, code), exact: true }).click();
      await scan(page, `${code}/${s}`, problems);
    }
    await page.locator("header").first().getByTitle(tr("nav.subscription", {}, code)).click();
    await expect(page.getByRole("heading", { name: tr("sub.title", {}, code) })).toBeVisible();
    await scan(page, `${code}/subscription`, problems);
    await page.mouse.click(5, 400); // backdrop click closes the modal
    await expect(page.getByRole("heading", { name: tr("sub.title", {}, code) })).toBeHidden();
  }
  expect(problems, problems.join("\n")).toEqual([]);
  void nav;
});
