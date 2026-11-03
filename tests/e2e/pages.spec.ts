// Pages redesign (2026-11): one question per page.
//   Goals (/goals, old /today) — goal with a target result → countdown card, "Зорьсон: …"
//   Practice (/practice)       — minutes + the three questions, history shows only answered ones
//   Feelings                   — "how do you feel" + focus ("what to pay attention to next")
//   competition day            — celebration with the target → result → achievement card "Зорьсон: …"
// Start tab: no active goal → Goals, active goal → Practice. Needs the 2026-11 firestore.rules
// (run with the emulator config: npm run test:e2e:emu).
import { test, expect } from "./fixtures";
import { childrenOf, cleanupTestUser, createChildFor, seedAchievement, seedPracticeLog, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav, logPractice, signIn } from "./helpers/app";

const acc = { email: testEmail("pages"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
let page: import("@playwright/test").Page;
const TITLE = "Хотын аварга";
const TARGET = tr("goals.target.gold");
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DATE = inDays(10);

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => {
  page = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(page, acc);
});
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("no active goal: the parent starts on Goals (/goals)", async () => {
  await expect(page.getByTestId("goals-page")).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe("/goals");
  // sidebar order: Goals · Practice · Feelings · Achievements · Coach · PDF
  const labels = await page.locator("aside nav button").allInnerTexts();
  expect(labels.slice(0, 6)).toEqual(["goals", "practice", "reflection", "achievements", "coach", "pdf"].map((k) => tr(`nav.${k}`)));
});

test("goal with a target result: chips, card and detail show 'Зорьсон'", async () => {
  await page.getByTestId("goal-add-card").click();
  await page.getByTestId("goal-title").fill(TITLE);
  await page.getByTestId("goal-date").fill(DATE);
  // own words first, then a preset replaces them
  await page.getByTestId("goal-target-custom").click();
  await page.getByTestId("goal-target-input").fill("Хувийн дээд амжилт");
  await page.getByTestId("goal-target-gold").click();
  await expect(page.getByTestId("goal-target-input")).toBeHidden();
  await expect(page.getByTestId("goal-target-gold")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("goal-sessions").fill("3");
  await page.getByTestId("goal-submit").click();
  await expect(page.getByTestId("goal-form")).toBeHidden();
  const card = page.getByTestId("goal-card");
  await expect(card.getByTestId("goal-countdown")).toContainText(tr("goals.daysLeft_other", { count: 10, title: TITLE }));
  await expect(card.getByTestId("goal-target-line")).toHaveText(tr("goals.targetLine", { target: TARGET }));
  await card.click();
  await expect(page.getByTestId("goal-detail-target")).toHaveText(tr("goals.targetLine", { target: TARGET }));
  await page.getByTestId("goal-detail").getByRole("button", { name: tr("goals.detail.close"), exact: true }).click();
  // no practice form, no 7-day strip on Goals
  await expect(page.getByTestId("practice-form")).toHaveCount(0);
  await expect(page.locator("[data-logged]")).toHaveCount(0);
  // free plan: a second active goal is blocked with the upgrade note
  await page.getByTestId("goal-add-card").click();
  await expect(page.getByTestId("goal-form")).toContainText(tr("goals.limitFree"));
  await expect(page.getByTestId("goal-submit")).toBeDisabled();
  await page.getByRole("button", { name: tr("goals.cancel") }).click();
});

test("practice: three questions, at least one text, history shows only the answered ones", async () => {
  await nav(page, "practice");
  await expect(page.getByTestId("practice-page")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/practice");
  await expect(page.getByTestId("practice-streak")).toContainText(tr("today.streakNone"));
  await expect(page.getByTestId("practice-save")).toBeDisabled(); // nothing written yet
  // the active goal is preselected
  await expect(page.getByTestId("goal-chips").getByRole("button", { name: TITLE })).toHaveAttribute("aria-pressed", "true");
  await logPractice(page, { wentWell: "Эргэлт тэгш болсон", learned: "Шинэ алхам", minutes: 45 });
  await expect(page.getByTestId("practice-wentWell")).toHaveValue(""); // form cleared
  const entry = page.getByTestId("practice-entry").first();
  await expect(entry.getByTestId("practice-entry-meta")).toContainText(tr("today.minutes", { count: 45 }));
  await expect(entry.getByTestId("practice-entry-meta")).toContainText(TITLE);
  await expect(entry.getByTestId("practice-answers")).toContainText(tr("practice.q.wentWell"));
  await expect(entry.getByTestId("practice-answers")).toContainText("Эргэлт тэгш болсон");
  await expect(entry.getByTestId("practice-answers")).toContainText(tr("practice.q.learned"));
  await expect(entry.getByTestId("practice-answers")).not.toContainText(tr("practice.q.toImprove"));
  await expect(page.getByTestId("practice-streak")).toContainText(tr("today.streak_one", { count: 1 }));
  await expect(page.locator("[data-logged]").last()).toHaveAttribute("data-logged", "1");
  // "what did you do" alone, another duration
  await logPractice(page, { content: "Хоёр хөдөлгөөн давтсан", minutes: 20 });
  await expect(page.getByTestId("practice-entry")).toHaveCount(2);
  await expect(page.getByTestId("practice-history").getByText("Хоёр хөдөлгөөн давтсан")).toBeVisible();
  await expect(page.getByTestId("practice-content")).toHaveValue("");
  // the goal counts both sessions
  await nav(page, "goals");
  await expect(page.getByTestId("goal-card").getByTestId("goal-stats")).toContainText(tr("goals.stats", { sessions: 2, hours: 1 }));
});

test("feelings: 'how do you feel' + focus; focus alone is enough", async () => {
  await nav(page, "reflection");
  await page.getByRole("button", { name: tr("reflection.addButton") }).click();
  await expect(page.getByText(tr("reflection.fields.childNote"), { exact: true })).toBeVisible();
  await page.getByTestId("reflection-focus").fill("Тайзан дээр гарахын өмнө амьсгалаа тайвшруулах");
  await page.getByTestId("reflection-save").click();
  await expect(page.getByTestId("reflection-focus")).toBeHidden();
  const line = page.getByTestId("reflection-focus-line").first();
  await expect(line).toContainText(tr("reflection.focusLabel"));
  await expect(line).toContainText("Тайзан дээр гарахын өмнө амьсгалаа тайвшруулах");
});

test("start tab with an active goal is Practice; /today still opens Goals", async () => {
  await page.goto("/");
  await expect(page.getByTestId("practice-page")).toBeVisible({ timeout: 30_000 });
  await page.goto("/today");
  await expect(page.getByTestId("goals-page")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("goal-card")).toBeVisible();
  await page.goto("/practice");
  await expect(page.getByTestId("practice-page")).toBeVisible({ timeout: 30_000 });
});

test("competition day: celebration with the target → result → achievement 'Зорьсон', goal in the finished list", async () => {
  await page.clock.install({ time: new Date(DATE + "T10:00:00") });
  await page.goto("/goals");
  const cele = page.getByTestId("celebration");
  await expect(cele).toBeVisible({ timeout: 30_000 });
  await expect(cele.getByTestId("celebration-target")).toHaveText(tr("goals.targetLine", { target: TARGET }));
  await expect(cele).toContainText(tr("goals.celebration.ready"));
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
  await expect(cele).toBeHidden();
  await expect(page.getByTestId("goal-card")).toHaveCount(0);
  await page.getByTestId("goals-past-toggle").click();
  const past = page.getByTestId("goal-past-item").first();
  await expect(past).toContainText(TITLE);
  await expect(past).toContainText(tr("goals.detail.done"));
  await expect(past).toContainText(tr("goals.targetLine", { target: TARGET }));
  await nav(page, "achievements");
  await expect(page.getByTestId("prep-line")).toBeVisible();
  await expect(page.getByTestId("achievement-target-line")).toHaveText(tr("goals.targetLine", { target: TARGET }));
});

// Bug: 3 children (master), every step done — on different children — and "Эхлэх алхмууд" stayed on.
test("first steps count for the whole account: done on child 1 → no card on child 2", async ({ browser }) => {
  test.setTimeout(150_000);
  const multi = { email: testEmail("steps"), password: PASSWORD, name: "QA Multi", role: "parent" as const };
  const p = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  try {
    await signUp(p, multi);
    await waitForDashboard(p);
    await setTier(multi.email, "master");
    const [first] = await childrenOf(multi.email);
    await seedAchievement(first.id, { title: "Медаль", date: "2026-09-01", category: "Sports", awardType: "Gold" });
    await seedPracticeLog(first.id, { date: "2026-09-01", duration: 30, content: "x" });
    await createChildFor(multi.email, "Хоёрдугаар"); // nothing written for this child
    await p.reload();
    await expect(p.getByTestId("goals-page")).toBeVisible({ timeout: 30_000 });
    await p.locator("aside").getByRole("button", { name: "Хоёрдугаар" }).click();
    // the 2nd child has no log / achievement of its own, yet those steps are done (account-wide)
    await expect(p.getByTestId("first-steps")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("first-step-achievement")).toHaveAttribute("data-done", "1");
    await expect(p.getByTestId("first-step-practice")).toHaveAttribute("data-done", "1");
    await expect(p.getByTestId("first-step-goal")).toHaveAttribute("data-done", "0");
    // close it on child 2 → closed on child 1 too
    await p.getByTestId("first-steps-close").click();
    await p.locator("aside button[aria-pressed]").filter({ hasText: "Хүүхэд" }).click();
    await expect(p.getByTestId("goals-page")).toBeVisible();
    await expect(p.getByTestId("first-steps")).toHaveCount(0);
  } finally {
    await cleanupTestUser(multi.email);
  }
});

test("teacher sees the new practice answers and goal target, never the feelings page", async ({ browser }) => {
  test.setTimeout(150_000);
  const { createInviteCodeFor } = await import("./helpers/admin");
  const teacher = { email: testEmail("pteacher"), password: PASSWORD, name: "QA Teacher", role: "teacher" as const };
  const tp = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  try {
    await signUp(tp, teacher);
    const code = await createInviteCodeFor(teacher.email, teacher.name);
    // the parent page's clock is on the competition day: link from a fresh page
    const pp = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
    await signIn(pp, acc);
    await nav(pp, "coach");
    await pp.getByPlaceholder(tr("invite.parent.placeholder")).fill(code);
    await pp.getByRole("button", { name: tr("invite.parent.connectButton") }).click();
    await expect(pp.getByText(tr("invite.parent.success"))).toBeVisible();

    await tp.reload();
    await expect(tp.getByText(tr("status.teacherMode"))).toBeVisible({ timeout: 20_000 });
    await nav(tp, "practice");
    await expect(tp.getByTestId("practice-form")).toHaveCount(0);
    await expect(tp.getByTestId("practice-answers").first()).toContainText("Эргэлт тэгш болсон");
    await expect(tp.getByTestId("practice-entry").first().getByRole("button", { name: tr("practice.actions.delete") })).toHaveCount(0);
    await nav(tp, "goals");
    await tp.getByTestId("goals-past-toggle").click();
    await expect(tp.getByTestId("goal-past-item").first()).toContainText(tr("goals.targetLine", { target: TARGET }));
    await expect(tp.getByTestId("goal-add-card")).toHaveCount(0);
    await expect(tp.getByTestId("first-steps")).toHaveCount(0);
    await nav(tp, "reflection");
    await expect(tp.getByText(tr("reflection.parentOnly"))).toBeVisible();
    await expect(tp.getByText("Тайзан дээр гарахын өмнө")).toHaveCount(0);
  } finally {
    await cleanupTestUser(teacher.email);
  }
});
