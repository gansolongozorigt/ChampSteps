// Goals in guest (local) mode — the same UI flow as goals.spec.ts but on localStorage,
// so it runs before the goals rules are deployed. Covers: create → countdown → tagged log →
// stats → competition day (page.clock) → celebration → result → achievement with prep, goal done.
import { test, expect } from "./fixtures";
import { newPage, waitForDashboard, tr, fillAddChildModal, nav } from "./helpers/app";

const TITLE = "Хотын аварга";
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DATE = inDays(10);

test("guest: goal lifecycle from creation to the recorded result", async ({ context }) => {
  test.setTimeout(150_000);
  const page = await newPage(context);
  await page.goto("/");
  await page.getByRole("button", { name: tr("auth.continueOffline") }).click();
  await expect(page.getByPlaceholder(tr("children.namePlaceholder"))).toBeVisible({ timeout: 30_000 });
  await fillAddChildModal(page, "Тэмүүлэн", "2014-02-11");
  await waitForDashboard(page);

  // create
  await nav(page, "today");
  await page.getByTestId("goal-add-card").click();
  await page.getByTestId("goal-submit").click(); // validation: both required fields
  await expect(page.getByTestId("goal-form")).toContainText(tr("form.validation.required"));
  await page.getByTestId("goal-title").fill(TITLE);
  await page.getByTestId("goal-date").fill(DATE);
  await page.getByTestId("goal-sessions").fill("3");
  await page.getByTestId("goal-submit").click();
  await expect(page.getByTestId("goal-form")).toBeHidden();
  const card = page.getByTestId("goal-card");
  await expect(card.getByTestId("goal-countdown")).toContainText(tr("goals.daysLeft_other", { count: 10, title: TITLE }));
  expect((await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("champstep.goals.v1.")))).length).toBe(1);

  // free plan: second goal blocked
  await nav(page, "achievements");
  await expect(page.getByTestId("next-goal-line")).toContainText(tr("goals.nextCompetition", { title: TITLE, count: 10 }));
  await page.getByRole("button", { name: tr("app.editProfile") }).click();
  await page.getByTestId("profile-add-goal").click();
  await expect(page.getByTestId("goal-submit")).toBeDisabled();
  await page.getByRole("button", { name: tr("goals.cancel") }).click();

  // tagged log
  await nav(page, "today");
  await page.getByPlaceholder(tr("today.whatPlaceholder")).fill("Гамм, этюд.");
  await page.getByRole("button", { name: tr("today.minutes", { count: 45 }), exact: true }).click();
  await page.getByTestId("today-save").click();
  await expect(card.getByTestId("goal-stats")).toContainText(tr("goals.statsMin", { sessions: 1, minutes: 45 }));
  await expect(card).toContainText(tr("goals.weekProgress", { done: 1, target: 3 }));
  await card.click();
  await expect(page.getByTestId("goal-detail")).toContainText("Гамм, этюд.");
  await page.getByTestId("goal-detail").getByRole("button", { name: tr("goals.detail.close"), exact: true }).click();

  // competition day
  await page.clock.install({ time: new Date(DATE + "T10:00:00") });
  await page.reload(); // the URL is /today, so the app reopens on the Today screen
  const cele = page.getByTestId("celebration");
  await expect(cele).toBeVisible({ timeout: 30_000 });
  await expect(cele).toContainText(tr("goals.celebration.headline", { name: "Тэмүүлэн", title: TITLE }));
  await expect(cele).toContainText(tr("goals.celebration.days", { days: 1, total: 11 }));
  await expect(cele).toContainText(tr("goals.celebration.minutes", { minutes: 45 }));
  await page.getByTestId("celebration-plain").click();
  await expect(cele).toBeHidden();
  await expect(card.getByTestId("goal-countdown")).toContainText(tr("goals.isToday", { title: TITLE }));
  await page.getByTestId("back-to-celebration").click();

  // result → achievement
  await page.getByTestId("celebration-result").click();
  await expect(page.getByTestId("result-hint")).toBeVisible();
  await expect(page.getByPlaceholder(tr("form.fields.titlePlaceholder"))).toHaveValue(TITLE);
  await page.getByPlaceholder(tr("form.fields.locationPlaceholder")).fill("УБ");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByPlaceholder(tr("form.fields.descriptionPlaceholder")).fill("Хоёрдугаар байр.");
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.saveForChild", { name: "Тэмүүлэн" }) }).click();
  await expect(page.getByTestId("celebration")).toBeHidden();
  await expect(page.getByTestId("goal-add-card")).toBeVisible();
  await nav(page, "achievements");
  await expect(page.getByTestId("prep-line")).toContainText(tr("goals.prepLineMin", { days: 1, minutes: 45 }));
  await expect(page.getByTestId("next-goal-line")).toBeHidden();
  const goals = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("champstep.goals.v1.")); return k ? JSON.parse(localStorage.getItem(k)!) : []; });
  expect(goals[0].status).toBe("done");
  expect(typeof goals[0].linkedAchievementId).toBe("string");
});
