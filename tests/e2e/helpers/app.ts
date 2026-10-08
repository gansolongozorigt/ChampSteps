// UI helpers: labels come from the Mongolian locale so tests follow i18n changes.
import { readFileSync } from "node:fs";
import type { Page, BrowserContext, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

type Dict = Record<string, unknown>;
function loadLocale(lang: string): Dict {
  return JSON.parse(readFileSync(new URL(`../../../src/i18n/locales/${lang}.json`, import.meta.url), "utf8"));
}
export const LOCALES: Record<string, Dict> = { mn: loadLocale("mn"), en: loadLocale("en"), ru: loadLocale("ru") };
export function tr(key: string, vars: Record<string, string | number> = {}, lang = "mn"): string {
  const raw = key.split(".").reduce<unknown>((o, k) => (o as Dict | undefined)?.[k], LOCALES[lang]);
  if (typeof raw !== "string") throw new Error(`missing i18n key ${lang}:${key}`);
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`));
}

/** 1×1 transparent PNG */
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
export const pngFile = (name = "photo.png") => ({ name, mimeType: "image/png", buffer: PNG });

export const PASSWORD = "Qa-" + Math.random().toString(36).slice(2, 10) + "!1";

export async function newPage(context: BrowserContext, lang = "mn"): Promise<Page> {
  await context.addInitScript((l) => { try { localStorage.setItem("champstep.lang", l); } catch {} }, lang);
  return context.newPage();
}

export interface Account { email: string; password: string; name: string; role: "parent" | "teacher" }

export async function signUp(page: Page, a: Account) {
  await page.goto("/");
  await page.getByRole("button", { name: tr("auth.toggleToSignup") }).click();
  await page.getByRole("button", { name: tr(a.role === "parent" ? "login.parent" : "login.teacher") }).click();
  await page.locator("#displayName").fill(a.name);
  await page.locator("#email").fill(a.email);
  await page.locator("#password").fill(a.password);
  await page.getByRole("button", { name: tr("auth.signUp"), exact: true }).click();
  await expect(page.locator("#email")).toBeHidden({ timeout: 30_000 });
}

export async function signIn(page: Page, a: Pick<Account, "email" | "password">) {
  await page.goto("/");
  await page.locator("#email").fill(a.email);
  await page.locator("#password").fill(a.password);
  await page.getByRole("button", { name: tr("auth.signIn"), exact: true }).click();
  await expect(page.locator("#email")).toBeHidden({ timeout: 30_000 });
}

export async function openUserMenu(page: Page) {
  // App top bar is the FIRST <header> (TimelineDashboard has its own); avatar button is its last visible button.
  await page.locator("header").first().getByRole("button").last().click();
}

export async function signOut(page: Page) {
  await openUserMenu(page);
  await page.getByRole("button", { name: tr("auth.signOut") }).click();
  await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
}

export async function waitForDashboard(page: Page) {
  await expect(page.getByRole("button", { name: tr("app.addAchievement"), exact: true })).toBeVisible({ timeout: 30_000 });
}

export async function nav(page: Page, section: "achievements" | "practice" | "reflection" | "coach" | "pdf" | "about" | "terms") {
  const label = tr(`nav.${section}`);
  const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
  const scope = isMobile ? page.locator("nav").last() : page.locator("aside");
  if (isMobile && (section === "about" || section === "terms")) {
    await openUserMenu(page);
    await page.getByRole("button", { name: label }).click();
    return;
  }
  await scope.getByRole("button", { name: label, exact: true }).click();
}

export async function expectToast(page: Page, text: string) {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
}

/** Fill the 4-step achievement form and save. */
export async function addAchievement(page: Page, a: { title: string; location: string; category: "Sports" | "Arts" | "Academic"; award?: "Gold" | "Silver" | "Bronze" | "Participant"; description: string; photos?: number; childName: string }) {
  await page.getByRole("button", { name: tr("app.addAchievement"), exact: true }).click();
  await page.getByPlaceholder(tr("form.fields.titlePlaceholder")).fill(a.title);
  await page.getByPlaceholder(tr("form.fields.locationPlaceholder")).fill(a.location);
  await field(page, "form.fields.category").locator("button", { hasText: tr(`categories.${a.category}`) }).first().click();
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  if (a.award) await field(page, "form.fields.award").locator("button", { hasText: tr(`awards.${a.award}`) }).first().click();
  await page.getByPlaceholder(tr("form.fields.descriptionPlaceholder")).fill(a.description);
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  for (let i = 0; i < (a.photos ?? 0); i++) {
    await page.locator('input[type="file"]').setInputFiles(pngFile(`photo${i}.png`));
    await expect(page.locator("img[alt^='photo']")).toHaveCount(i + 1);
  }
  await page.getByRole("button", { name: tr("form.actions.continue") }).click();
  await page.getByRole("button", { name: tr("form.actions.saveForChild", { name: a.childName }) }).click();
  await expectToast(page, tr("status.saved"));
}

/** The <label> block of a form field (AddAchievementForm / ChildProfileEditor wrap fields in <label>). */
export function field(page: Page, labelKey: string): Locator {
  return page.locator("label, div.block").filter({ has: page.locator("span", { hasText: tr(labelKey) }) }).first();
}

/** Timeline cards: <ol> month → <li> → <ul> → <li> card */
export function cards(page: Page): Locator {
  return page.locator("ol > li > ul > li");
}
export function card(page: Page, title: string): Locator {
  return cards(page).filter({ has: page.getByRole("heading", { name: title, exact: true }) }).first();
}
