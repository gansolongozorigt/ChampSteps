// =============================================================================
// pdfExport v9 — 3 template: official, framed, portfolio
//   official  — албан хэлбэр (сургууль, тэтгэлэг); үнэгүй багцад ч ажиллана
//   framed    — гэрчилгээний хэв маяг, хуудас бүр давхар хүрээтэй
//   portfolio — зургийн загвар: дугуй хүрээтэй карт, гэрчилгээ бүтэн хуудсаар хавсралтад
// Амжилт бүр 2 баганат карт (drawCard): зүүн талд label/value мөрүүд + тэмдэглэл
// (бүтнээрээ, эвхэгдсэн), баруун талд зургууд (харьцаа хадгална, max 60mm).
// Хэрэглэгчийн текст бүр wrapLines/drawWrapped-оор баганын өргөнд эвхэгдэнэ —
// хэмжих, зурах хоёр ижил фонтоор (өмнөх алдаа: 8pt-ээр хэмжээд 9.5pt-ээр зурдаг байсан).
// Монгол+Англи+Орос хэл, NotoSans фонт (emoji байхгүй — NotoSans зурдаггүй),
// хавсралт хуудас (бүтэн хэмжээний зураг) + thumbnail-аас үсрэх холбоос.
// Браузер болон Node (tests/pdf-templates.test.mjs) хоёуланд ажиллана:
// fonts-ийг opts.fonts-оор өгч болно, зураг data: URL бол canvas хэрэггүй.
// =============================================================================

import { jsPDF } from "jspdf";
import type { Achievement, Child, PracticeLog } from "../types";
import type { AppLang } from "../i18n";
import { LOGO_BARS } from "../components/Logo";

// -----------------------------------------------------------------------------
// Brand palette (docs/BRAND.md) as RGB for jsPDF.
// -----------------------------------------------------------------------------
type RGB = [number, number, number];
const INK: RGB = [24, 37, 29];            // #18251D graphite
const INK2: RGB = [62, 79, 70];           // #3E4F46
const INK3: RGB = [110, 125, 116];        // #6E7D74

const LINE: RGB = [220, 229, 221];        // #DCE5DD
const PRIMARY: RGB = [47, 125, 91];       // #2F7D5B forest green
const PRIMARY_SOFT: RGB = [221, 243, 230]; // #DDF3E6
const PRIMARY_SOFT_INK: RGB = [31, 90, 66]; // #1F5A42
const SURFACE_MUTED: RGB = [238, 242, 236]; // #EEF2EC
const STAGE_MUTED: RGB = [201, 214, 206]; // #C9D6CE
const WHITE: RGB = [255, 255, 255];
const GOLD: RGB = [212, 162, 76];         // #D4A24C
const SILVER: RGB = [156, 163, 175];      // #9CA3AF
const BRONZE: RGB = [180, 83, 9];         // #B45309

const AWARD_COLOR: Record<string, RGB> = { Gold: GOLD, Silver: SILVER, Bronze: BRONZE, Participant: INK3 };

// -----------------------------------------------------------------------------
// Templates + legacy id map live in ./pdfTemplates (no jsPDF there); re-exported for callers/tests.
// -----------------------------------------------------------------------------

import {
  PDF_TEMPLATES, PAID_PDF_TEMPLATES, LEGACY_TEMPLATE_MAP, normalizePdfTemplate, isPaidTemplate, type PdfTemplate,
  CARD, cardColumns, fitImage,
} from "./pdfTemplates";
export { PDF_TEMPLATES, PAID_PDF_TEMPLATES, LEGACY_TEMPLATE_MAP, normalizePdfTemplate, isPaidTemplate, CARD, cardColumns, fitImage };
export type { PdfTemplate };

type T = (key: string, opts?: Record<string, unknown>) => string;

export interface PdfFonts {
  /** base64 TTF */
  regular: string;
  bold: string;
}

interface ExportOpts {
  template?: PdfTemplate;
  filename?: string;
  language?: AppLang;
  includeImages?: boolean;
  t?: T;
  // "save" (default) -> файл татна; "bloburl" -> preview-д object URL; "arraybuffer" -> Node тест.
  output?: "save" | "bloburl" | "arraybuffer";
  /** Fonts as base64 (Node / tests). In the browser they are fetched from /NotoSans-*.ttf. */
  fonts?: PdfFonts;
  /** Footer date (defaults to today). */
  now?: Date;
  /** Framed template: index of the content page each achievement card starts on (tests / debugging). */
  onPages?: (pages: number[][]) => void;
  /** Practice logs of the child: the last notes of the goal an achievement came out of go on its card. */
  practiceLogs?: PracticeLog[];
  /** Called with the jsPDF instance right after the fonts are loaded (tests spy on doc.text). */
  onDoc?: (doc: jsPDF) => void;
}

const A4 = { w: 210, h: 297 };
const M = 18;
const CW = A4.w - M * 2;

// -----------------------------------------------------------------------------
// Logo
// -----------------------------------------------------------------------------

/** Logo mark: three ascending rounded bars (LOGO_BARS, 32-unit box) scaled to `size` mm. */
function drawLogoMark(doc: jsPDF, x: number, y: number, size: number, tone: "color" | "light" = "color") {
  const k = size / 32;
  const colors: RGB[] = tone === "light" ? [WHITE, WHITE, STAGE_MUTED] : [PRIMARY, PRIMARY, INK];
  LOGO_BARS.forEach((b, i) => {
    doc.setFillColor(...colors[i]);
    doc.roundedRect(x + b.x * k, y + b.y * k, b.w * k, b.h * k, 2.5 * k, 2.5 * k, "F");
  });
}

/** Mark + wordmark ("Champ" ink/white, "Step" green/soft green) on one baseline. */
function drawLogo(
  doc: jsPDF,
  x: number,
  baseline: number,
  fontSize: number,
  tone: "color" | "light" = "color",
  align: "left" | "center" = "left",
) {
  setFont(doc, "bold");
  doc.setFontSize(fontSize);
  const mark = fontSize * 0.36 * 2; // mark height ~ 2× cap height
  const gap = mark * 0.3;
  const wChamp = doc.getTextWidth("Champ");
  const wStep = doc.getTextWidth("Step");
  const total = mark + gap + wChamp + wStep;
  const x0 = align === "center" ? x - total / 2 : x;
  drawLogoMark(doc, x0, baseline - mark * 0.92, mark, tone);
  const [champ, step]: [RGB, RGB] = tone === "light" ? [WHITE, PRIMARY_SOFT] : [INK, PRIMARY];
  doc.setTextColor(...champ);
  doc.text("Champ", x0 + mark + gap, baseline);
  doc.setTextColor(...step);
  doc.text("Step", x0 + mark + gap + wChamp, baseline);
}

// -----------------------------------------------------------------------------
// ImgRef — thumbnail бүрийн байрлал + хавсралт холбоос
// -----------------------------------------------------------------------------

interface ImgRef {
  dataUrl: string;
  naturalW: number;
  naturalH: number;
  achievementTitle: string;
  achievementDate: string;
  page: number;
  x: number; y: number; w: number; h: number;
  appendixPage?: number;
}

// -----------------------------------------------------------------------------
// Font cache
// -----------------------------------------------------------------------------

const fontCache: { regular: string | null; bold: string | null } = { regular: null, bold: null };

async function loadFont(doc: jsPDF, fonts?: PdfFonts) {
  if (fonts) {
    fontCache.regular = fonts.regular;
    fontCache.bold = fonts.bold;
  }
  if (!fontCache.regular || !fontCache.bold) {
    try {
      const [regRes, boldRes] = await Promise.all([fetch("/NotoSans-Regular.ttf"), fetch("/NotoSans-Bold.ttf")]);
      if (!regRes.ok || !boldRes.ok) throw new Error("Font fetch failed");
      const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
      const toBase64 = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        const CHUNK = 8192;
        for (let i = 0; i < bytes.byteLength; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        return btoa(binary);
      };
      fontCache.regular = toBase64(regBuf);
      fontCache.bold = toBase64(boldBuf);
    } catch (e) {
      console.warn("[champstep] NotoSans font load error:", e);
      return;
    }
  }
  try {
    doc.addFileToVFS("NotoSans-Regular.ttf", fontCache.regular!);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFileToVFS("NotoSans-Bold.ttf", fontCache.bold!);
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  } catch (e) {
    console.warn("[champstep] Font add error:", e);
  }
}

function setFont(doc: jsPDF, weight: "normal" | "bold" = "normal") {
  const fontList = doc.getFontList();
  doc.setFont(fontList["NotoSans"] ? "NotoSans" : "helvetica", weight);
}

// -----------------------------------------------------------------------------
// Image helpers
// -----------------------------------------------------------------------------

const MAX_IMG_PX = 1600;
const IMG_QUALITY = 0.85;

function drawImagePlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...SURFACE_MUTED);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...INK3);
  doc.text("[ image ]", x + w / 2, y + h / 2 + 2, { align: "center" });
}

function compressImgElement(img: HTMLImageElement): string {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > MAX_IMG_PX) { h = Math.round((h * MAX_IMG_PX) / w); w = MAX_IMG_PX; }
  if (h > MAX_IMG_PX) { w = Math.round((w * MAX_IMG_PX) / h); h = MAX_IMG_PX; }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas error");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", IMG_QUALITY);
}

function base64Bytes(b64: string, maxBytes = Infinity): Uint8Array {
  const clean = b64.replace(/\s/g, "");
  const bin = typeof atob === "function" ? atob(clean) : "";
  const n = Math.min(bin.length, maxBytes);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Image format jsPDF should use for a data URL. */
function dataUrlFormat(dataUrl: string): "PNG" | "JPEG" {
  return /^data:image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
}

/**
 * Natural pixel size parsed from the PNG IHDR / JPEG SOF header — pure, sync,
 * works in Node. Returns 0×0 when unknown (callers fall back to a 4:3 box).
 */
export function dataUrlDims(dataUrl: string): { w: number; h: number } {
  const m = /^data:image\/(png|jpe?g);base64,(.*)$/is.exec(dataUrl);
  if (!m) return { w: 0, h: 0 };
  try {
    const b = base64Bytes(m[2]);
    if (m[1].toLowerCase() === "png") {
      if (b.length < 24) return { w: 0, h: 0 };
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      return { w: dv.getUint32(16), h: dv.getUint32(20) };
    }
    // JPEG: walk the markers until a SOFn (C0–CF except C4, C8, CC)
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
  } catch { /* fall through */ }
  return { w: 0, h: 0 };
}

// jsPDF-ийн одоогийн хуудасны дугаарыг авна (1-indexed)
function currentPageNum(doc: jsPDF): number {
  try {
    return (doc as unknown as { internal: { getCurrentPageInfo(): { pageNumber: number } } })
      .internal.getCurrentPageInfo().pageNumber;
  } catch {
    return (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1;
  }
}

function totalPages(doc: jsPDF): number {
  return (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1;
}

export async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  if (typeof Image === "undefined") return ""; // Node: only data URLs are supported

  // Blob URLs are same-origin — load directly, no crossOrigin needed
  if (url.startsWith("blob:")) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try { resolve(compressImgElement(img)); }
        catch { console.warn("[champstep] blob compress failed:", url); resolve(""); }
      };
      img.onerror = () => { console.warn("[champstep] blob load failed:", url); resolve(""); };
      img.src = url;
    });
  }

  // HTTP/HTTPS — try fetch+blob first to sidestep CORS canvas taint
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try { resolve(compressImgElement(img)); }
        catch { resolve(""); }
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(""); };
      img.src = objectUrl;
    });
  } catch {
    // Fallback: direct load with crossOrigin="anonymous"
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try { resolve(compressImgElement(img)); }
        catch { console.warn("[champstep] crossOrigin compress failed:", url); resolve(""); }
      };
      img.onerror = () => { console.warn("[champstep] image load failed (CORS?):", url); resolve(""); };
      img.src = url;
    });
  }
}

/** Draw a data URL cover-fitted into a box and clipped to a circle (no canvas needed). */
function drawCircleImage(doc: jsPDF, dataUrl: string, cx: number, cy: number, r: number) {
  const { w, h } = dataUrlDims(dataUrl);
  const d = r * 2;
  let iw = d, ih = d;
  if (w > 0 && h > 0) {
    const aspect = w / h;
    if (aspect > 1) iw = d * aspect; else ih = d / aspect;
  }
  doc.saveGraphicsState();
  doc.circle(cx, cy, r, null as unknown as string);
  doc.clip();
  doc.discardPath();
  doc.addImage(dataUrl, dataUrlFormat(dataUrl), cx - iw / 2, cy - ih / 2, iw, ih);
  doc.restoreGraphicsState();
}

// Circular avatar: photo if available, green initial circle otherwise. cx/cy = center mm, r = radius mm.
async function drawAvatar(doc: jsPDF, child: Child, cx: number, cy: number, r: number, bg: RGB = PRIMARY, fg: RGB = WHITE) {
  if (child.avatarUrl) {
    const dataUrl = await urlToDataUrl(child.avatarUrl);
    if (dataUrl) {
      try {
        drawCircleImage(doc, dataUrl, cx, cy, r);
        return;
      } catch { /* fall through to initial */ }
    }
  }
  doc.setFillColor(...bg);
  doc.circle(cx, cy, r, "F");
  const initial = (child.name || "?")[0].toUpperCase();
  setFont(doc, "bold");
  doc.setFontSize(r * 4);
  doc.setTextColor(...fg);
  doc.text(initial, cx, cy + r * 1.3, { align: "center" });
}

/** Label-style text (BRAND.md .t-label): uppercase, letter-spaced. */
function drawLabel(doc: jsPDF, text: string, x: number, y: number, size: number, color: RGB, align: "left" | "center" = "left") {
  setFont(doc, "bold");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text.toUpperCase(), x, y, { align, charSpace: size * 0.09 });
}

/** Medal / category chip (pill) with text; returns its width. */
function drawChip(doc: jsPDF, text: string, x: number, y: number, bg: RGB, fg: RGB, size = 7.5): number {
  setFont(doc, "bold");
  doc.setFontSize(size);
  const w = doc.getTextWidth(text) + 6;
  const h = size * 0.7;
  doc.setFillColor(...bg);
  doc.roundedRect(x, y - h * 0.72, w, h, h / 2, h / 2, "F");
  doc.setTextColor(...fg);
  doc.text(text, x + 3, y);
  return w;
}

// -----------------------------------------------------------------------------
// Text wrapping — measure and draw with the SAME font (size + weight), always.
// -----------------------------------------------------------------------------

export interface FontSpec { size: number; weight?: "normal" | "bold"; color?: RGB }

function applyFont(doc: jsPDF, f: FontSpec) {
  setFont(doc, f.weight ?? "normal");
  doc.setFontSize(f.size);
  if (f.color) doc.setTextColor(...f.color);
}

/** Line advance (mm) for a font size in pt: 9.5 pt -> 4.6 mm, 12 pt -> 5.8 mm. */
export function lineHeightFor(size: number): number {
  return Math.round(size * 0.48 * 10) / 10;
}

/**
 * `text` wrapped to `width` mm with `font` applied first, so the lines are measured
 * with the font they are drawn in. With `maxLines` the last kept line ends in "…".
 */
export function wrapLines(doc: jsPDF, text: string, width: number, font?: FontSpec, maxLines = Infinity): string[] {
  if (font) applyFont(doc, font);
  const clean = String(text ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const lines = doc.splitTextToSize(clean, width) as string[];
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, Math.max(1, maxLines));
  let last = kept[kept.length - 1];
  while (last.length > 1 && doc.getTextWidth(last + "…") > width) last = last.slice(0, -1).trimEnd();
  kept[kept.length - 1] = last + "…";
  return kept;
}

/** Height (mm) `text` takes once wrapped — known before anything is drawn. */
export function measureWrapped(doc: jsPDF, text: string, width: number, lineHeight: number, font?: FontSpec, maxLines?: number): number {
  return wrapLines(doc, text, width, font, maxLines).length * lineHeight;
}

/** Draws `text` wrapped to `width` from baseline `y`; returns the baseline of the line after the block. */
export function drawWrapped(
  doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number,
  opts: { font?: FontSpec; maxLines?: number; align?: "left" | "center" } = {},
): number {
  const lines = wrapLines(doc, text, width, opts.font, opts.maxLines);
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight, opts.align ? { align: opts.align } : undefined));
  return y + lines.length * lineHeight;
}

// -----------------------------------------------------------------------------
// Achievement card data
// -----------------------------------------------------------------------------

/** "43 өдөр · 31 цаг" (pdf.prepValue) for achievements that came out of a goal; "" otherwise. */
export function prepValue(a: { prep?: { days: number; minutes: number } }, t: T): string {
  if (!a.prep) return "";
  const hours = Math.floor(a.prep.minutes / 60);
  return hours > 0 ? t("pdf.prepValue", { days: a.prep.days, hours }) : t("pdf.prepValueMin", { days: a.prep.days, minutes: a.prep.minutes });
}

/** The newest practice-log notes (max 3) written for the goal the achievement came out of, one line each. */
export function prepNotesFor(a: { prep?: { goalId: string } }, logs: readonly PracticeLog[] | undefined, max = 3): string[] {
  const goalId = a.prep?.goalId;
  if (!goalId || !logs?.length) return [];
  return logs
    .filter((l) => l.goalId === goalId && typeof l.content === "string" && l.content.trim().length > 0)
    .sort((p, q) => (p.date < q.date ? 1 : p.date > q.date ? -1 : 0))
    .slice(0, max)
    .map((l) => l.content.replace(/\s+/g, " ").trim());
}

interface CardImage { dataUrl: string; naturalW: number; naturalH: number }

/**
 * Loads up to CARD.maxImages photos. A photo that fails to load (CORS, bad data) is
 * skipped — no grey placeholder. `more` = photos left over for the "+N" note.
 */
async function loadCardImages(doc: jsPDF, urls: readonly string[]): Promise<{ images: CardImage[]; more: number }> {
  const images: CardImage[] = [];
  let i = 0;
  for (; i < urls.length && images.length < CARD.maxImages; i++) {
    try {
      const dataUrl = await urlToDataUrl(String(urls[i]));
      if (!dataUrl) continue;
      let { w, h } = dataUrlDims(dataUrl);
      if (!(w > 0 && h > 0)) {
        const props = doc.getImageProperties(dataUrl); // throws on data jsPDF cannot draw
        w = props.width; h = props.height;
      }
      images.push({ dataUrl, naturalW: w, naturalH: h });
    } catch (e) {
      console.warn("[champstep] pdf: photo skipped:", e);
    }
  }
  return { images, more: Math.max(0, urls.length - i) };
}

// -----------------------------------------------------------------------------
// Page flow + the 2-column card (shared by the 3 templates)
// -----------------------------------------------------------------------------

/** Vertical cursor over content pages. `newPage` adds a page, draws the template chrome and returns the content top. */
interface Flow {
  y: number;
  /** content must stay above this */
  bottom: number;
  /** content top on a continuation page */
  pageTop: number;
  /** 0-based index of the current content page */
  pageIdx: number;
  newPage: () => number;
}

function makeFlow(doc: jsPDF, y: number, bottom: number, pageTop: number, decorate: () => void): Flow {
  const flow: Flow = {
    y, bottom, pageTop, pageIdx: 0,
    newPage: () => {
      doc.addPage();
      decorate();
      flow.pageIdx++;
      flow.y = pageTop;
      return pageTop;
    },
  };
  return flow;
}

interface CardCtx {
  doc: jsPDF;
  t: T;
  style: PdfTemplate;
  /** card left edge + width (mm) */
  x: number;
  w: number;
  includeImages: boolean;
  imgRefs: ImgRef[];
  practiceLogs?: PracticeLog[];
}

/** One line of the card's left column; `draw` gets the column's x and the line's top y. */
interface Line { h: number; draw: (x: number, yTop: number) => void }

/**
 * Draws one achievement as a 2-column card at flow.y and advances the flow.
 *
 *   TITLE (≤ 2 lines, "…")                      full width
 *   date · location · category · award           meta line
 *   label  value rows | photos (aspect kept,     left ≈ 58 %, right ≈ 42 %
 *   notes (all lines) | max 60 mm each, ≤ 3,
 *   practice notes    | "+N" for the rest)
 *
 * Measured first: a card that does not fit goes on the next page; a card taller
 * than a page keeps its header + photos on the first page and continues the
 * left-column text on the next page(s). Returns the content-page index the card starts on.
 */
async function drawCard(ctx: CardCtx, flow: Flow, a: Achievement): Promise<number> {
  const { doc, t, x, w } = ctx;
  const pad = CARD.pad;
  const x0 = x + pad;
  const innerW = w - pad * 2;
  const award = AWARD_COLOR[a.awardType] ?? INK3;
  const indent = ctx.style === "portfolio" ? 8 : ctx.style === "framed" ? 4 : 0; // room for the award marker beside the title

  // ---- header: title (≤ 2 lines) + meta line (≤ 2 lines) ----
  const titleFont: FontSpec = { size: ctx.style === "official" ? 11 : 12, weight: "bold", color: INK };
  const titleLH = lineHeightFor(titleFont.size);
  const titleLines = wrapLines(doc, a.title, innerW - indent, titleFont, 2);
  const metaFont: FontSpec = { size: 8.5, color: INK3 };
  const metaLH = lineHeightFor(metaFont.size);
  const meta = [a.date, a.location, t(`categories.${a.category}`), t(`awards.${a.awardType}`)]
    .map((v) => String(v ?? "").trim()).filter(Boolean).join("  ·  ");
  const metaLines = wrapLines(doc, meta, innerW - indent, metaFont, 2);
  const headerH = titleLines.length * titleLH + 0.5 + metaLines.length * metaLH + 2;

  // ---- right column: photos ----
  const loaded = ctx.includeImages ? await loadCardImages(doc, a.imageURLs ?? []) : { images: [], more: 0 };
  const { leftW, rightW } = cardColumns(innerW, loaded.images.length > 0);
  const images = loaded.images.map((im) => ({ ...im, ...fitImage(im.naturalW, im.naturalH, rightW) }));
  const moreText = loaded.more > 0 ? t("pdf.labels.morePhotos", { n: loaded.more }) : "";
  const rightH = images.reduce((s, im, i) => s + im.h + (i ? CARD.imgGap : 0), 0) + (moreText ? 5 : 0);

  // ---- left column: label/value rows, notes, practice notes ----
  const lines: Line[] = [];
  const labelFont: FontSpec = { size: 8, color: INK3 };
  const valueFont: FontSpec = { size: 9.5, color: INK };
  const valueLH = lineHeightFor(valueFont.size);
  const row = (label: string, value: string, vf: FontSpec = valueFont) => {
    wrapLines(doc, value, leftW - CARD.labelW, vf).forEach((text, i) => lines.push({
      h: valueLH,
      draw: (lx, ly) => {
        const base = ly + valueLH * 0.78;
        if (i === 0) { applyFont(doc, labelFont); doc.text(label, lx, base); }
        applyFont(doc, vf);
        doc.text(text, lx + CARD.labelW, base);
      },
    }));
  };
  row(t("pdf.labels.date"), a.date);
  row(t("pdf.labels.location"), a.location);
  row(t("pdf.labels.category"), t(`categories.${a.category}`));
  row(t("pdf.labels.award"), t(`awards.${a.awardType}`), { size: 9.5, weight: "bold", color: award });
  const prep = prepValue(a, t);
  if (prep) row(t("pdf.labels.prep"), prep);

  const section = (heading: string, texts: string[], font: FontSpec, bullet: boolean, maxLines?: number) => {
    const lh = lineHeightFor(font.size);
    const wrapped = texts.map((tx) => wrapLines(doc, (bullet ? "·  " : "") + tx, leftW, font, maxLines)).filter((l) => l.length);
    if (!wrapped.length) return;
    lines.push({ h: 3, draw: () => {} });
    lines.push({ h: 4.5, draw: (lx, ly) => drawLabel(doc, heading, lx, ly + 3.4, 7, INK3) });
    for (const ls of wrapped) for (const text of ls) {
      lines.push({ h: lh, draw: (lx, ly) => { applyFont(doc, font); doc.text(text, lx, ly + lh * 0.78); } });
    }
  };
  if (a.description && a.description.trim()) section(t("pdf.labels.notes"), [a.description], { size: 9.5, color: INK2 }, false);
  const notes = prepNotesFor(a, ctx.practiceLogs);
  if (notes.length) section(t("pdf.labels.prepNotes"), notes, { size: 8.5, color: INK2 }, true, 1);

  const leftH = lines.reduce((s, l) => s + l.h, 0);
  const totalH = pad * 2 + headerH + Math.max(leftH, rightH);

  // ---- where does it go? whole card here, whole card on a new page, or split ----
  const fits = (h: number) => flow.y + h <= flow.bottom;
  if (!fits(totalH)) {
    const pageCap = flow.bottom - flow.pageTop;
    const needFirst = pad * 2 + headerH + Math.max(rightH, Math.min(leftH, 20)); // header + all photos + some text
    if (totalH <= pageCap || !fits(needFirst)) flow.newPage();
  }
  const startPage = flow.pageIdx;

  const chrome = (top: number, h: number) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    if (ctx.style === "portfolio") doc.roundedRect(x, top, w, h, 3, 3, "S");
    else doc.line(x, top + h, x + w, top + h);
  };
  const drawHeader = (top: number) => {
    const base = top + pad + titleLH * 0.8;
    doc.setFillColor(...award);
    if (ctx.style === "framed") doc.rect(x0, base - 3.6, 1, 4.8, "F");
    else if (ctx.style === "portfolio") doc.circle(x0 + 2.2, base - 1.5, 2.2, "F");
    applyFont(doc, titleFont);
    titleLines.forEach((line, i) => doc.text(line, x0 + indent, base + i * titleLH));
    applyFont(doc, metaFont);
    const metaBase = top + pad + titleLines.length * titleLH + 0.5 + metaLH * 0.8;
    metaLines.forEach((line, i) => doc.text(line, x0 + indent, metaBase + i * metaLH));
    return top + pad + headerH;
  };
  const drawImages = (top: number) => {
    const rx = x0 + leftW + CARD.colGap;
    let iy = top;
    for (const im of images) {
      try {
        doc.addImage(im.dataUrl, dataUrlFormat(im.dataUrl), rx, iy, im.w, im.h);
        ctx.imgRefs.push({
          dataUrl: im.dataUrl, naturalW: im.naturalW, naturalH: im.naturalH,
          achievementTitle: a.title, achievementDate: a.date,
          page: currentPageNum(doc), x: rx, y: iy, w: im.w, h: im.h,
        });
      } catch (e) {
        console.warn("[champstep] pdf: photo skipped:", e);
      }
      iy += im.h + CARD.imgGap;
    }
    if (moreText) {
      applyFont(doc, { size: 8, color: INK3 });
      doc.text(moreText, rx, iy - CARD.imgGap + 3.5);
    }
  };

  let i = 0;
  let first = true;
  do {
    const top = flow.y;
    const avail = flow.bottom - top - pad * 2 - (first ? headerH : 0);
    let used = 0;
    let j = i;
    while (j < lines.length && used + lines[j].h <= avail) { used += lines[j].h; j++; }
    if (!first && j === i) { flow.newPage(); continue; } // nothing fits here (cannot happen on a fresh page)
    const partH = pad * 2 + (first ? headerH : 0) + (first ? Math.max(used, rightH) : used);
    chrome(top, partH);
    let ly = top + pad;
    if (first) { ly = drawHeader(top); drawImages(ly); }
    for (let k = i; k < j; k++) { lines[k].draw(x0, ly); ly += lines[k].h; }
    i = j;
    first = false;
    flow.y = top + partH + CARD.gap;
    if (i < lines.length) flow.newPage();
  } while (i < lines.length);
  return startPage;
}

// -----------------------------------------------------------------------------
// Үндсэн export функц
// -----------------------------------------------------------------------------

export async function exportPortfolio(
  child: Child,
  achievements: Achievement[],
  opts: ExportOpts = {}
): Promise<string | ArrayBuffer | void> {
  const {
    template: rawTemplate = "official",
    t = (k: string) => k,
    filename,
    includeImages = true,
    output = "save",
    fonts,
    now = new Date(),
    onPages,
    practiceLogs,
    onDoc,
  } = opts;
  const template = normalizePdfTemplate(rawTemplate);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await loadFont(doc, fonts);
  onDoc?.(doc);

  // Хавсралт бичлэгийн массив — export бүрт шинэ
  const imgRefs: ImgRef[] = [];
  const dateStr = now.toISOString().slice(0, 10);

  if (template === "official") {
    await renderOfficial(doc, child, achievements, t, includeImages, imgRefs, practiceLogs);
    addFooters(doc, t, dateStr, { align: "left", x: M, y: A4.h - 8 });
  } else if (template === "framed") {
    await renderFramed(doc, child, achievements, t, includeImages, imgRefs, practiceLogs, onPages);
    addFooters(doc, t, dateStr, { align: "center", x: A4.w / 2, y: A4.h - FRAME.content + 4 });
  } else {
    await renderPortfolio(doc, child, achievements, t, includeImages, imgRefs, practiceLogs);
    addFooters(doc, t, dateStr, { align: "center", x: A4.w / 2, y: A4.h - 8 });
  }

  if (output === "arraybuffer") return doc.output("arraybuffer");
  if (output === "bloburl") return URL.createObjectURL(doc.output("blob"));
  const safeName = (filename ?? `${child.name}_ChampStep`).replace(/[^\w.-]+/g, "_");
  doc.save(`${safeName}_${template}.pdf`);
}

// =============================================================================
// Template 1: Official — layout, fonts and table unchanged (BRAND.md)
// =============================================================================

async function renderOfficial(doc: jsPDF, child: Child, achievements: Achievement[], t: T, includeImages: boolean, imgRefs: ImgRef[], practiceLogs?: PracticeLog[]) {
  doc.setFillColor(...INK);
  doc.rect(0, 0, A4.w, 32, "F");

  drawLogo(doc, M, 20, 11, "light");

  setFont(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...STAGE_MUTED);
  doc.text(t("pdf.subtitle"), A4.w - M, 20, { align: "right" });

  const avatarCX = M + 14;
  const avatarCY = 56;
  const avatarR = 14;
  await drawAvatar(doc, child, avatarCX, avatarCY, avatarR);

  const textX = M + 14 * 2 + 5;
  setFont(doc, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(child.name, textX, 50);

  if (child.bio) {
    setFont(doc, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK2);
    doc.text(child.bio, textX, 60, { maxWidth: CW - 14 * 2 - 5 });
  }

  const stats = [
    [t("pdf.totalEntries"), String(achievements.length)],
    [t("pdf.goldMedals"), String(achievements.filter(a => a.awardType === "Gold").length)],
    [t("pdf.birthDate"), child.birthDate || "—"],
  ];

  stats.forEach(([label, val], i) => {
    const x = M + i * (CW / 3);
    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK3);
    doc.text(label, x, 82);
    setFont(doc, "bold");
    doc.setFontSize(16);
    doc.setTextColor(...INK);
    doc.text(val, x, 92);
  });

  doc.setDrawColor(...PRIMARY);
  doc.line(M, 102, A4.w - M, 102);

  // cards from 114 mm down, 20 mm clear at the bottom; continuation pages start just below the top margin
  const flow = makeFlow(doc, 114, A4.h - 20, M + 10, () => {});
  const ctx: CardCtx = { doc, t, style: "official", x: M, w: CW, includeImages, imgRefs, practiceLogs };
  for (const a of achievements) await drawCard(ctx, flow, a);

  await addAppendix(doc, imgRefs, t);
}

// =============================================================================
// Template 2: Framed — certificate feel, double frame on every page
// =============================================================================

const PT = 0.3528; // 1pt in mm
/** Outer graphite 1.2pt at 10mm, inner green 0.5pt 2.5mm further in, content 10mm inside the inner frame. */
const FRAME = { outer: 10, inner: 12.5, content: 22.5 };
const FW = A4.w - FRAME.content * 2; // content width

function drawFrame(doc: jsPDF) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(1.2 * PT);
  doc.rect(FRAME.outer, FRAME.outer, A4.w - FRAME.outer * 2, A4.h - FRAME.outer * 2);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5 * PT);
  doc.rect(FRAME.inner, FRAME.inner, A4.w - FRAME.inner * 2, A4.h - FRAME.inner * 2);
  doc.setLineWidth(0.2);
}

/** Total / Gold / Silver / Bronze row (shared by framed + portfolio covers). Returns bottom y. */
function drawMedalStats(doc: jsPDF, t: T, achievements: Achievement[], x: number, width: number, y: number, valueSize = 20): number {
  const count = (k: string) => String(achievements.filter((a) => a.awardType === k).length);
  const cells: Array<[string, string, RGB]> = [
    ["pdf.totalEntries", String(achievements.length), INK],
    ["awards.Gold", count("Gold"), GOLD],
    ["awards.Silver", count("Silver"), SILVER],
    ["awards.Bronze", count("Bronze"), BRONZE],
  ];
  return cells.reduce((bottom, [key, val, color], i) => {
    const cx = x + (i + 0.5) * (width / cells.length);
    setFont(doc, "bold");
    doc.setFontSize(valueSize);
    doc.setTextColor(...color);
    doc.text(val, cx, y, { align: "center" });
    setFont(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK3);
    doc.text(t(key), cx, y + 6, { align: "center" });
    return y + 6;
  }, y);
}
async function renderFramed(
  doc: jsPDF, child: Child, achievements: Achievement[], t: T, includeImages: boolean, imgRefs: ImgRef[],
  practiceLogs?: PracticeLog[], onPages?: (pages: number[][]) => void,
) {
  const X = FRAME.content;
  const bottomLimit = A4.h - FRAME.content - 8; // keep clear of the footer
  const contTop = FRAME.content + 14;           // first card top on continuation pages (below the small label)

  // ---- Page 1: profile header ----
  drawFrame(doc);
  drawLogo(doc, A4.w / 2, 31, 11, "color", "center");
  drawLabel(doc, t("pdf.portfolioLabel"), A4.w / 2, 38.5, 8, INK3, "center");
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(A4.w / 2 - 10, 42, A4.w / 2 + 10, 42);

  // Avatar with a green ring
  await drawAvatar(doc, child, A4.w / 2, 57, 12.5);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.circle(A4.w / 2, 57, 13.3, "S");

  // Name (Display 28), bio, birth date
  setFont(doc, "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  const nameLines = doc.splitTextToSize(child.name, FW);
  doc.text(nameLines.slice(0, 2), A4.w / 2, 81, { align: "center" });
  let y = 81 + (Math.min(nameLines.length, 2) - 1) * 11;
  if (child.bio) {
    setFont(doc, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK2);
    const bio = doc.splitTextToSize(child.bio, FW - 30);
    doc.text(bio.slice(0, 2), A4.w / 2, y + 7, { align: "center" });
    y += 7 + (Math.min(bio.length, 2) - 1) * 5;
  }
  if (child.birthDate) {
    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK3);
    doc.text(`${t("pdf.birthDate")}: ${child.birthDate}`, A4.w / 2, y + 6.5, { align: "center" });
    y += 6.5;
  }
  y = drawMedalStats(doc, t, achievements, X, FW, y + 12) + 4.5;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(X, y, A4.w - X, y);
  y += 6; // first card top

  // ---- Cards: measured one by one; a card that does not fit opens a new framed page ----
  const flow = makeFlow(doc, y, bottomLimit, contTop, () => {
    drawFrame(doc);
    // small "{name}'s achievements" label at the top of every continuation page
    drawLabel(doc, t("pdf.achievementsTitle", { name: child.name }), X, FRAME.content + 6, 7.5, INK3);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(X, FRAME.content + 9, A4.w - X, FRAME.content + 9);
  });
  const ctx: CardCtx = { doc, t, style: "framed", x: X, w: FW, includeImages, imgRefs, practiceLogs };
  const pages: number[][] = [[]];
  for (let i = 0; i < achievements.length; i++) {
    const start = await drawCard(ctx, flow, achievements[i]);
    while (pages.length <= start) pages.push([]);
    pages[start].push(i);
  }
  while (pages.length <= flow.pageIdx) pages.push([]);
  onPages?.(pages.map((p) => [...p]));

  await addAppendix(doc, imgRefs, t, { margin: FRAME.content, top: FRAME.content + 4, bottom: FRAME.content + 6, decorate: drawFrame });
}

// =============================================================================
// Template 3: Portfolio — rounded cards, certificates full-page in the appendix
// =============================================================================

async function renderPortfolio(doc: jsPDF, child: Child, achievements: Achievement[], t: T, includeImages: boolean, imgRefs: ImgRef[], practiceLogs?: PracticeLog[]) {
  const bottomLimit = A4.h - 20;

  // ---- Cover ----
  drawLogo(doc, A4.w / 2, 30, 12, "color", "center");
  drawLabel(doc, t("pdf.portfolioLabel"), A4.w / 2, 38, 8, PRIMARY, "center");

  await drawAvatar(doc, child, A4.w / 2, 82, 27);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.8);
  doc.circle(A4.w / 2, 82, 28.2, "S");

  setFont(doc, "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  const nameLines = doc.splitTextToSize(child.name, CW);
  doc.text(nameLines.slice(0, 2), A4.w / 2, 126, { align: "center" });
  let y = 126 + (Math.min(nameLines.length, 2) - 1) * 11;
  if (child.bio) {
    setFont(doc, "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK2);
    const bio = doc.splitTextToSize(child.bio, CW - 30);
    doc.text(bio.slice(0, 3), A4.w / 2, y + 9, { align: "center" });
    y += 9 + (Math.min(bio.length, 3) - 1) * 5.2;
  }
  if (child.birthDate) {
    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK3);
    doc.text(`${t("pdf.birthDate")}: ${child.birthDate}`, A4.w / 2, y + 8, { align: "center" });
    y += 8;
  }
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(A4.w / 2 - 12, y + 8, A4.w / 2 + 12, y + 8);

  y = drawMedalStats(doc, t, achievements, M, CW, y + 26, 24);

  // category chips
  const cats = (["Sports", "Arts", "Academic"] as const).map((c) => `${t(`categories.${c}`)} ${achievements.filter((a) => a.category === c).length}`);
  setFont(doc, "bold");
  doc.setFontSize(8);
  const chipW = cats.map((c) => doc.getTextWidth(c) + 6);
  let cx = A4.w / 2 - (chipW.reduce((s, w) => s + w, 0) + 4 * (cats.length - 1)) / 2;
  cats.forEach((c, i) => { cx += drawChip(doc, c, cx, y + 16, PRIMARY_SOFT, PRIMARY_SOFT_INK, 8) + 4; });

  // ---- Achievements ----
  doc.addPage();
  y = 22;
  drawLabel(doc, t("pdf.achievementsTitle", { name: child.name }), M, y, 8, INK3);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(M, y + 3, M + 14, y + 3);
  y += 10;

  const flow = makeFlow(doc, y, bottomLimit, 22, () => {});
  const ctx: CardCtx = { doc, t, style: "portfolio", x: M, w: CW, includeImages, imgRefs, practiceLogs };
  for (const a of achievements) await drawCard(ctx, flow, a);

  await addAppendix(doc, imgRefs, t);
}

// =============================================================================
// Appendix — thumbnail тус бүрд бүтэн хуудас + буцах холбоос
// =============================================================================

interface AppendixOpts {
  margin?: number;
  top?: number;
  bottom?: number;
  /** Drawn on every appendix page right after addPage (framed: the frame). */
  decorate?: (doc: jsPDF) => void;
}

async function addAppendix(doc: jsPDF, refs: ImgRef[], t: T, opts: AppendixOpts = {}) {
  if (refs.length === 0) return;
  const BM = opts.margin ?? 18;
  const top = opts.top ?? 20;
  const bottom = opts.bottom ?? 22;

  for (const ref of refs) {
    doc.addPage();
    opts.decorate?.(doc);
    ref.appendixPage = currentPageNum(doc);

    setFont(doc, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...INK3);
    doc.text(t("pdf.appendixTitle").toUpperCase(), A4.w - BM, top - 6, { align: "right", charSpace: 0.6 });

    setFont(doc, "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    const titleLines = doc.splitTextToSize(ref.achievementTitle, A4.w - 2 * BM);
    doc.text(titleLines.slice(0, 2), BM, top);
    const titleH = Math.min(titleLines.length, 2) * 6.5;

    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK3);
    doc.text(ref.achievementDate, BM, top + titleH + 2);

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(BM, top + titleH + 7, A4.w - BM, top + titleH + 7);

    // Зургийн талбай — харьцааг хадгалж хамгийн томоор нь багтаа
    const areaTop = top + titleH + 12;
    const areaW = A4.w - 2 * BM;
    const areaH = A4.h - areaTop - bottom - 8;
    let iw = areaW;
    let ih = areaH;
    if (ref.naturalW > 0 && ref.naturalH > 0) {
      const aspect = ref.naturalW / ref.naturalH;
      if (iw / ih > aspect) iw = ih * aspect; else ih = iw / aspect;
    }
    const ix = BM + (areaW - iw) / 2;
    const iy = areaTop + (areaH - ih) / 2;
    try {
      doc.addImage(ref.dataUrl, dataUrlFormat(ref.dataUrl), ix, iy, iw, ih);
    } catch {
      drawImagePlaceholder(doc, ix, iy, iw, ih);
    }

    // Буцах холбоос: жижиг chevron + текст (emoji / arrow glyph хэрэглэхгүй)
    const by = A4.h - bottom + 2;
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.5);
    doc.line(BM + 2.2, by - 2.6, BM, by - 1);
    doc.line(BM, by - 1, BM + 2.2, by + 0.6);
    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PRIMARY);
    doc.text(t("pdf.backLink"), BM + 4.5, by);
    doc.link(BM - 1, by - 5, 40, 8, { pageNumber: ref.page });
  }

  // Thumbnail -> appendix холбоос + "томруулах" тэмдэг (зурсан, глиф биш)
  for (const ref of refs) {
    if (!ref.appendixPage) continue;
    doc.setPage(ref.page);
    doc.link(ref.x, ref.y, ref.w, ref.h, { pageNumber: ref.appendixPage });
    const s = 4;
    const bx = ref.x + ref.w - s - 1;
    const byy = ref.y + ref.h - s - 1;
    doc.setFillColor(...WHITE);
    doc.roundedRect(bx, byy, s, s, 0.8, 0.8, "F");
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.35);
    // diagonal arrow to the top-right corner
    doc.line(bx + 1, byy + s - 1, bx + s - 1, byy + 1);
    doc.line(bx + s - 1, byy + 1, bx + s - 2.4, byy + 1);
    doc.line(bx + s - 1, byy + 1, bx + s - 1, byy + 2.4);
  }
}

// -----------------------------------------------------------------------------
// Footer on every page: "ChampStep-ээр үүсгэсэн · champstep.mn · 2026-10-13 · 1/5"
// -----------------------------------------------------------------------------

function addFooters(doc: jsPDF, t: T, dateStr: string, pos: { align: "left" | "center"; x: number; y: number }) {
  const total = totalPages(doc);
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setFont(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK3);
    doc.text(t("pdf.footerLine", { date: dateStr, page: i, total }), pos.x, pos.y, { align: pos.align });
  }
}
