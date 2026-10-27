// Screen capture for the first-steps review — NOT part of the regular suite.
//   SCREENS=1 npx playwright test tests/e2e/zz-onboarding-screens.spec.ts --project=desktop
// Writes scratch/onboarding/*.png at 375×812 (small phone). Guest (local) mode for the flow,
// one qa+ account for the reminder question (cleaned up afterwards). mn + en + ru for the card.
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { addAchievement, keepReminderAsk, nav, newPage, PASSWORD, signUp, tr } from "./helpers/app";
import { mkdirSync } from "node:fs";

const ON = process.env.SCREENS === "1";
const DIR = "scratch/onboarding";
test.skip(!ON, "set SCREENS=1 to capture");
test.setTimeout(300_000);
const VIEW = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const shot = async (page: import("@playwright/test").Page, name: string) => { await page.waitForTimeout(600); await page.screenshot({ path: `${DIR}/${name}.png` }); }; // let section fade-ins finish
async function toastGone(page: import("@playwright/test").Page) { await page.waitForTimeout(4500); }

for (const lang of ["mn", "en", "ru"] as const) {
  test(`first steps flow at 375px (${lang})`, async ({ browser }) => {
    mkdirSync(DIR, { recursive: true });
    const context = await browser.newContext(VIEW);
    const page = await newPage(context, lang);
    const T = (k: string, v: Record<string, string | number> = {}) => tr(k, v, lang);
    await page.goto("/");
    await page.getByRole("button", { name: T("auth.continueOffline") }).click();
    await expect(page.getByPlaceholder(T("children.namePlaceholder"))).toBeVisible({ timeout: 30_000 });
    await page.getByPlaceholder(T("children.namePlaceholder")).fill("Анар");
    await page.getByTestId("add-child-birthdate").fill("2014-03-02");
    await page.getByTestId("add-child-submit").click();

    await expect(page.getByTestId("goal-form")).toBeVisible();
    await toastGone(page);
    await shot(page, `${lang}-01-goal-question`);
    await page.getByTestId("goal-title").fill(lang === "mn" ? "Хотын аварга шалгаруулах тэмцээн" : lang === "en" ? "City championship" : "Первенство города");
    await page.getByTestId("goal-date").fill(inDays(14));
    await page.getByTestId("goal-submit").click();

    await expect(page.getByTestId("practice-ask")).toBeVisible();
    await toastGone(page);
    await shot(page, `${lang}-02-practice-question`);
    await page.getByTestId("practice-ask-yes").click();
    await expect(page.getByTestId("today-page")).toBeVisible();
    await page.locator("main").evaluate((el) => { el.scrollTop = 0; });
    await shot(page, `${lang}-03-today-card`);

    await page.getByPlaceholder(T("today.whatPlaceholder")).fill(lang === "mn" ? "Гүйлт 3 км, сунгалт." : lang === "en" ? "3 km run, stretching." : "Бег 3 км, растяжка.");
    await page.getByTestId("today-save").click();
    await expect(page.getByTestId("first-step-practice")).toHaveAttribute("data-done", "1");
    await page.locator("main").evaluate((el) => { el.scrollTop = 0; });
    await shot(page, `${lang}-04-today-card-practice-done`);

    await nav(page, "achievements", lang);
    await expect(page.getByTestId("first-steps")).toBeVisible();
    await page.locator("main").evaluate((el) => { el.scrollTop = 0; });
    await shot(page, `${lang}-05-dashboard-card`);
    if (lang === "mn") {
      // opened from the card's "first achievement" step
      await addAchievement(page, { title: "Сургуулийн тэмцээн", location: "УБ", category: "Sports", description: "Хоёрдугаар байр.", childName: "Анар" },
        () => page.getByTestId("first-step-achievement").getByRole("button").click());
      await expect(page.getByTestId("first-steps")).toHaveCount(0);
      await toastGone(page);
      await page.locator("main").evaluate((el) => { el.scrollTop = 0; });
      await shot(page, `${lang}-06-dashboard-all-done`);
    }
    await context.close();
  });
}

test.describe("account", () => {
  const parent = { email: testEmail("onbshot"), password: PASSWORD, name: "QA Screens", role: "parent" as const };
  test.afterAll(async () => { await cleanupTestUser(parent.email); });
  test("reminder question + 5-step card at 375px (mn)", async ({ browser }) => {
    const context = await browser.newContext(VIEW);
    const page = await newPage(context);
    await keepReminderAsk(page);
    await signUp(page, parent);
    await expect(page.getByTestId("today-page")).toBeVisible({ timeout: 30_000 });
    await toastGone(page);
    await page.locator("main").evaluate((el) => { el.scrollTop = 0; });
    await shot(page, "mn-07-account-card-5-steps");
    await page.getByPlaceholder(tr("today.whatPlaceholder")).fill("Сунгалт 20 мин.");
    await page.getByTestId("today-save").click();
    await expect(page.getByTestId("reminder-ask")).toBeVisible();
    await shot(page, "mn-08-reminder-question");
    await page.getByTestId("reminder-ask-no").click();
    await context.close();
  });
});
