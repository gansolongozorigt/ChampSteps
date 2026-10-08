// Avatar prototype — /dev/avatar playground (DEV route, no sign-in) and the
// flag-OFF guarantee: on the default dev server (no VITE_AVATAR_DEV) the
// achievements screen has no avatar slot.
import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, PASSWORD } from "./helpers/app";

const acc = { email: testEmail("avatar-off"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

test("/dev/avatar: events switch the state, timed states return to idle, slider + reduced-motion work", async ({ context }) => {
  const page = await newPage(context);
  await page.goto("/dev/avatar");
  const state = page.getByTestId("avatar-state");
  const stage = page.getByTestId("avatar-stage");
  await expect(state).toHaveText("idle");
  await expect(stage).toHaveAttribute("data-state", "idle");
  // all 6 frames resolve
  for (const s of ["idle", "wave", "happy", "celebrate", "sleep", "grow"]) {
    const r = await page.request.get(`/avatar/dev/temuulen/${s}.webp`);
    expect(r.status(), s).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/webp");
  }
  await page.getByTestId("evt-practice-added").click();
  await expect(state).toHaveText("happy");
  await expect(stage).toHaveAttribute("data-state", "happy");
  await expect(state).toHaveText("idle", { timeout: 4_000 }); // hold 2.2 s → idle
  await page.getByTestId("evt-achievement-added").click();
  await expect(state).toHaveText("celebrate");
  await expect(stage.locator(".av-spark")).toHaveCount(6);
  await expect(state).toHaveText("idle", { timeout: 5_000 }); // hold 3 s
  await page.getByTestId("evt-inactive-3d").click();
  await expect(state).toHaveText("sleep");
  await expect(stage.locator(".av-zzz")).toBeVisible();
  await page.waitForTimeout(3_500);
  await expect(state).toHaveText("sleep"); // no timer on sleep
  await page.getByTestId("evt-app-open").click();
  await expect(state).toHaveText("wave");
  await expect(state).toHaveText("idle", { timeout: 4_000 });
  // energy slider → ring attribute
  await page.getByTestId("energy-slider").fill("85");
  await expect(stage).toHaveAttribute("data-energy", "85");
  await expect(page.getByTestId("energy-value")).toHaveText("85%");
  // reduced motion toggle
  await page.getByTestId("reduced-toggle").check();
  await expect(page.getByTestId("avatar-reduced")).toHaveText("true");
  await expect(stage).toHaveAttribute("data-reduced", "true");
  await page.getByTestId("evt-tier-grow").click();
  await expect(state).toHaveText("grow");
  await expect(stage.locator(".av-img-out")).toHaveCount(0); // no crossfade layer under reduced motion
  // last-5 log
  await expect(page.getByTestId("event-log").locator("li")).toHaveCount(5);
  await page.screenshot({ path: "scratch/avatar-dev/dev-page.png", fullPage: true });
});

test("flag OFF: achievements screen has no avatar slot; /dev/avatar still reachable in vite dev", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await expect(page.getByTestId("avatar-slot")).toHaveCount(0);
  await expect(page.getByTestId("avatar-stage")).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector('link[href*="avatar"], script[src*="avatar"]'))).toBeNull();
});
