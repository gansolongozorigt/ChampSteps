// node --import tsx --test tests/pdf-templates.test.mjs
// Renders the 3 PDF templates in Node (jsPDF node build, NotoSans from public/,
// sharp-made fixture images) and writes them to scratch/pdf-3/ for visual review.
// Also covers the legacy template-id map and the header-only image size parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import {
  PDF_TEMPLATES, PAID_PDF_TEMPLATES, LEGACY_TEMPLATE_MAP, normalizePdfTemplate, isPaidTemplate,
  dataUrlDims, exportPortfolio,
} from "../src/lib/pdfExport.ts";
import mn from "../src/i18n/locales/mn.json" with { type: "json" };

const OUT = new URL("../scratch/pdf-3/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// --- i18n: same lookup the app does (i18next-style {{var}} interpolation, mn) ---
function t(key, vars = {}) {
  const v = key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), mn);
  if (typeof v !== "string") return key;
  return v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}

const fonts = {
  regular: readFileSync(new URL("../public/NotoSans-Regular.ttf", import.meta.url)).toString("base64"),
  bold: readFileSync(new URL("../public/NotoSans-Bold.ttf", import.meta.url)).toString("base64"),
};

/** Fixture images: a landscape photo, a portrait "certificate", a square avatar. */
async function fixtures() {
  const svgText = (w, h, text, size, fill) =>
    Buffer.from(`<svg width="${w}" height="${h}"><text x="50%" y="50%" font-family="Helvetica, Arial" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`);
  const landscape = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#2F7D5B" } })
    .composite([{ input: svgText(1600, 1000, "PHOTO 16:10", 140, "#DDF3E6") }]).jpeg({ quality: 82 }).toBuffer();
  const certificate = await sharp({ create: { width: 1000, height: 1400, channels: 3, background: "#FFFFFF" } })
    .composite([
      { input: Buffer.from(`<svg width="1000" height="1400"><rect x="40" y="40" width="920" height="1320" fill="none" stroke="#18251D" stroke-width="10"/><rect x="70" y="70" width="860" height="1260" fill="none" stroke="#2F7D5B" stroke-width="4"/></svg>`) },
      { input: svgText(1000, 1400, "CERTIFICATE", 110, "#18251D") },
    ]).jpeg({ quality: 85 }).toBuffer();
  const avatar = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#C9D6CE" } })
    .composite([{ input: svgText(600, 800, "T", 320, "#18251D") }]).png().toBuffer();
  return {
    landscape: `data:image/jpeg;base64,${landscape.toString("base64")}`,
    certificate: `data:image/jpeg;base64,${certificate.toString("base64")}`,
    avatar: `data:image/png;base64,${avatar.toString("base64")}`,
  };
}

const fx = await fixtures();

const child = {
  childId: "c1", parentId: "p1", teacherIds: [],
  name: "Тэнгэр", birthDate: "2015-03-10", bio: "Нест Эдукэйшн IT сургууль, хөл бөмбөг · 5-р анги",
  avatarUrl: fx.avatar,
};
const achievements = [
  { id: "a1", childId: "c1", title: "Хотын аварга шалгаруулах тэмцээн — 1-р байр", date: "2026-05-14", location: "Улаанбаатар", category: "Sports", awardType: "Gold", description: "U-11 насны ангилалд баг тамирчдын хамт түрүүлж, шилдэг довтлогчоор шалгарсан.", imageURLs: [fx.landscape, fx.certificate] },
  { id: "a2", childId: "c1", title: "Математикийн олимпиад", date: "2026-03-02", location: "Сургууль", category: "Academic", awardType: "Silver", description: "Сургуулийн 5-р ангийн олимпиадад 2-р байр.", imageURLs: [fx.certificate] },
  { id: "a3", childId: "c1", title: "Зургийн уралдаан — оролцогч", date: "2026-01-20", location: "Соёлын төв", category: "Arts", awardType: "Participant", description: "Зураггүй амжилт: энгийн карт хэлбэрээр харагдана.", imageURLs: [] },
];

test("template ids: exactly 3, official is free, framed/portfolio paid", () => {
  assert.deepEqual([...PDF_TEMPLATES], ["official", "framed", "portfolio"]);
  assert.deepEqual([...PAID_PDF_TEMPLATES], ["framed", "portfolio"]);
  assert.equal(isPaidTemplate("official"), false);
  assert.equal(isPaidTemplate("framed"), true);
});

test("legacy id map: v7 ids (official/kids/gold/portfolio/framed) → v8, unknown → official", () => {
  assert.deepEqual(LEGACY_TEMPLATE_MAP, { official: "official", gold: "framed", framed: "framed", portfolio: "portfolio", kids: "portfolio" });
  assert.equal(normalizePdfTemplate("gold"), "framed");
  assert.equal(normalizePdfTemplate("kids"), "portfolio");
  assert.equal(normalizePdfTemplate("framed"), "framed");
  assert.equal(normalizePdfTemplate("nope"), "official");
  assert.equal(normalizePdfTemplate(undefined), "official");
  for (const id of PDF_TEMPLATES) assert.equal(normalizePdfTemplate(id), id);
});

test("dataUrlDims reads PNG IHDR and JPEG SOF headers", () => {
  assert.deepEqual(dataUrlDims(fx.avatar), { w: 600, h: 800 });
  assert.deepEqual(dataUrlDims(fx.landscape), { w: 1600, h: 1000 });
  assert.deepEqual(dataUrlDims(fx.certificate), { w: 1000, h: 1400 });
  assert.deepEqual(dataUrlDims("https://x/y.jpg"), { w: 0, h: 0 });
});

test("i18n: pdf keys the templates use exist in mn/en/ru and carry no emoji", async () => {
  const keys = ["pdf.official", "pdf.framed", "pdf.portfolio", "pdf.officialDesc", "pdf.framedDesc", "pdf.portfolioDesc", "pdf.lockedCaption", "pdf.portfolioLabel", "pdf.footerLine", "pdf.backLink", "pdf.appendixTitle", "pdf.subtitle", "pdf.totalEntries", "pdf.goldMedals", "pdf.birthDate", "pdf.achievementsTitle", "pdf.premiumMessage"];
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2900}-\u{297F}]/u;
  for (const lang of ["mn", "en", "ru"]) {
    const dict = (await import(`../src/i18n/locales/${lang}.json`, { with: { type: "json" } })).default;
    for (const k of keys) {
      const v = k.split(".").reduce((o, p) => o?.[p], dict);
      assert.equal(typeof v, "string", `${lang}: ${k} missing`);
      assert.ok(!emoji.test(v), `${lang}: ${k} has an emoji/arrow glyph: ${v}`);
    }
    assert.equal(dict.pdf.gold, undefined, `${lang}: pdf.gold removed`);
    assert.equal(dict.pdf.kids, undefined, `${lang}: pdf.kids removed`);
    assert.equal(dict.pdfPreview.frameStyle, undefined, `${lang}: frameStyle removed`);
  }
});

for (const template of PDF_TEMPLATES) {
  test(`render ${template}: no throw, multi-page, NotoSans embedded, written to scratch/pdf-3/${template}.pdf`, async () => {
    const buf = await exportPortfolio(child, achievements, { template, t, fonts, includeImages: true, output: "arraybuffer", now: new Date("2026-10-13T00:00:00Z") });
    assert.ok(buf instanceof ArrayBuffer && buf.byteLength > 20_000, "pdf bytes");
    const bytes = Buffer.from(buf);
    const head = bytes.subarray(0, 8).toString("latin1");
    assert.ok(head.startsWith("%PDF-"), "pdf header");
    const text = bytes.toString("latin1");
    const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    // official: 1 list page + 3 appendix; framed: 1 + 3; portfolio: cover + 1-2 + 3 appendix
    assert.ok(pages >= 4, `${template}: expected ≥4 pages, got ${pages}`);
    assert.ok(/NotoSans/.test(text), "NotoSans font embedded");
    writeFileSync(new URL(`${template}.pdf`, OUT), bytes);
  });
}

test("render without images and with an unknown legacy id falls back cleanly", async () => {
  const buf = await exportPortfolio(child, achievements, { template: "gold", t, fonts, includeImages: false, output: "arraybuffer" });
  assert.ok(buf.byteLength > 5_000);
  const pages = (Buffer.from(buf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  assert.ok(pages >= 1 && pages <= 2, `no appendix without images (got ${pages})`);
});
