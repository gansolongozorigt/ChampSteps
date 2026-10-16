// scripts/marketing/screenshots.mjs — real app screens for marketing posters / reels.
//
//   npm run marketing:shots                    (production https://www.champstep.mn, Chrome)
//   SHOTS_BASE_URL=http://127.0.0.1:5174 npm run marketing:shots   (any deployment / dev server)
//   SHOTS_PDF_ONLY=1 npm run marketing:shots                        (only the three PDF pages)
//
// Creates ONE throw-away account (qa+<ts>-marketing@champstep.mn — the e2e naming the Admin SDK
// cleanup helpers accept), seeds believable data through the Admin SDK (child "Анар", a goal 61 days
// out, 11 practice days of the last 14, 3 achievements — one with prep stats and a photo, reminders on),
// captures the screens below into scratch/marketing/ and deletes the account again (finally).
// Phone frames: 390×844 @3x. Reel frames: 430×932 @3x = 1290×2796 px (iPhone 15 Pro Max).
// PDFs: the first page of each template rendered to PNG, 1240 px wide (pdf.js in Chrome; qlmanage fallback).
// Nothing is printed that identifies a real user; no secrets are read beyond the Admin SDK bootstrap.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { childrenOf, cleanupTestUser, setTier, testEmail, uidByEmail } from "../../tests/e2e/helpers/admin.ts";
import { PASSWORD, fillAddChildModal, nav, newPage, openUserMenu, signIn, signUp, tr, waitForDashboard } from "../../tests/e2e/helpers/app.ts";

const BASE_URL = process.env.SHOTS_BASE_URL ?? "https://www.champstep.mn";
/** SHOTS_PDF_ONLY=1: account + seed + the three PDF pages only (e.g. against a dev server with a local pdfExport fix). */
const PDF_ONLY = process.env.SHOTS_PDF_ONLY === "1";
const DIR = "scratch/marketing";
const TZ = "Asia/Ulaanbaatar";
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const REEL = { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }; // 1290×2796 px
const DESKTOP = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 };
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const PDF_FILES = { official: "10-pdf-official.png", portfolio: "11-pdf-kids.png", framed: "12-pdf-gold.png" }; // legacy names kept: kids→portfolio, gold→framed

// ---- data the screens show -------------------------------------------------------------
const PARENT_NAME = "Сарнай";
const CHILD = { name: "Анар", birthDate: "2015-04-12" }; // 11 years old
const GOAL_TITLE = "Улсын аварга шалгаруулах тэмцээн";
const GOAL_IN_DAYS = 61;
const LOG_NOTES = [
  "Дебют судалсан", "Эндшпиль дасгал", "Тактикийн 20 бодлого", "Багштай хичээл", "Онлайн 3 тоглолт",
  "Хаан, бэрсийн эндшпиль", "Сицилийн хамгаалалт", "Нүүдлийн тэмдэглэл шинжилсэн", "Хурдан шатар 5 тоглолт",
  "Ладья эндшпиль", "Дебютын давталт",
];
const LOG_MINUTES = [45, 60, 30, 60, 45, 30, 45, 60, 30, 45, 60];
const MISSING_OFFSETS = new Set([9, 11, 13]); // of the last 14 days (0 = today) → 11 logged days, 9-day streak

// ---- small utils ------------------------------------------------------------------------
const ubKey = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD in Ulaanbaatar
const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const atUB = (key, hhmm) => new Date(`${key}T${hhmm}:00+08:00`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const captured = [];

async function shot(page, name, opts = {}) {
  const path = `${DIR}/${name}`;
  await page.screenshot({ path, type: "png", ...opts });
  const m = await sharp(path).metadata();
  captured.push({ file: name, width: m.width, height: m.height, bytes: statSync(path).size });
  console.log(`  ✓ ${name} ${m.width}×${m.height}`);
}
async function step(name, fn) {
  try { await fn(); }
  catch (e) { const msg = String(e?.message ?? e).split("\n")[0].slice(0, 160); failures.push(`${name}: ${msg}`); console.log(`  ✗ ${name}: ${msg}`); }
}
/** Toasts (role=status) fade after ~4 s; wait for them so they do not land in the frame. */
async function settle(page, ms = 4600) { await sleep(ms); }
/** Escape works for most modals; SubscriptionModal only closes via X / backdrop → click the backdrop corner. */
/** The seeded photo is lazy-loaded; wait until it is decoded so the thumbnail is not an empty box. */
async function waitForPhoto(page) {
  await page.waitForFunction(() => Array.from(document.images).some((i) => i.src.includes("firebasestorage") && i.complete && i.naturalWidth > 0), null, { timeout: 15_000 }).catch(() => {});
  await sleep(600);
}
async function closeModal(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(250);
  for (let i = 0; i < 3 && (await page.locator(".cs-modal-backdrop").count()) > 0; i++) {
    const x = page.locator(".cs-modal-backdrop").last().locator("button[aria-label]").first();
    if (await x.isVisible().catch(() => false)) await x.click().catch(() => {});
    else await page.mouse.click(8, 60).catch(() => {});
    await sleep(350);
  }
}

/** A photo for the achievement: a chess-board scene rendered with sharp (no real photo of anyone). */
async function fixtureImage() {
  const cells = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) cells.push(`<rect x="${300 + c * 75}" y="${100 + r * 75}" width="75" height="75" fill="${(r + c) % 2 ? "#2F7D5B" : "#DDF3E6"}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F7F2"/><stop offset="1" stop-color="#DCE5DD"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <rect x="290" y="90" width="620" height="620" rx="14" fill="#18251D"/>
    ${cells.join("")}
    <circle cx="637" cy="212" r="22" fill="#18251D"/><rect x="615" y="232" width="44" height="60" rx="8" fill="#18251D"/>
    <circle cx="487" cy="512" r="22" fill="#FFFFFF"/><rect x="465" y="532" width="44" height="60" rx="8" fill="#FFFFFF"/>
    <rect x="60" y="640" width="190" height="110" rx="16" fill="#FFFFFF" opacity=".92"/>
    <rect x="80" y="664" width="110" height="14" rx="7" fill="#2F7D5B"/><rect x="80" y="692" width="150" height="10" rx="5" fill="#B9C7BC"/><rect x="80" y="714" width="90" height="10" rx="5" fill="#B9C7BC"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

// ---- Admin SDK seeding (test account only) --------------------------------------------------
async function seed(email, today) {
  const uid = await uidByEmail(email); // initialises the Admin app (helpers/admin.ts)
  const db = getFirestore();
  const [child] = await childrenOf(email);
  if (!child) throw new Error("child not found after sign-up");
  const childId = child.id;
  const goalDate = addDays(today, GOAL_IN_DAYS);
  const goalStart = addDays(today, -20);

  // active goal, 61 days out
  const goalRef = db.collection("goals").doc();
  await goalRef.set({
    childId, parentId: uid, title: GOAL_TITLE, date: goalDate, category: "Sports",
    targetSessionsPerWeek: 5, targetMinutes: 45, status: "active",
    createdAt: Timestamp.fromDate(atUB(goalStart, "09:00")), updatedAt: Timestamp.fromDate(atUB(goalStart, "09:00")),
  });
  // the previous (done) goal the prep achievement came from
  const prevDate = addDays(today, -25);
  const prevGoalRef = db.collection("goals").doc();
  const prevStart = addDays(prevDate, -60);
  const achRef = db.collection("achievements").doc();
  await prevGoalRef.set({
    childId, parentId: uid, title: "Хотын аварга шалгаруулах тэмцээн", date: prevDate, category: "Sports",
    targetSessionsPerWeek: 5, status: "done", linkedAchievementId: achRef.id,
    createdAt: Timestamp.fromDate(atUB(prevStart, "09:00")), updatedAt: Timestamp.fromDate(atUB(prevDate, "18:00")),
  });

  // 11 practice days of the last 14, linked to the active goal
  const batch = db.batch();
  let i = 0;
  for (let off = 13; off >= 0; off--) {
    if (MISSING_OFFSETS.has(off)) continue;
    const date = addDays(today, -off);
    batch.set(db.collection("practiceLogs").doc(), {
      childId, date, duration: LOG_MINUTES[i % LOG_MINUTES.length], content: LOG_NOTES[i % LOG_NOTES.length], goalId: goalRef.id,
      createdAt: Timestamp.fromDate(atUB(date, "19:30")),
    });
    i++;
  }

  // photo for the prep achievement (Storage, same prefix the app uses → removed by cleanupTestUser)
  let imageURLs = [];
  try {
    const bucket = getStorage().bucket();
    const path = `achievements/${childId}/${Date.now()}_0_marketing.jpg`;
    const token = randomUUID();
    await bucket.file(path).save(await fixtureImage(), { contentType: "image/jpeg", metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
    imageURLs = [`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`];
  } catch (e) { failures.push(`photo upload: ${String(e?.message ?? e).slice(0, 120)}`); }

  const ach = (ref, a) => batch.set(ref, { childId, imageURLs: [], ...a, createdAt: Timestamp.fromDate(atUB(a.date, "20:00")), updatedAt: Timestamp.fromDate(atUB(a.date, "20:00")) });
  ach(achRef, {
    title: "Хотын аварга шалгаруулах тэмцээн", date: prevDate, location: "Улаанбаатар", category: "Sports", awardType: "Silver",
    description: "11 хүртэлх насны ангилалд 2-р байр. 7 тоглолтоос 5.5 оноо.", imageURLs,
    prep: { goalId: prevGoalRef.id, days: 43, sessions: 52, minutes: 31 * 60, daysTotal: 61 },
  });
  ach(db.collection("achievements").doc(), {
    title: "Сурагчдын шатрын олимпиад", date: addDays(today, -74), location: "Дархан", category: "Academic", awardType: "Gold",
    description: "Аймгийн сурагчдын шатрын олимпиадад 1-р байр.",
  });
  ach(db.collection("achievements").doc(), {
    title: "Хурдан шатрын нээлттэй тэмцээн", date: addDays(today, -131), location: "Улаанбаатар", category: "Sports", awardType: "Participant",
    description: "Анхны том тэмцээн. 9 тоглолтоос 4 оноо.",
  });

  // reminders on (users.reminders is the client-writable field the toggles read)
  batch.set(db.collection("users").doc(uid), { reminders: { daily: true, competition: true, updatedAt: FieldValue.serverTimestamp() } }, { merge: true });
  await batch.commit();
  return { goalDate, childId };
}

// ---- PDF → PNG --------------------------------------------------------------------------------
async function pdfToPng(browser, pdfPath, outPath, width = 1240) {
  const b64 = readFileSync(pdfPath).toString("base64");
  const page = await browser.newPage();
  try {
    await page.goto("about:blank");
    const dataUrl = await page.evaluate(async ({ b64, width }) => {
      const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const p = await doc.getPage(1);
      const scale = width / p.getViewport({ scale: 1 }).width;
      const vp = p.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      await p.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      return canvas.toDataURL("image/png");
    }, { b64, width });
    writeFileSync(outPath, Buffer.from(dataUrl.split(",")[1], "base64"));
  } catch (e) {
    // macOS fallback: Quick Look thumbnail, then resize to the requested width
    const tmp = `${DIR}/_ql`;
    mkdirSync(tmp, { recursive: true });
    execFileSync("qlmanage", ["-t", "-s", String(width * 2), "-o", tmp, pdfPath], { stdio: "ignore" });
    const produced = readdirSync(tmp).find((f) => f.endsWith(".png"));
    if (!produced) throw e;
    await sharp(`${tmp}/${produced}`).resize({ width }).png().toFile(outPath);
  } finally {
    await page.close();
  }
}

// ---- main ---------------------------------------------------------------------------------------
mkdirSync(DIR, { recursive: true });
const email = testEmail("marketing");
const acc = { email, password: PASSWORD, name: PARENT_NAME, role: "parent" };
const today = ubKey(new Date());
console.log(`[marketing] ${BASE_URL} · ${today} (${TZ}) → ${DIR}/`);

const browser = await chromium.launch({ channel: "chrome" });
let accountCreated = false;
try {
  const ctxOpts = { baseURL: BASE_URL, locale: "mn-MN", timezoneId: TZ, colorScheme: "light" };

  // ---------- phone context: account, forms, seeded screens ----------
  const phone = await browser.newContext({ ...ctxOpts, ...PHONE });
  const page = await newPage(phone);
  page.setDefaultTimeout(25_000);
  await signUp(page, acc, { firstChild: false });
  accountCreated = true;
  await fillAddChildModal(page, CHILD.name, CHILD.birthDate);
  await waitForDashboard(page);
  await settle(page); // "Анар-г нэмлээ" toast

  if (!PDF_ONLY) await step("13b-plans-modal", async () => {
    await page.locator("header").first().getByTitle(tr("nav.subscription")).click();
    await page.getByRole("heading", { name: tr("sub.title") }).waitFor();
    await sleep(500);
    await shot(page, "13b-plans-modal.png");
    await closeModal(page);
  });
  if (!PDF_ONLY) await step("02-goal-form", async () => {
    await nav(page, "today");
    await page.getByTestId("goal-add-card").click();
    await page.getByTestId("goal-title").fill(GOAL_TITLE);
    await page.getByTestId("goal-date").fill(addDays(today, GOAL_IN_DAYS));
    await page.getByTestId("goal-sessions").fill("5");
    await page.getByTestId("goal-minutes").fill("45");
    await page.getByTestId("goal-minutes").blur();
    await sleep(400);
    await shot(page, "02-goal-form.png");
    await page.getByRole("button", { name: tr("goals.cancel"), exact: true }).click();
    await page.getByTestId("goal-form").waitFor({ state: "hidden" });
  });

  // Paid plan (no upgrade strip in the frames, PDF templates unlocked) + all the data.
  await setTier(email, "family");
  const { goalDate } = await seed(email, today);
  await page.goto("/today");
  await page.getByTestId("goal-card").waitFor({ timeout: 40_000 }); // /today has no "add achievement" button → don't use waitForDashboard here
  await sleep(800);

  if (!PDF_ONLY) await step("13-plans", async () => {
    await nav(page, "about");
    const heading = page.getByText(tr("about.pricingHeading"), { exact: true }).first();
    await heading.waitFor();
    await heading.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.locator("main").evaluate((el) => { el.scrollTop -= 8; });
    await sleep(500);
    await shot(page, "13-plans.png");
  });
  if (!PDF_ONLY) await step("01-today-goal-nav", async () => { await page.goto("/today"); await page.getByTestId("goal-card").waitFor({ timeout: 40_000 }); await sleep(800); });
  if (!PDF_ONLY) await step("01-today-goal", async () => {
    await page.locator("main").evaluate((el) => { el.scrollTop = 0; });
    const countdown = await page.getByTestId("goal-countdown").textContent();
    if (!countdown?.includes(`${GOAL_IN_DAYS} өдөр`)) throw new Error(`countdown shows "${countdown}"`);
    await shot(page, "01-today-goal.png");
  });
  if (!PDF_ONLY) await step("03-goal-detail", async () => {
    await page.getByTestId("goal-card").click();
    await page.getByTestId("goal-detail").waitFor();
    await sleep(500);
    await shot(page, "03-goal-detail.png");
    await page.getByTestId("goal-detail").getByRole("button", { name: tr("goals.detail.close"), exact: true }).click();
    await page.getByTestId("goal-detail").waitFor({ state: "hidden" });
  });
  if (!PDF_ONLY) await step("07-quick-log", async () => {
    const box = page.getByPlaceholder(tr("today.whatPlaceholder"));
    await box.fill("Эндшпиль дасгал, тактикийн 10 бодлого");
    await page.getByRole("button", { name: tr("today.minutes", { count: 45 }), exact: true }).click();
    await box.evaluate((el) => el.closest(".cs-card")?.scrollIntoView({ block: "center" }));
    await sleep(400);
    await shot(page, "07-quick-log.png");
    await box.fill("");
  });
  if (!PDF_ONLY) await step("05-dashboard", async () => {
    await nav(page, "achievements");
    await page.getByTestId("next-goal-line").waitFor();
    await page.locator("main").evaluate((el) => { el.scrollTop = 0; });
    await waitForPhoto(page);
    await shot(page, "05-dashboard.png");
  });
  if (!PDF_ONLY) await step("06-achievement-prep", async () => {
    const prep = page.getByTestId("prep-line").first();
    await prep.waitFor();
    await prep.evaluate((el) => (el.closest("li") ?? el).scrollIntoView({ block: "start" }));
    await page.locator("main").evaluate((el) => { el.scrollTop -= 16; });
    await waitForPhoto(page);
    await shot(page, "06-achievement-prep.png");
  });
  if (!PDF_ONLY) await step("08-reminder-toggle", async () => {
    await openUserMenu(page);
    await page.getByRole("button", { name: tr("danger.account.menu") }).click();
    const rem = page.getByTestId("reminder-settings");
    await rem.waitFor();
    await rem.getByRole("switch").first().waitFor();
    for (const sw of await rem.getByRole("switch").all()) {
      await page.waitForFunction((el) => el.getAttribute("aria-checked") === "true", await sw.elementHandle(), { timeout: 10_000 });
    }
    // the throw-away account's e-mail is not part of the picture
    await page.evaluate(() => { for (const dd of document.querySelectorAll("dd")) if (/@champstep\.mn$/.test(dd.textContent ?? "")) dd.textContent = "parent@example.com"; });
    await rem.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await sleep(400);
    await shot(page, "08-reminder-toggle.png");
    await closeModal(page);
  });

  // ---------- iOS Safari tab: install guide ----------
  if (!PDF_ONLY) await step("09-install-banner", async () => {
    const ios = await browser.newContext({ ...ctxOpts, ...PHONE, userAgent: IOS_UA });
    await ios.addInitScript(() => { try { localStorage.setItem("champstep.openCount", "5"); } catch {} });
    const p = await newPage(ios);
    p.setDefaultTimeout(25_000);
    await signIn(p, acc);
    await waitForDashboard(p);
    const banner = p.getByTestId("install-banner");
    await banner.waitFor();
    await banner.getByRole("button", { name: tr("install.how") }).click();
    await p.getByTestId("install-guide").waitFor();
    await sleep(500);
    await shot(p, "09-install-banner.png");
    await ios.close();
  });

  // ---------- reel frames 1290×2796 ----------
  if (!PDF_ONLY) await step("reel", async () => {
    const reel = await browser.newContext({ ...ctxOpts, ...REEL });
    const p = await newPage(reel);
    p.setDefaultTimeout(25_000);
    await signIn(p, acc);
    await waitForDashboard(p);
    await p.goto("/today");
    await p.getByTestId("goal-card").waitFor();
    await sleep(800);
    await p.locator("main").evaluate((el) => { el.scrollTop = 0; });
    await shot(p, "01-today-goal-1290x2796.png");
    await nav(p, "achievements");
    const prep = p.getByTestId("prep-line").first();
    await prep.waitFor();
    await prep.evaluate((el) => (el.closest("li") ?? el).scrollIntoView({ block: "start" }));
    await p.locator("main").evaluate((el) => { el.scrollTop -= 16; });
    await waitForPhoto(p);
    await shot(p, "06-achievement-prep-1290x2796.png");
    await p.clock.install({ time: atUB(goalDate, "10:00") });
    await p.goto("/today");
    await p.getByTestId("celebration").waitFor({ timeout: 40_000 });
    await sleep(1500);
    await shot(p, "04-competition-day-1290x2796.png");
    await reel.close();
  });

  // ---------- competition day (browser clock = the goal's date) — last in this context ----------
  if (!PDF_ONLY) await step("04-competition-day", async () => {
    await page.clock.install({ time: atUB(goalDate, "10:00") });
    await page.goto("/today");
    await page.getByTestId("celebration").waitFor({ timeout: 40_000 });
    await sleep(1500);
    await shot(page, "04-competition-day.png");
  });
  await phone.close();

  // ---------- PDFs (desktop preview exposes the blob URL in an iframe) ----------
  await step("pdf", async () => {
    const desk = await browser.newContext({ ...ctxOpts, ...DESKTOP });
    const p = await newPage(desk);
    p.setDefaultTimeout(45_000);
    await signIn(p, acc);
    await waitForDashboard(p);
    await nav(p, "pdf");
    await p.getByTestId("pdf-template-official").click();
    await p.getByText(tr("pdfPreview.title")).waitFor();
    let lastSrc = "";
    for (const tpl of ["official", "portfolio", "framed"]) {
      await step(`pdf-${tpl}`, async () => {
        if (tpl !== "official") await p.getByTestId(`pdf-segment-${tpl}`).click();
        await p.getByRole("button", { name: tr("pdf.openFullscreen") }).waitFor();
        await p.waitForFunction((prev) => { const f = document.querySelector("iframe"); return !!f?.src && f.src !== prev; }, lastSrc, { timeout: 60_000 });
        await p.getByRole("button", { name: tr("pdf.openFullscreen") }).isEnabled();
        await p.waitForFunction(() => !document.querySelector(".animate-spin"), null, { timeout: 60_000 }).catch(() => {});
        lastSrc = await p.locator("iframe").getAttribute("src");
        const b64 = await p.evaluate(async (u) => {
          const blob = await (await fetch(u)).blob();
          return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
        }, lastSrc);
        const pdfPath = `${DIR}/pdf-${tpl}.pdf`;
        writeFileSync(pdfPath, Buffer.from(b64, "base64"));
        await pdfToPng(browser, pdfPath, `${DIR}/${PDF_FILES[tpl]}`, 1240);
        const m = await sharp(`${DIR}/${PDF_FILES[tpl]}`).metadata();
        captured.push({ file: PDF_FILES[tpl], width: m.width, height: m.height, bytes: statSync(`${DIR}/${PDF_FILES[tpl]}`).size });
        console.log(`  ✓ ${PDF_FILES[tpl]} ${m.width}×${m.height} (from ${tpl})`);
      });
    }
    await desk.close();
  });
} finally {
  if (accountCreated) {
    try { await cleanupTestUser(email); console.log("[marketing] test account removed"); }
    catch (e) { failures.push(`cleanup: ${String(e?.message ?? e).slice(0, 160)}`); }
  }
  await browser.close();
  writeFileSync(`${DIR}/manifest.json`, JSON.stringify({ baseUrl: BASE_URL, date: today, captured, failures }, null, 2));
  console.log(`\n[marketing] ${captured.length} file(s) in ${DIR}/` + (failures.length ? `\n[marketing] skipped:\n  ${failures.join("\n  ")}` : ""));
  if (existsSync(`${DIR}/_ql`)) { /* qlmanage fallback leftovers are harmless */ }
}
process.exit(failures.length ? 1 : 0);
