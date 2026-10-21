// node --import tsx --test tests/pdf-layout.test.mjs
// Text-overflow guard for the 3 PDF templates: every doc.text call is spied on and
// its measured width (doc.getTextWidth with the font it is drawn in) must stay
// inside the page's content box; user text (notes, practice notes, locations)
// must stay inside its card column. Also: notes are never truncated, long titles
// are cut to 2 lines with "…", 12 achievements flow over several pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { exportPortfolio, PDF_TEMPLATES, CARD, cardColumns } from "../src/lib/pdfExport.ts";
import { makeT, fonts, fixtures } from "./helpers/pdf-fixtures.mjs";

const OUT = new URL("../scratch/pdf-layout/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const fx = await fixtures();
const A4 = { w: 210, h: 297 };
/** Horizontal content box per template (mm): official/portfolio page margin 18, framed content inset 22.5. */
const BOX = {
  official: { left: 18, right: A4.w - 18 },
  framed: { left: 22.5, right: A4.w - 22.5 },
  portfolio: { left: 18, right: A4.w - 18 },
};
const EPS = 0.05;

const child = { childId: "c1", parentId: "p1", teacherIds: [], name: "Тэнгэр", birthDate: "2015-03-10", bio: "Нест Эдукэйшн IT сургууль, хөл бөмбөг · 5-р анги", avatarUrl: fx.avatar };

// 700 characters of Mongolian, no newlines, long words included
const SENTENCE = "Улсын аварга шалгаруулах тэмцээнд хоёр сарын турш тууштай бэлтгэл хийж, хагас шигшээд өрсөлдөгчөө давж, шигшээ тоглолтод сүүлийн минутад амжилттай довтолгоо хийж баг тамирчдынхаа хамт түрүүлсэн. ";
const LONG_NOTE = SENTENCE.repeat(Math.ceil(700 / SENTENCE.length)).slice(0, 700).trim();
const LONG_TITLE = "Олон улсын хүүхдийн урлагийн наадам — хөгжмийн төрөл, ганцаарчилсан тоглолт, ахлах анги"; // > 60 chars

const PREP_LOGS = [
  { id: "l1", childId: "c1", date: "2026-04-01", duration: 45, content: "Зураг зурах дасгал — гэрэл сүүдэр, 45 минут, маш сайн төвлөрсөн өдөр байлаа, багш магтсан", goalId: "g1" },
  { id: "l2", childId: "c1", date: "2026-04-05", duration: 60, content: "Өнгөний хольц, акварель", goalId: "g1" },
  { id: "l3", childId: "c1", date: "2026-04-09", duration: 30, content: "Эцсийн бүтээлээ дуусгав", goalId: "g1" },
  { id: "l4", childId: "c1", date: "2026-04-10", duration: 30, content: "Өөр зорилгын бичлэг — картанд орохгүй", goalId: "g2" },
];

const CASES = {
  a: { id: "a", childId: "c1", title: "Хотын аварга — урт тэмдэглэлтэй, зураггүй", date: "2026-05-05", location: "Ústí nad Orlicí", category: "Arts", awardType: "Participant", description: LONG_NOTE, imageURLs: [] },
  b: { id: "b", childId: "c1", title: "Гурван зурагтай амжилт", date: "2026-03-02", location: "Улаанбаатар", category: "Sports", awardType: "Gold", description: "Богино тэмдэглэл.", imageURLs: [fx.landscape, fx.certificate, fx.panorama] },
  c: { id: "c", childId: "c1", title: "Зургийн уралдаан — бэлтгэлтэй", date: "2026-04-12", location: "Соёлын төв", category: "Arts", awardType: "Silver", description: "Зорилгоос гарсан амжилт: бэлтгэлийн мөр, сүүлийн 3 тэмдэглэл.", imageURLs: [fx.certificate], prep: { goalId: "g1", days: 43, sessions: 50, minutes: 1860, daysTotal: 61 } },
  d: { id: "d", childId: "c1", title: LONG_TITLE, date: "2026-02-20", location: "Их театр", category: "Arts", awardType: "Bronze", description: "60+ тэмдэгтийн гарчиг: 2 мөр хүртэл, цаашид тасална.", imageURLs: [fx.landscape] },
};
const MANY = Array.from({ length: 12 }, (_, i) => ({
  id: `m${i}`, childId: "c1", title: `Амжилт ${i + 1}`, date: `2026-${String((i % 12) + 1).padStart(2, "0")}-10`, location: i % 2 ? "Улаанбаатар" : "Дархан",
  category: ["Sports", "Academic", "Arts"][i % 3], awardType: ["Gold", "Silver", "Bronze", "Participant"][i % 4],
  description: i % 3 === 0 ? LONG_NOTE.slice(0, 300) : "Нэг мөрт тайлбар.",
  imageURLs: [[], [fx.landscape], [fx.landscape, fx.certificate]][i % 3],
}));

/** Renders with a doc.text spy; returns the calls (one per drawn line) and the pdf bytes. */
async function render(template, achievements, extra = {}) {
  const calls = [];
  let pages;
  const buf = await exportPortfolio(extra.child ?? child, achievements, {
    template, t: makeT(extra.lang ?? "mn"), fonts, includeImages: true, output: "arraybuffer", now: new Date("2026-10-17T00:00:00Z"),
    practiceLogs: PREP_LOGS, onPages: (p) => { pages = p; },
    onDoc: (doc) => {
      const orig = doc.text.bind(doc);
      doc.text = (txt, x, y, opts) => {
        for (const line of Array.isArray(txt) ? txt : [txt]) {
          calls.push({ text: String(line), x, y, align: opts?.align ?? "left", w: doc.getTextWidth(String(line)), size: doc.getFontSize(), page: doc.internal.getCurrentPageInfo().pageNumber });
        }
        return orig(txt, x, y, opts);
      };
    },
    ...extra.opts,
  });
  return { calls, buf, pages, pageCount: (Buffer.from(buf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length };
}

function assertInsideBox(template, calls) {
  const box = BOX[template];
  for (const c of calls) {
    const [l, r] = c.align === "center" ? [c.x - c.w / 2, c.x + c.w / 2] : c.align === "right" ? [c.x - c.w, c.x] : [c.x, c.x + c.w];
    assert.ok(l >= box.left - EPS && r <= box.right + EPS, `${template} p${c.page}: "${c.text.slice(0, 40)}" spans ${l.toFixed(1)}–${r.toFixed(1)} mm, box ${box.left}–${box.right} (${c.size} pt)`);
  }
}

/** Lines that are (part of) a user-entered text: wrapped pieces of `source`. */
const linesOf = (calls, source) => calls.filter((c) => c.text.length >= 4 && source.includes(c.text.replace(/…$/, "").replace(/^·\s+/, "")));

/** Inner width of a card on this template (card width minus padding). */
const innerW = (template) => (template === "framed" ? A4.w - 2 * 22.5 : A4.w - 2 * 18) - 2 * CARD.pad;

for (const template of PDF_TEMPLATES) {
  test(`${template}: (a) 700-char note without photos wraps to the full card width and is never cut`, async () => {
    const { calls } = await render(template, [CASES.a]);
    assertInsideBox(template, calls);
    const note = linesOf(calls, LONG_NOTE);
    assert.ok(note.length >= 6, `expected many wrapped note lines, got ${note.length}`);
    const { leftW } = cardColumns(innerW(template), false);
    for (const c of note) assert.ok(c.w <= leftW + EPS, `${template}: note line ${c.w.toFixed(1)} mm > column ${leftW} mm`);
    assert.equal(note.map((c) => c.text).join(" ").replace(/\s+/g, " "), LONG_NOTE.replace(/\s+/g, " "), "note text complete and in order");
    assert.ok(calls.some((c) => c.text === CASES.a.location), "location in its label row");
    assert.ok(!calls.some((c) => c.text !== CASES.a.location && c.text.includes(CASES.a.location)), "no meta line under the title (the rows carry date/location/category/award)");
  });

  test(`${template}: (b) 3 photos keep their aspect inside the right column, text stays in the left column`, async () => {
    const { calls, pageCount } = await render(template, [CASES.b]);
    assertInsideBox(template, calls);
    const { leftW } = cardColumns(innerW(template), true);
    for (const c of linesOf(calls, CASES.b.description)) assert.ok(c.w <= leftW + EPS, `note wider than the left column`);
    const base = template === "portfolio" ? 2 : 1;
    assert.equal(pageCount - 3, base, "one content page + 3 appendix pages (one per photo); 3 stacked photos ≤ 45 mm fit under every cover"); 
  });

  test(`${template}: (c) goal-linked achievement shows the preparation row and the last 3 practice notes, one line each`, async () => {
    const { calls } = await render(template, [CASES.c]);
    assertInsideBox(template, calls);
    const t = makeT("mn");
    assert.ok(calls.some((c) => c.text === t("pdf.labels.prep")), "prep label");
    assert.ok(calls.some((c) => c.text === "43 өдөр · 31 цаг"), "prep value");
    assert.ok(calls.some((c) => c.text === t("pdf.labels.prepNotes").toUpperCase()), "practice notes heading");
    const notes = calls.filter((c) => c.text.startsWith("·"));
    assert.equal(notes.length, 3, `3 practice notes, got ${notes.map((n) => n.text)}`);
    assert.ok(notes.some((c) => c.text.endsWith("…")), "the long note is cut to one line with …");
    assert.ok(!calls.some((c) => c.text.includes("Өөр зорилгын")), "other goal's note not shown");
    const { leftW } = cardColumns(innerW(template), true);
    for (const c of notes) assert.ok(c.w <= leftW + EPS, "practice note inside the left column");
  });

  test(`${template}: (d) a 60+ char title is cut to 2 lines ending in … and stays inside the card`, async () => {
    const { calls } = await render(template, [CASES.d]);
    assertInsideBox(template, calls);
    const title = linesOf(calls, LONG_TITLE).filter((c) => c.size >= 11 && c.size <= 12); // card title; the appendix repeats it at 13 pt
    assert.ok(title.length >= 1 && title.length <= 2, `title lines: ${title.length}`);
    assert.ok(title[title.length - 1].text.endsWith("…") || title.map((c) => c.text).join(" ") === LONG_TITLE, "either complete or ended with …");
  });

  test(`${template}: (e) 12 achievements flow over several pages, in order, nothing outside the box`, async () => {
    const { calls, pages, pageCount } = await render(template, MANY);
    assertInsideBox(template, calls);
    const photos = MANY.reduce((s, a) => s + a.imageURLs.length, 0);
    const content = pageCount - photos;
    assert.ok(content >= 3, `${template}: ${content} content pages for 12 cards`);
    if (template === "framed") {
      assert.deepEqual(pages.flat(), MANY.map((_, i) => i), "every achievement once, in order");
      assert.equal(pages.length, content);
    }
    // titles appear in order across pages
    const titles = calls.filter((c) => /^Амжилт \d+$/.test(c.text) && c.size <= 12); // card titles (appendix repeats them at 13 pt)
    assert.deepEqual(titles.map((c) => c.text), MANY.map((a) => a.title));
    for (let i = 1; i < titles.length; i++) assert.ok(titles[i].page >= titles[i - 1].page, "pages ascend");
  });

  test(`${template}: (f) a card taller than a page continues its text on the next page (photos stay on the first)`, async () => {
    const huge = { ...CASES.c, id: "huge", description: LONG_NOTE.repeat(4) };
    const { calls, pageCount } = await render(template, [huge, CASES.b]);
    assertInsideBox(template, calls);
    const note = linesOf(calls, huge.description);
    const notePages = new Set(note.map((c) => c.page));
    assert.ok(notePages.size >= 2, `note spread over ${notePages.size} page(s)`);
    assert.equal(note.map((c) => c.text).join(" ").replace(/\s+/g, " "), huge.description.replace(/\s+/g, " "), "nothing lost in the split");
    assert.ok(pageCount >= 3 + 4, "content pages + 4 appendix pages");
  });

  test(`${template}: en labels render and stay inside the box`, async () => {
    const { calls } = await render(template, [CASES.c, CASES.a], { lang: "en" });
    assertInsideBox(template, calls);
    assert.ok(calls.some((c) => c.text === "Preparation"), "en prep label");
    assert.ok(calls.some((c) => c.text === "43 days · 31 h"), "en prep value");
  });
}

// ---------------------------------------------------------------------------
// Header: age from the birth date on the PDF's date, bio without a typed-in age
// ---------------------------------------------------------------------------

const UULEN = { ...child, name: "Үүлэн", birthDate: "2014-07-20", bio: "11 настай · Бүжгийн спорт, Хийл хөгжим" };

for (const template of PDF_TEMPLATES) {
  test(`${template}: header shows the computed age · bio without the stale "11 настай", birth date row kept`, async () => {
    const { calls } = await render(template, [CASES.b], { child: UULEN, opts: { now: new Date("2026-10-21T00:00:00Z") } });
    assertInsideBox(template, calls);
    const header = calls.filter((c) => c.page === 1).map((c) => c.text).join("\n");
    assert.ok(header.includes("12 настай · Бүжгийн спорт"), `header: ${header.slice(0, 300)}`);
    assert.ok(!header.includes("11 настай"), "stale age from the bio is not shown");
    assert.ok(header.includes("2014-07-20"), "birth date still shown");
  });
}

test("header age follows the PDF date: the day before the birthday (UB) is still 11", async () => {
  const { calls } = await render("framed", [CASES.b], { child: UULEN, opts: { now: new Date("2026-07-19T15:59:00Z") } }); // UB 07-19 23:59
  const header = calls.filter((c) => c.page === 1).map((c) => c.text).join("\n");
  assert.ok(header.includes("11 настай · Бүжгийн спорт") && !header.includes("12 настай"), header.slice(0, 200));
});

test("header without a birth date keeps the bio as typed; en/ru age wording", async () => {
  const noDate = await render("portfolio", [CASES.b], { child: { ...UULEN, birthDate: "" } });
  assert.ok(noDate.calls.some((c) => c.text.includes("11 настай · Бүжгийн спорт")), "bio unchanged when the age is unknown");
  const en = await render("official", [CASES.b], { lang: "en", child: { ...UULEN, bio: "" }, opts: { now: new Date("2026-10-21T00:00:00Z") } });
  assert.ok(en.calls.some((c) => c.text === "12 years old"), "en age only (empty bio)");
  const ru = await render("official", [CASES.b], { lang: "ru", child: UULEN, opts: { now: new Date("2026-10-21T00:00:00Z") } });
  assert.ok(ru.calls.some((c) => c.text.startsWith("12 лет · Бүжгийн спорт")), "ru plural");
});

test("all cases, 3 templates → scratch/pdf-layout/<template>.pdf for a visual check", async () => {
  for (const template of PDF_TEMPLATES) {
    const { buf } = await render(template, [CASES.a, CASES.b, CASES.c, CASES.d, ...MANY]);
    writeFileSync(new URL(`${template}.pdf`, OUT), Buffer.from(buf));
  }
});
