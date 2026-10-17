// Visual check of the 2-column PDF cards: a qa+ parent (master tier) gets the
// layout test data (700-char note without photos, 3 photos, goal-linked with
// practice notes, 60+ char title, 12 achievements) and the 3 templates are
// downloaded to scratch/pdf-check/<local|preview>/<template>.pdf. Render them
// with `node scratch/render-png.mjs scratch/pdf-check/<dir>` and look at the PNGs.
// Against a protected Vercel preview: E2E_BASE_URL=<preview> + VERCEL_OIDC_TOKEN
// (vercel env run) — the token goes only to requests for the preview origin.
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { test, expect } from "./fixtures";
import { childrenOf, cleanupTestUser, patchAchievement, seedAchievement, seedPracticeLog, setTier, testEmail } from "./helpers/admin";
import { newPage, signUp, waitForDashboard, tr, PASSWORD, nav, addAchievement } from "./helpers/app";

const acc = { email: testEmail("pdflayout"), password: PASSWORD, name: "QA Parent", role: "parent" as const };
const CHILD = "Хүүхэд";
const OUT = process.env.PDF_CHECK_DIR ?? `scratch/pdf-check/${process.env.E2E_BASE_URL ? "preview" : "local"}`;
const TEMPLATES = ["official", "framed", "portfolio"] as const;

const SENTENCE = "Улсын аварга шалгаруулах тэмцээнд хоёр сарын турш тууштай бэлтгэл хийж, хагас шигшээд өрсөлдөгчөө давж, шигшээ тоглолтод сүүлийн минутад амжилттай довтолгоо хийж баг тамирчдынхаа хамт түрүүлсэн. ";
const LONG_NOTE = SENTENCE.repeat(5).slice(0, 700).trim();
const LONG_TITLE = "Олон улсын хүүхдийн урлагийн наадам — хөгжмийн төрөл, ганцаарчилсан тоглолт, ахлах анги";
const GOAL_ID = "qa-goal-pdf";

test.afterAll(async () => { await cleanupTestUser(acc.email); });

async function photo(name: string, w: number, h: number, bg: string, label: string) {
  const svg = Buffer.from(`<svg width="${w}" height="${h}"><text x="50%" y="50%" font-family="Helvetica, Arial" font-size="${Math.round(w / 9)}" fill="#18251D" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`);
  const buffer = await sharp({ create: { width: w, height: h, channels: 3, background: bg } }).composite([{ input: svg }]).png().toBuffer();
  return { name, mimeType: "image/png", buffer };
}

test("pdf layout: test data in, 3 templates downloaded for the visual check", async ({ context }) => {
  test.setTimeout(10 * 60_000);
  mkdirSync(OUT, { recursive: true });

  // Protected Vercel preview: short-lived OIDC token as a header, only for the preview origin.
  const base = process.env.E2E_BASE_URL;
  const oidc = process.env.VERCEL_OIDC_TOKEN;
  if (base && oidc) {
    const origin = new URL(base).origin;
    await context.route("**/*", (route) => {
      const req = route.request();
      if (req.url().startsWith(origin)) return route.continue({ headers: { ...req.headers(), "x-vercel-trusted-oidc-idp-token": oidc } });
      return route.continue();
    });
  }

  const page = await newPage(context);
  await signUp(page, acc);
  await waitForDashboard(page);
  await setTier(acc.email, "master");

  // (b) 3 photos, short note — through the UI so the photos land in Storage like real ones
  const photos = [
    await photo("photo-landscape.png", 1600, 1000, "#2F7D5B", "PHOTO 16:10"),
    await photo("photo-certificate.png", 1000, 1400, "#FFFFFF", "CERTIFICATE"),
    await photo("photo-panorama.png", 2400, 800, "#D4A24C", "PANORAMA 3:1"),
  ];
  await addAchievement(page, { title: "Гурван зурагтай амжилт", location: "Улаанбаатар", category: "Sports", award: "Gold", description: "Богино тэмдэглэл.", photoFiles: photos, childName: CHILD });
  // (c) 1 photo + preparation (prep patched in afterwards) + practice notes
  await addAchievement(page, { title: "Зургийн уралдаан — бэлтгэлтэй", location: "Соёлын төв", category: "Arts", award: "Silver", description: "Зорилгоос гарсан амжилт: бэлтгэлийн мөр, сүүлийн 3 тэмдэглэл.", photoFiles: [photos[1]], childName: CHILD });
  // (d) 60+ char title, 1 photo
  await addAchievement(page, { title: LONG_TITLE, location: "Их театр", category: "Arts", award: "Bronze", description: "60+ тэмдэгтийн гарчиг: 2 мөр хүртэл, цаашид тасална.", photoFiles: [photos[0]], childName: CHILD });

  const [child] = await childrenOf(acc.email);
  expect(child?.id).toBeTruthy();
  await patchAchievement(child.id, "Зургийн уралдаан — бэлтгэлтэй", { prep: { goalId: GOAL_ID, days: 43, sessions: 50, minutes: 1860, daysTotal: 61 } });
  for (const [date, content] of [
    ["2026-04-01", "Зураг зурах дасгал — гэрэл сүүдэр, 45 минут, маш сайн төвлөрсөн өдөр байлаа, багш магтсан"],
    ["2026-04-05", "Өнгөний хольц, акварель"],
    ["2026-04-09", "Эцсийн бүтээлээ дуусгав"],
    ["2026-04-10", "Нэмэлт бичлэг — хамгийн сүүлийн 3-т орохгүй"],
  ] as const) await seedPracticeLog(child.id, { date, duration: 45, content, goalId: date === "2026-04-10" ? undefined : GOAL_ID });
  // (a) 700-char note, no photos
  await seedAchievement(child.id, { title: "Хотын аварга — урт тэмдэглэлтэй, зураггүй", date: "2026-05-05", location: "Ústí nad Orlicí", category: "Arts", awardType: "Participant", description: LONG_NOTE });
  // (e) fill up to 12 achievements
  for (let i = 0; i < 8; i++) {
    await seedAchievement(child.id, {
      title: `Амжилт ${i + 1}`, date: `2026-${String(i + 1).padStart(2, "0")}-10`, location: i % 2 ? "Улаанбаатар" : "Дархан",
      category: (["Sports", "Academic", "Arts"] as const)[i % 3], awardType: (["Gold", "Silver", "Bronze", "Participant"] as const)[i % 4],
      description: i % 3 === 0 ? LONG_NOTE.slice(0, 300) : "Нэг мөрт тайлбар.",
    });
  }

  await page.reload();
  await waitForDashboard(page);
  await expect(page.locator("ol > li > ul > li")).toHaveCount(12, { timeout: 30_000 });

  for (const template of TEMPLATES) {
    await nav(page, "pdf");
    await page.getByTestId(`pdf-template-${template}`).click();
    await expect(page.getByText(tr("pdfPreview.title"))).toBeVisible();
    await expect(page.getByTestId(`pdf-segment-${template}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: tr("pdf.openFullscreen") })).toBeEnabled({ timeout: 90_000 });
    const downloadBtn = page.getByRole("button", { name: new RegExp("^" + tr("pdfPreview.downloadN", { n: 12 }).replace(/[()]/g, "\\$&")) });
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90_000 }), downloadBtn.click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`_${template}\\.pdf$`, "i"));
    await download.saveAs(`${OUT}/${template}.pdf`);
    await expect(page.getByText(tr("pdfPreview.title"))).toBeHidden();
  }
});
