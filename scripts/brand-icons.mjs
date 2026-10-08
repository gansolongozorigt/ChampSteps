#!/usr/bin/env node
// scripts/brand-icons.mjs — PWA / favicon / apple-touch icons from the Logo mark (sharp).
//   node scripts/brand-icons.mjs
// Writes public/favicon.svg, favicon.png (48), apple-touch-icon.png (180),
// icon-192.png, icon-512.png, icon-512-maskable.png (safe zone: mark at 60 %).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const GREEN = "#2F7D5B", INK = "#18251D", WHITE = "#FFFFFF";
const BARS = [[2, 20, 8, 10, GREEN], [12, 13, 8, 17, GREEN], [22, 4, 8, 26, INK]];
const mark = (s, ox, oy) => BARS.map(([x, y, w, h, c]) => `<rect x="${ox + x * s}" y="${oy + y * s}" width="${w * s}" height="${h * s}" rx="${2.5 * s}" fill="${c}"/>`).join("");

/** size px; markPct = mark box width as a fraction of the icon; rounded = corner radius fraction (0 = square) */
function iconSvg(size, markPct, rounded) {
  const box = size * markPct, s = box / 32, o = (size - box) / 2;
  const r = size * rounded;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${WHITE}"/>${mark(s, o, o)}</svg>`;
}
const favSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${mark(1, 0, 0)}</svg>`;
writeFileSync("public/favicon.svg", favSvg);

const out = [
  ["public/favicon.png", 48, 0.8, 0.22],
  ["public/apple-touch-icon.png", 180, 0.66, 0],      // iOS masks its own corners
  ["public/icon-192.png", 192, 0.66, 0.2],
  ["public/icon-512.png", 512, 0.66, 0.2],
  ["public/icon-512-maskable.png", 512, 0.56, 0],     // full-bleed white, mark inside the safe zone
];
for (const [file, size, pct, rounded] of out) {
  await sharp(Buffer.from(iconSvg(size, pct, rounded))).png().toFile(file);
  console.log(file, size);
}
