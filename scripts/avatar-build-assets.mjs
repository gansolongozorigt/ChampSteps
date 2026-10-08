#!/usr/bin/env node
// =============================================================================
// scripts/avatar-build-assets.mjs — prototype avatar asset pipeline (sharp)
//   node scripts/avatar-build-assets.mjs [--src scratch/avatar-dev/avatar-dev] [--quality 82]
// Input (NOT in git): <src>/temuulen/{idle,wave,happy,celebrate,sleep,grow}.png (1024² RGBA)
//                     <src>/reference/*.png
// Output: public/avatar/dev/temuulen/{state}.webp  (512², same scale, feet on one baseline)
//         docs/avatar/reference/*.jpg               (≤400 KB each, for the designer brief)
//         scratch/avatar-dev/preview.png            (contact sheet on the graphite stage)
// Background: the sources already carry real alpha (checked: corners 0, 77–86 % fully
// transparent). If a frame has NO alpha, a light background is removed by colour
// distance to the corner colour with a soft 2-step edge (see removeLightBackground).
// =============================================================================
import sharp from "sharp";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const SRC = arg("--src", "scratch/avatar-dev/avatar-dev");
const QUALITY = Number(arg("--quality", 82));
const STATES = ["idle", "wave", "happy", "celebrate", "sleep", "grow"];
const CANVAS = 1024, OUT = 512, BASELINE = 960; // feet at 960/1024 → 480/512 (room for the ground glow)
const ALPHA_T = 32;
const OUT_DIR = "public/avatar/dev/temuulen", REF_DIR = "docs/avatar/reference";
mkdirSync(OUT_DIR, { recursive: true }); mkdirSync(REF_DIR, { recursive: true });

/** Flood-free matte: alpha = clamp(distance(pixel, bg) / soft) — only used when the PNG has no alpha. */
async function removeLightBackground(img) {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, bg = [data[0], data[1], data[2]];
  const out = Buffer.from(data);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4] - bg[0], g = data[i * 4 + 1] - bg[1], b = data[i * 4 + 2] - bg[2];
    const d = Math.sqrt(r * r + g * g + b * b);           // colour distance to the background
    const a = Math.max(0, Math.min(1, (d - 18) / 40));    // 18 → 0 %, 58 → 100 % : soft edge
    out[i * 4 + 3] = Math.round(255 * a);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } });
}

async function bbox(img) {
  const { data, info } = await img.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let minX = W, minY = H, maxX = -1, maxY = -1, opaque = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] >= ALPHA_T) { opaque++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, opaque, hasAlpha: opaque < W * H };
}

const report = [];
const tiles = [];
for (const state of STATES) {
  const file = `${SRC}/temuulen/${state}.png`;
  let img = sharp(file);
  const meta = await img.metadata();
  let bb = await bbox(img);
  if (!meta.hasAlpha || !bb.hasAlpha) { img = await removeLightBackground(img); bb = await bbox(img); report.push(`${state}: background removed by colour distance`); }
  // Same scale for every frame (sources share one 1024² canvas + character scale);
  // crop to the visible bbox, then place it centred with the feet on BASELINE.
  const crop = await img.clone().extract({ left: bb.minX, top: bb.minY, width: bb.w, height: bb.h }).png().toBuffer();
  const left = Math.round(CANVAS / 2 - bb.w / 2), top = BASELINE - bb.h;
  if (top < 0 || left < 0) throw new Error(`${state} does not fit: top=${top} left=${left}`);
  const aligned = sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: crop, left, top }]).png();
  const outPath = `${OUT_DIR}/${state}.webp`;
  await sharp(await aligned.toBuffer()).resize(OUT, OUT, { kernel: "lanczos3" }).webp({ quality: QUALITY, alphaQuality: 90, effort: 6 }).toFile(outPath);
  const kb = statSync(outPath).size / 1024;
  tiles.push(outPath);
  report.push(`${state}: src ${meta.width}x${meta.height} alpha=${meta.hasAlpha} bbox ${bb.w}x${bb.h} bottom@${bb.maxY} → shifted dy=${BASELINE - 1 - bb.maxY} dx=${left - bb.minX} → ${outPath} ${kb.toFixed(1)} KB`);
}
const total = tiles.reduce((s, p) => s + statSync(p).size, 0) / 1024;
report.push(`total webp: ${total.toFixed(1)} KB (budget 300)`);

// reference images → jpg ≤ 400 KB
for (const f of readdirSync(`${SRC}/reference`).filter((f) => /\.(png|jpe?g)$/i.test(f))) {
  const out = `${REF_DIR}/${f.replace(/\.\w+$/, ".jpg")}`;
  let q = 85, size = Infinity;
  while (q >= 40) {
    await sharp(`${SRC}/reference/${f}`).flatten({ background: "#ffffff" }).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toFile(out);
    size = statSync(out).size; if (size <= 400 * 1024) break; q -= 10;
  }
  report.push(`reference ${f} → ${out} q${q} ${(size / 1024).toFixed(0)} KB`);
}

// contact sheet on the graphite stage with the baseline drawn
const T = 256, PAD = 16;
const sheet = sharp({ create: { width: (T + PAD) * STATES.length + PAD, height: T + 2 * PAD + 28, channels: 4, background: "#18251D" } });
const line = Buffer.from(`<svg width="${(T + PAD) * STATES.length + PAD}" height="${T + 2 * PAD + 28}"><line x1="0" y1="${PAD + T * (BASELINE / CANVAS)}" x2="100%" y2="${PAD + T * (BASELINE / CANVAS)}" stroke="#2F7D5B" stroke-width="1" stroke-dasharray="4 4"/>${STATES.map((s, i) => `<text x="${PAD + i * (T + PAD) + T / 2}" y="${T + PAD + 20}" fill="#ffffff" font-family="sans-serif" font-size="13" text-anchor="middle">${s}</text>`).join("")}</svg>`);
await sheet.composite([{ input: line, left: 0, top: 0 }, ...(await Promise.all(tiles.map(async (p, i) => ({ input: await sharp(p).resize(T, T).png().toBuffer(), left: PAD + i * (T + PAD), top: PAD }))))])
  .png().toFile("scratch/avatar-dev/preview.png");
report.push("preview → scratch/avatar-dev/preview.png");
writeFileSync("scratch/avatar-dev/build-report.txt", report.join("\n"));
console.log(report.join("\n"));
