// scripts/marketing/og-image.mjs — renders public/og.png (1200×630) for the share preview.
//
//   npm run marketing:og            → public/og.png (+ scratch/marketing/og.html for inspection)
//
// Brand (docs/BRAND.md): forest green background, the one logo (light tone), Manrope 800,
// the tagline from index.html's og:description. Fonts are embedded from public/fonts, so the
// page renders identically on any machine; Chrome (channel "chrome") does the rasterising.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = `${ROOT}public/og.png`;
const SCRATCH = `${ROOT}scratch/marketing`;
mkdirSync(SCRATCH, { recursive: true });

const TITLE = "Хүүхдийн амжилтын дижитал портфолио";
const TAGLINE = "Тэмцээнээ зорилго болго, өдөр бүр бэлтгэлээ тэмдэглэ.";
const GREEN = "#2F7D5B", GREEN_DEEP = "#23634A", INK = "#18251D", WHITE = "#FFFFFF", MUTED = "#C9D6CE";

const font = (file) => `url(data:font/woff2;base64,${readFileSync(`${ROOT}public/fonts/${file}`).toString("base64")}) format("woff2")`;
const face = (weight, cyr, lat) => `@font-face{font-family:Manrope;font-weight:${weight};font-display:block;src:${font(cyr)},${font(lat)};}`;

// Logo mark from src/components/Logo.tsx (LOGO_BARS, light tone: white, white, muted).
const mark = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="2" y="20" width="8" height="10" rx="2.5" fill="${WHITE}"/>
  <rect x="12" y="13" width="8" height="17" rx="2.5" fill="${WHITE}"/>
  <rect x="22" y="4" width="8" height="26" rx="2.5" fill="${MUTED}"/></svg>`;

const html = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><style>
${face(800, "manrope-800-cyrillic.woff2", "manrope-800-latin.woff2")}
${face(600, "manrope-600-cyrillic.woff2", "manrope-600-latin.woff2")}
html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden}
body{font-family:Manrope,system-ui,sans-serif;background:${GREEN};color:${WHITE};position:relative}
.bg{position:absolute;inset:0;background:linear-gradient(135deg,${GREEN} 0%,${GREEN_DEEP} 100%)}
.bars{position:absolute;right:-40px;bottom:-60px;opacity:.14}
.wrap{position:absolute;inset:0;padding:72px 84px;display:flex;flex-direction:column;justify-content:space-between}
.logo{display:flex;align-items:center;gap:18px}
.word{font-weight:800;font-size:54px;letter-spacing:-.02em;line-height:1}
.word b{color:${WHITE};font-weight:800}.word i{color:${MUTED};font-style:normal;font-weight:800}
h1{margin:0;font-weight:800;font-size:66px;line-height:1.08;letter-spacing:-.02em;max-width:980px;text-wrap:balance}
p.tag{margin:22px 0 0;font-weight:600;font-size:30px;line-height:1.3;color:${MUTED};max-width:900px}
.foot{display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:24px;color:${MUTED}}
.pill{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:10px 18px;font-size:20px;color:${WHITE}}
.dot{width:10px;height:10px;border-radius:50%;background:${WHITE}}
</style></head><body>
<div class="bg"></div>
<div class="bars">${mark(560)}</div>
<div class="wrap">
  <div class="logo">${mark(64)}<div class="word"><b>Champ</b><i>Step</i></div></div>
  <div><h1>${TITLE}</h1><p class="tag">${TAGLINE}</p></div>
  <div class="foot"><span>champstep.mn</span><span class="pill"><span class="dot"></span>Зорилго · Бэлтгэл · Амжилт · PDF портфолио</span></div>
</div></body></html>`;

writeFileSync(`${SCRATCH}/og.html`, html);

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
  const optimized = await sharp(png).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  writeFileSync(OUT, optimized);
  const meta = await sharp(optimized).metadata();
  console.log(`public/og.png ${meta.width}×${meta.height} · ${(optimized.length / 1024).toFixed(0)} KB`);
} finally {
  await browser.close();
}
