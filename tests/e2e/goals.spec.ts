// Goals: create → Today countdown → tagged log changes the stats → competition day
// (page.clock) → celebration screen → record the result → achievement with prep, goal done.
// NOTE: needs the goals rules deployed to the production project (firestore.rules).
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav } from "./helpers/app";

const acc = { email: testEmail("goals"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
let page: import("@playwright/test").Page;
const TITLE = "Хотын аварга";
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DATE = inDays(10);

test.beforeAll(async ({ browser }) => {
  page = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(page, acc);
  await waitForDashboard(page);
});
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("create a goal from the Today screen → countdown card + dashboard line", async () => {
  await nav(page, "today");
  await page.getByTestId("goal-add-card").click();
  await page.getByTestId("goal-title").fill(TITLE);
  await page.getByTestId("goal-date").fill(DATE);
  await page.getByTestId("goal-sessions").fill("3");
  await page.getByTestId("goal-submit").click();
  await expect(page.getByTestId("goal-form")).toBeHidden();
  const card = page.getByTestId("goal-card");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("goal-countdown")).toContainText(tr("goals.daysLeft_other", { count: 10, title: TITLE }));
  await expect(card.getByTestId("goal-stats")).toContainText(tr("goals.statsMin", { sessions: 0, minutes: 0 }));
  await expect(card).toContainText(tr("goals.weekProgress", { done: 0, target: 3 }));
  await nav(page, "achievements");
  await expect(page.getByTestId("next-goal-line")).toContainText(tr("goals.nextCompetition", { title: TITLE, count: 10 }));
});

test("free plan: a second active goal is blocked with the upgrade note", async () => {
  await nav(page, "today");
  await page.getByTestId("goal-card").click();
  await expect(page.getByTestId("goal-detail")).toBeVisible();
  await page.getByTestId("goal-detail").getByRole("button", { name: tr("goals.detail.close"), exact: true }).click();
  // the add card is gone (one goal exists); open the form via the profile editor instead
  await expect(page.getByTestId("goal-add-card")).toBeHidden();
  await nav(page, "achievements");
  await page.getByRole("button", { name: tr("app.editProfile") }).click();
  await page.getByTestId("profile-add-goal").click();
  await expect(page.getByTestId("goal-form")).toContainText(tr("goals.limitFree"));
  await expect(page.getByTestId("goal-submit")).toBeDisabled();
  await page.getByRole("button", { name: tr("goals.cancel") }).click();
});

test("a quick log is tagged with the goal: stats and detail update", async () => {
  await nav(page, "today");
  await page.getByPlaceholder(tr("today.whatPlaceholder")).fill("Гамм, этюд.");
  await page.getByRole("button", { name: tr("today.minutes", { count: 45 }), exact: true }).click();
  await page.getByTestId("today-save").click();
  await expect(page.getByTestId("today-flash")).toBeVisible();
  await expect(page.getByTestId("goal-card").getByTestId("goal-stats")).toContainText(tr("goals.statsMin", { sessions: 1, minutes: 45 }));
  await expect(page.getByTestId("goal-card")).toContainText(tr("goals.weekProgress", { done: 1, target: 3 }));
  await page.getByTestId("goal-card").click();
  const detail = page.getByTestId("goal-detail");
  await expect(detail.getByTestId("goal-detail-countdown")).toContainText(tr("goals.detail.countdown_other", { count: 10 }));
  await expect(detail).toContainText("Гамм, этюд.");
  await page.getByTestId("goal-detail").getByRole("button", { name: tr("goals.detail.close"), exact: true }).click();
});

test("competition day: celebration screen, plain view, result → achievement with prep, goal done", async () => {
  // Jump the browser clock to the competition day (Firestore data unchanged).
  await page.clock.install({ time: new Date(DATE + "T10:00:00") });
  await page.reload(); // the URL is /today, so the app reopens on the Today screen
  const cele = page.getByTestId("celebration");
  await expect(cele).toBeVisible({ timeout: 30_000 });
  await expect(cele).toContainText(tr("goals.celebration.headline", { name: "Хүүхэд", title: TITLE }));
  await expect(cele).toContainText(tr("goals.celebration.days", { days: 1, total: 11 }));
  await expect(cele).toContainText(tr("goals.celebration.minutes", { minutes: 45 }));
  await expect(cele).toContainText(tr("goals.celebration.ready"));
  await page.getByTestId("celebration-plain").click();
  await expect(cele).toBeHidden();
  await expect(page.getByTestId("goal-card").getByTestId("goal-countdown")).toContainText(tr("goals.isToday", { title: TITLE }));
  await page.getByTestId("back-to-celebration").click();
  await expect(cele).toBeVisible();

  await page.getByTestId("celebration-result").click();
  await expect(page.getByTestId("result-hint")).toBeVisible();
  await expect(page.getByPlaceholder(tr("form.fields.titlePlaceholder"))).toHaveValue(TITLE);
  await page.getByPlaceholder(tr("form.fields.locationPlaceholder")).fill("УБ");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByPlaceholder(tr("form.fields.descriptionPlaceholder")).fill("Хоёрдугаар байр.");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.saveForChild", { name: "Хүүхэд" }) }).click();
  await expect(page.getByText(tr("status.saved"), { exact: false }).first()).toBeVisible({ timeout: 20_000 });

  // goal is done: no celebration, no active card, achievement carries the prep line
  await expect(page.getByTestId("celebration")).toBeHidden();
  await expect(page.getByTestId("goal-card")).toBeHidden();
  await expect(page.getByTestId("goal-add-card")).toBeVisible();
  await nav(page, "achievements");
  await expect(page.getByTestId("prep-line")).toContainText(tr("goals.prepLineMin", { days: 1, minutes: 45 }));
  await expect(page.getByTestId("next-goal-line")).toBeHidden();
});
