// First steps for new parents (src/lib/onboarding.ts, FirstStepsCard, StepPrompt).
// Guest (local) mode: child → "next competition?" → goal → "log today?" → practice → card ✓ → achievement → card gone;
// the skip path; and for an account: the one-time "remind at 20:00?" after the first practice log.
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { addAchievement, fillAddChildModal, keepReminderAsk, nav, newPage, PASSWORD, signUp, tr } from "./helpers/app";

const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const step = (page: import("@playwright/test").Page, id: string) => page.getByTestId(`first-step-${id}`);

async function startGuest(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: tr("auth.continueOffline") }).click();
  await expect(page.getByPlaceholder(tr("children.namePlaceholder"))).toBeVisible({ timeout: 30_000 });
}

test("guest: child → goal question → practice → card ticks → first achievement → card disappears", async ({ context }) => {
  test.setTimeout(120_000);
  const page = await newPage(context);
  await startGuest(page);
  await fillAddChildModal(page, "Анар", "2014-03-02", { keepGoalIntro: true });

  // 1. the goal question opens right after the first child (existing GoalForm, intro copy)
  const form = page.getByTestId("goal-form");
  await expect(form).toContainText(tr("onboarding.goalIntro.title"));
  await expect(page.getByTestId("goal-intro-hint")).toHaveText(tr("onboarding.goalIntro.hint"));
  await expect(page.getByTestId("goal-intro-skip")).toHaveText(tr("onboarding.goalIntro.skip"));
  await page.getByTestId("goal-title").fill("Хотын аварга");
  await page.getByTestId("goal-date").fill(inDays(12));
  await page.getByTestId("goal-submit").click();
  await expect(form).toBeHidden();

  // 2. "log today's practice?" → Today with the quick form focused
  await expect(page.getByTestId("practice-ask")).toContainText(tr("onboarding.practiceAsk.title"));
  await page.getByTestId("practice-ask-yes").click();
  await expect(page.getByTestId("today-page")).toBeVisible();
  await expect(page.getByPlaceholder(tr("today.whatPlaceholder"))).toBeFocused();

  // card on Today: child + goal done, practice open; guests get no reminder step
  const card = page.getByTestId("first-steps");
  await expect(card).toBeVisible();
  await expect(card).toContainText(tr("onboarding.steps.practice.why"));
  await expect(step(page, "child")).toHaveAttribute("data-done", "1");
  await expect(step(page, "goal")).toHaveAttribute("data-done", "1");
  await expect(step(page, "practice")).toHaveAttribute("data-done", "0");
  await expect(step(page, "reminder")).toHaveCount(0);

  await page.getByPlaceholder(tr("today.whatPlaceholder")).fill("Гүйлт 3 км.");
  await page.getByTestId("today-save").click();
  await expect(page.getByTestId("today-flash")).toBeVisible();
  await expect(step(page, "practice")).toHaveAttribute("data-done", "1");
  await expect(page.getByTestId("reminder-ask")).toHaveCount(0); // guest: no push

  // the achievement step opens the achievement form directly
  await step(page, "achievement").getByRole("button").click();
  await page.getByRole("button", { name: tr("form.actions.cancel") }).first().click();
  await nav(page, "achievements");
  await expect(card).toBeVisible();
  await addAchievement(page, { title: "Сургуулийн тэмцээн", location: "УБ", category: "Sports", description: "Хоёрдугаар байр.", childName: "Анар" });
  await expect(card).toHaveCount(0);
  await nav(page, "today");
  await expect(page.getByTestId("today-page")).toBeVisible();
  await expect(card).toHaveCount(0);
});

test("guest: skip the goal question, close the card — it stays closed after a reload", async ({ context }) => {
  const page = await newPage(context);
  await startGuest(page);
  await fillAddChildModal(page, "Тэмүүлэн", "2013-07-20", { keepGoalIntro: true });
  await page.getByTestId("goal-intro-skip").click();
  await expect(page.getByTestId("goal-form")).toBeHidden();
  await expect(page.getByTestId("practice-ask")).toHaveCount(0);

  // no practice log yet → the app opens on Today, the card shows the open goal step
  await expect(page.getByTestId("today-page")).toBeVisible();
  const card = page.getByTestId("first-steps");
  await expect(step(page, "goal")).toHaveAttribute("data-done", "0");
  await step(page, "goal").getByRole("button").click();
  await expect(page.getByTestId("goal-form")).toContainText(tr("goals.formTitle"));
  await page.getByRole("button", { name: tr("goals.cancel") }).click();

  await page.getByTestId("first-steps-close").click();
  await expect(card).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByTestId("today-page")).toBeVisible({ timeout: 30_000 }); // still 0 logs → Today
  await expect(card).toHaveCount(0);
  await nav(page, "achievements");
  await expect(card).toHaveCount(0);
});

test.describe("account", () => {
  const parent = { email: testEmail("onboard"), password: PASSWORD, name: "QA Onboard", role: "parent" as const };
  test.afterAll(async () => { await cleanupTestUser(parent.email); });

  test("first practice log asks once for the 20:00 reminder; the card has a reminder step", async ({ context }) => {
    test.setTimeout(120_000);
    const page = await newPage(context);
    await keepReminderAsk(page);
    await signUp(page, parent); // first child + goal question skipped by the helper
    await expect(page.getByTestId("today-page")).toBeVisible({ timeout: 30_000 });
    await expect(step(page, "reminder")).toHaveAttribute("data-done", "0");

    await page.getByPlaceholder(tr("today.whatPlaceholder")).fill("Сунгалт 20 мин.");
    await page.getByTestId("today-save").click();
    const ask = page.getByTestId("reminder-ask");
    await expect(ask).toContainText(tr("onboarding.reminderAsk.title"));
    await page.getByTestId("reminder-ask-no").click();
    await expect(ask).toBeHidden();

    // second log: not asked again; the card step still opens the same question
    await page.getByPlaceholder(tr("today.whatPlaceholder")).fill("Гамм.");
    await page.getByTestId("today-save").click();
    await expect(page.getByTestId("today-flash")).toBeVisible();
    await expect(ask).toHaveCount(0);
    await step(page, "reminder").getByRole("button").click();
    await expect(ask).toBeVisible();
    await page.getByTestId("reminder-ask-no").click();

    // with a practice log the app no longer forces Today
    await page.goto("/");
    await expect(page.getByRole("button", { name: tr("app.addAchievement"), exact: true })).toBeVisible({ timeout: 30_000 });
  });
});
