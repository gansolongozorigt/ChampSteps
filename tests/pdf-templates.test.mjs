// node --import tsx --test tests/pdf-templates.test.mjs
// Renders the 3 PDF templates in Node (jsPDF node build, NotoSans from public/,
// sharp-made fixture images) and writes them to scratch/pdf-3/ for visual review.
// Also covers the legacy template-id map and the header-only image size parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  PDF_TEMPLATES, PAID_PDF_TEMPLATES, LEGACY_TEMPLATE_MAP, normalizePdfTemplate, isPaidTemplate,
  dataUrlDims, exportPortfolio, prepValue, prepNotesFor, prepEntryMeta, CARD, cardColumns, fitImage,
  initialOf, AVATAR_INITIAL,
} from "../src/lib/pdfExport.ts";
import { makeT, fonts, fixtures } from "./helpers/pdf-fixtures.mjs";

const OUT = new URL("../scratch/pdf-3/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const t = makeT("mn");
const fx = await fixtures();

const child = {
  childId: "c1", parentId: "p1", teacherIds: [],
  name: "Тэнгэр", birthDate: "2015-03-10", bio: "Нест Эдукэйшн IT сургууль, хөл бөмбөг · 5-р анги",
  avatarUrl: fx.avatar,
};
const achievements = [
  { id: "a1", childId: "c1", title: "Хотын аварга шалгаруулах тэмцээн — 1-р байр", date: "2026-05-14", location: "Улаанбаатар", category: "Sports", awardType: "Gold", description: "U-11 насны ангилалд баг тамирчдын хамт түрүүлж, шилдэг довтлогчоор шалгарсан.", imageURLs: [fx.landscape, fx.certificate] },
  { id: "a2", childId: "c1", title: "Математикийн олимпиад", date: "2026-03-02", location: "Сургууль", category: "Academic", awardType: "Silver", description: "Сургуулийн 5-р ангийн олимпиадад 2-р байр.", imageURLs: [fx.certificate] },
  { id: "a3", childId: "c1", title: "Зургийн уралдаан — оролцогч", date: "2026-01-20", location: "Соёлын төв", category: "Arts", awardType: "Participant", description: "Зураггүй амжилт: энгийн карт хэлбэрээр харагдана.", imageURLs: [], prep: { goalId: "g1", days: 43, sessions: 50, minutes: 1860, daysTotal: 61 } },
];

test("prepValue: goal preparation stats in hours, or minutes under one hour; empty without prep", () => {
  assert.equal(prepValue({ prep: { goalId: "g", days: 43, sessions: 50, minutes: 1860, daysTotal: 61 } }, t), "43 өдөр · 31 цаг");
  assert.equal(prepValue({ prep: { goalId: "g", days: 2, sessions: 2, minutes: 45, daysTotal: 7 } }, t), "2 өдөр · 45 мин");
  assert.equal(prepValue({}, t), "");
});

test("prepNotesFor: newest 3 notes of the achievement's goal, one line each; nothing without prep / logs", () => {
  const logs = [
    { id: "l1", childId: "c1", date: "2026-04-01", duration: 30, content: "Эхний  бэлтгэл\nхоёр мөр", goalId: "g1" },
    { id: "l2", childId: "c1", date: "2026-04-03", duration: 30, content: "   ", goalId: "g1" },
    { id: "l3", childId: "c1", date: "2026-04-05", duration: 30, content: "Өөр зорилго", goalId: "g2" },
    { id: "l4", childId: "c1", date: "2026-04-07", duration: 30, content: "Дөрөв", goalId: "g1" },
    { id: "l5", childId: "c1", date: "2026-04-09", duration: 30, content: "Тав", goalId: "g1" },
    { id: "l6", childId: "c1", date: "2026-04-11", duration: 30, content: "Зургаа", goalId: "g1" },
  ];
  assert.deepEqual(prepNotesFor({ prep: { goalId: "g1" } }, logs), ["Зургаа", "Тав", "Дөрөв"]);
  assert.deepEqual(prepNotesFor({ prep: { goalId: "g1" } }, logs.slice(0, 2)), ["Эхний бэлтгэл хоёр мөр"]);
  assert.deepEqual(prepNotesFor({}, logs), []);
  assert.deepEqual(prepNotesFor({ prep: { goalId: "g1" } }, []), []);
});

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

test("prepEntryMeta: MM-DD · minutes, either part optional", () => {
  assert.equal(prepEntryMeta({ date: "2026-10-16", minutes: 45 }, t), "10-16 · 45 мин");
  assert.equal(prepEntryMeta({ date: "2026-10-16", minutes: 0 }, t), "10-16");
  assert.equal(prepEntryMeta({ date: "", minutes: 30 }, t), "30 мин");
  assert.equal(prepEntryMeta({ date: "", minutes: 0 }, t), "");
});

test("i18n: pdf keys the templates use exist in mn/en/ru and carry no emoji", async () => {
  const keys = ["pdf.official", "pdf.framed", "pdf.portfolio", "pdf.officialDesc", "pdf.framedDesc", "pdf.portfolioDesc", "pdf.lockedCaption", "pdf.portfolioLabel", "pdf.footerLine", "pdf.backLink", "pdf.appendixTitle", "pdf.subtitle", "pdf.totalEntries", "pdf.goldMedals", "pdf.birthDate", "pdf.achievementsTitle", "pdf.premiumMessage",
    "pdf.labels.date", "pdf.labels.location", "pdf.labels.category", "pdf.labels.award", "pdf.labels.prep", "pdf.labels.notes", "pdf.labels.prepNotes", "pdf.labels.morePhotos", "pdf.prepValue", "pdf.prepValueMin", "pdf.prepEntryMinutes", "pdfPreview.appendix", "profile.fields.ageNow", "profile.fields.bioAgeHint", "age.years_other"];
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
    let framedPages;
    const buf = await exportPortfolio(child, achievements, { template, t, fonts, includeImages: true, includeAppendix: true, output: "arraybuffer", now: new Date("2026-10-13T00:00:00Z"), onPages: (p) => { framedPages = p; } });
    assert.ok(buf instanceof ArrayBuffer && buf.byteLength > 20_000, "pdf bytes");
    if (template === "framed") {
      // 3 cards (2 + 1 + 0 photos, ≤ 45 mm each) flow onto ≤ 2 content pages; the 3 appendix pages come on top
      assert.ok(framedPages.length <= 2, `framed: ${framedPages.length} content pages`);
      assert.deepEqual(framedPages.flat(), [0, 1, 2]);
      console.log(`framed content pages: ${JSON.stringify(framedPages)}`);
    }
    const bytes = Buffer.from(buf);
    const head = bytes.subarray(0, 8).toString("latin1");
    assert.ok(head.startsWith("%PDF-"), "pdf header");
    const text = bytes.toString("latin1");
    const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    // official: 1 list page + 3 appendix; framed: 1-2 + 3; portfolio: cover + 1-2 + 3 appendix
    assert.ok(pages >= 4, `${template}: expected ≥4 pages, got ${pages}`);
    assert.ok(/NotoSans/.test(text), "NotoSans font embedded");
    writeFileSync(new URL(`${template}.pdf`, OUT), bytes);
  });
}

// No photo → filled circle + initial. Spy on the doc: the first filled circle is the avatar
// (header), and the next text call draws the initial into it.
const PT_MM = 0.3528;
async function avatarInitial(template, name) {
  const calls = [];
  const onDoc = (doc) => {
    const circle = doc.circle.bind(doc), text = doc.text.bind(doc);
    doc.circle = (x, y, r, style) => { calls.push({ kind: "circle", x, y, r, style }); return circle(x, y, r, style); };
    doc.text = (str, x, y, o) => { calls.push({ kind: "text", str, x, y, o, size: doc.getFontSize() }); return text(str, x, y, o); };
  };
  await exportPortfolio({ ...child, name, avatarUrl: undefined }, achievements.slice(0, 1), { template, t, fonts, includeImages: false, output: "arraybuffer", onDoc });
  const i = calls.findIndex((c) => c.kind === "circle" && c.style === "F" && c.r >= 10);
  assert.ok(i >= 0, `${template}: avatar circle drawn`);
  const txt = calls.slice(i + 1).find((c) => c.kind === "text");
  return { circle: calls[i], txt };
}

test("initialOf: first letter uppercased, trimmed, '?' when empty", () => {
  assert.equal(initialOf("тэнгэр"), "Т");
  assert.equal(initialOf("  үүрцай"), "Ү");
  assert.equal(initialOf("anu"), "A");
  assert.equal(initialOf(""), "?");
  assert.equal(initialOf(undefined), "?");
});

for (const template of PDF_TEMPLATES) {
  test(`${template}: avatar initial without a photo is centred in the circle at 45% of the diameter`, async () => {
    for (const name of ["Тэнгэр", "Үүрцай", "Өлзий", "Гэрэл", "Анар", "Anu", "Temuulen", "Gerel"]) {
      const { circle, txt } = await avatarInitial(template, name);
      assert.equal(txt.str, initialOf(name), `${template} ${name}: initial`);
      assert.equal(txt.o?.align, "center", `${template} ${name}: centred horizontally`);
      const d = circle.r * 2;
      const sizeMm = txt.size * PT_MM;
      assert.ok(Math.abs(sizeMm - 0.45 * d) < 0.05, `${template} ${name}: font ${sizeMm.toFixed(2)}mm vs ${(0.45 * d).toFixed(2)}mm`);
      // glyph box: baseline y, cap top y - capHeight; its middle must sit on the circle centre ±1 mm
      const capMid = txt.y - (AVATAR_INITIAL.capHeight * sizeMm) / 2;
      assert.ok(Math.abs(txt.x - circle.x) <= 1, `${template} ${name}: x ${txt.x} vs ${circle.x}`);
      assert.ok(Math.abs(capMid - circle.y) <= 1, `${template} ${name}: cap middle ${capMid.toFixed(2)} vs ${circle.y}`);
      assert.ok(txt.y < circle.y + circle.r && txt.y - AVATAR_INITIAL.capHeight * sizeMm > circle.y - circle.r, `${template} ${name}: glyph inside the circle`);
    }
  });
}

test("render without images and with an unknown legacy id falls back cleanly", async () => {
  const buf = await exportPortfolio(child, achievements, { template: "gold", t, fonts, includeImages: false, output: "arraybuffer" });
  assert.ok(buf.byteLength > 5_000);
  const pages = (Buffer.from(buf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  assert.ok(pages >= 1 && pages <= 2, `no appendix without images (got ${pages})`);
});

test("card columns: 58/42 split with photos, full width without; photos fit the column and stay under 45 mm", () => {
  assert.deepEqual(cardColumns(166, false), { leftW: 166, rightW: 0 });
  const { leftW, rightW } = cardColumns(166, true);
  assert.equal(rightW, 70);
  assert.equal(leftW, 166 - 70 - CARD.colGap);
  assert.equal(CARD.imgMaxH, 45);
  assert.deepEqual(fitImage(1600, 1000, 70), { w: 70, h: 43.75 });              // landscape: column wide, under 45 mm
  const cert = fitImage(1000, 1400, 70);                                        // portrait: capped at 45 mm tall
  assert.equal(cert.h, 45);
  assert.ok(Math.abs(cert.w - 45 * 1000 / 1400) < 1e-9);
  const sq = fitImage(1000, 1000, 70);                                          // square: height cap wins
  assert.deepEqual(sq, { w: 45, h: 45 });
  assert.deepEqual(fitImage(0, 0, 70), { w: 60, h: 45 });                       // unknown size: 4:3, capped
});

test("framed pagination: 10 achievements → every full content page carries ≥ 2, order kept, appendix = image count", async () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    id: `m${i}`, childId: "c1",
    title: `Амжилт ${i + 1}`, date: `2026-0${(i % 9) + 1}-10`, location: "Улаанбаатар",
    category: ["Sports", "Academic", "Arts"][i % 3], awardType: ["Gold", "Silver", "Bronze", "Participant"][i % 4],
    description: i % 2 ? "Хоёр мөрт тайлбар: " + "сургуулийн тэмцээнд амжилттай оролцож, багийн хамт шилдэг үзүүлэлт үзүүлсэн. ".repeat(2) : "Нэг мөрт тайлбар.",
    imageURLs: [[], [fx.landscape], [fx.landscape, fx.certificate]][i % 3],
  }));
  let pages;
  const buf = await exportPortfolio(child, many, { template: "framed", t, fonts, includeImages: true, includeAppendix: true, output: "arraybuffer", onPages: (p) => { pages = p; } });
  assert.ok(Array.isArray(pages) && pages.length >= 2, "flowed over several pages");
  assert.deepEqual(pages.flat(), many.map((_, i) => i), "every achievement once, in order");
  // every page but the last carries ≥ 2 cards (the last one takes whatever is left over)
  for (const [n, p] of pages.slice(0, -1).entries()) assert.ok(p.length >= 2, `page ${n + 1} has ${p.length} achievement(s): ${JSON.stringify(pages)}`);
  const images = many.reduce((s, a) => s + a.imageURLs.length, 0);
  const total = (Buffer.from(buf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  assert.equal(total, pages.length + images, `content ${pages.length} + appendix ${images} pages`);
  writeFileSync(new URL("framed-10.pdf", OUT), Buffer.from(buf)); // visual check of continuation pages
  console.log(`framed 10 achievements: content pages ${JSON.stringify(pages)}, total ${total}`);
});
