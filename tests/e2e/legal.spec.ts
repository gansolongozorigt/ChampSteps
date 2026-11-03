// About / Terms: not in the desktop sidebar any more — the profile (avatar) menu opens them for
// parents, teachers and guests; screens without that menu (no child / no student yet) and the
// login page (Terms + Privacy, app store requirement) carry text links to the same pages.
import { test, expect } from "./fixtures";
import { cleanupTestUser, createInviteCodeFor, testEmail } from "./helpers/admin";
import { fillAddChildModal, newPage, nav, signUp, tr, waitForDashboard, PASSWORD } from "./helpers/app";

const acc = { email: testEmail("legal"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
const teacher = { email: testEmail("lteacher"), password: PASSWORD, name: "QA Teacher", role: "teacher" as const };
const parent2 = { email: testEmail("lparent"), password: PASSWORD, name: "QA P2", role: "parent" as const };
test.afterAll(async () => { for (const a of [acc, teacher, parent2]) await cleanupTestUser(a.email); });

const COMPANY: Record<string, RegExp> = { mn: /Чамп степ/, en: /ChampStep LLC|Champ Step LLC/, ru: /ООО «Чамп степ»/ };
const sidebarHasNo = async (page: import("@playwright/test").Page) => {
  for (const s of ["about", "terms"]) await expect(page.locator("aside").getByRole("button", { name: tr(`nav.${s}`), exact: true })).toHaveCount(0);
};

test("parent: About and Terms from the profile menu (MN/EN/RU), not in the sidebar", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await sidebarHasNo(page);
  // the plan card stays at the bottom of the sidebar
  const [card, aside] = [await page.locator("aside > div").last().boundingBox(), await page.locator("aside").boundingBox()];
  expect(Math.round(card!.y + card!.height)).toBe(Math.round(aside!.y + aside!.height));
  let prev = "mn";
  for (const [code, name] of [["mn", "Монгол"], ["en", "English"], ["ru", "Русский"]] as const) {
    await page.getByRole("button", { name: tr("app.language", {}, prev) }).click();
    prev = code;
    await page.getByRole("button", { name }).click();
    for (const s of ["about", "terms"] as const) {
      await nav(page, s, code);
      await expect(page.locator("main")).toContainText(COMPANY[code], { timeout: 10_000 });
    }
  }
});

test("teacher: links on the no-student screen, then the profile menu once a student is linked", async ({ browser }) => {
  const tp = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(tp, teacher);
  await expect(tp.getByText(tr("invite.teacher.noStudentsTitle"))).toBeVisible({ timeout: 20_000 });
  await tp.getByTestId("legal-links").getByRole("button", { name: tr("nav.terms") }).click();
  await expect(tp.getByTestId("legal-sheet")).toContainText(COMPANY.mn);
  await tp.getByTestId("legal-sheet").getByRole("button", { name: tr("goals.detail.close") }).click();

  const pp = await newPage(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await signUp(pp, parent2);
  const code = await createInviteCodeFor(teacher.email, teacher.name);
  await waitForDashboard(pp);
  await nav(pp, "coach");
  await pp.getByPlaceholder(tr("invite.parent.placeholder")).fill(code);
  await pp.getByRole("button", { name: tr("invite.parent.connectButton") }).click();
  await expect(pp.getByText(tr("invite.parent.success"))).toBeVisible();
  await tp.reload();
  await expect(tp.locator("aside").getByRole("button", { name: /Хүүхэд/ })).toBeVisible({ timeout: 20_000 });
  await sidebarHasNo(tp);
  await nav(tp, "about");
  await expect(tp.locator("main")).toContainText(COMPANY.mn);
  await nav(tp, "terms");
  await expect(tp.locator("main")).toContainText(COMPANY.mn);
});

test("guest: links on the empty screen and the profile menu", async ({ context }) => {
  const page = await newPage(context);
  await page.goto("/");
  await page.getByRole("button", { name: tr("auth.continueOffline") }).click();
  await page.getByRole("button", { name: tr("form.actions.cancel") }).click(); // close the add-child modal
  await page.getByTestId("legal-links").getByRole("button", { name: tr("nav.about") }).click();
  await expect(page.getByTestId("legal-sheet")).toContainText(COMPANY.mn);
  await page.getByTestId("legal-sheet").getByRole("button", { name: tr("goals.detail.close") }).click();
  await page.getByRole("button", { name: tr("children.empty.add") }).click();
  await fillAddChildModal(page, "Анар", "2014-03-02");
  await waitForDashboard(page);
  await sidebarHasNo(page);
  await nav(page, "terms");
  await expect(page.locator("main")).toContainText(COMPANY.mn);
});

test("login page: Terms and Privacy links open the policies", async ({ context }) => {
  const page = await newPage(context);
  await page.goto("/");
  const links = page.getByTestId("legal-links");
  await links.getByRole("button", { name: tr("terms.tabPrivacy") }).click();
  const sheet = page.getByTestId("legal-sheet");
  await expect(sheet.getByRole("tab", { name: tr("terms.tabPrivacy") })).toHaveAttribute("aria-selected", "true");
  await sheet.getByRole("button", { name: tr("goals.detail.close") }).click();
  await links.getByRole("button", { name: tr("terms.tabTerms") }).click();
  await expect(sheet).toContainText(COMPANY.mn);
});
