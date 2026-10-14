import { test, expect } from "./fixtures";
import { cleanupTestUser, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD } from "./helpers/app";

const acc = { email: testEmail("legal"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
test.afterAll(async () => { await cleanupTestUser(acc.email); });

const COMPANY: Record<string, RegExp> = { mn: /Чамп степ/, en: /ChampStep LLC|Champ Step LLC/, ru: /ООО «Чамп степ»/ };

test("About and Terms name the company in MN/EN/RU", async ({ context }) => {
  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  let prev = "mn";
  for (const [code, name] of [["mn", "Монгол"], ["en", "English"], ["ru", "Русский"]] as const) {
    await page.getByRole("button", { name: tr("app.language", {}, prev) }).click();
    prev = code;
    await page.getByRole("button", { name }).click();
    for (const s of ["about", "terms"] as const) {
      await page.locator("aside").getByRole("button", { name: tr(`nav.${s}`, {}, code), exact: true }).click();
      await expect(page.locator("main")).toContainText(COMPANY[code], { timeout: 10_000 });
    }
  }
});
