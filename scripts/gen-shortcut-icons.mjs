// node scripts/gen-shortcut-icons.mjs — manifest shortcut icons (96px, brand green glyph on white)
// and the Android notification badge (96px white glyph on transparent). Lucide paths
// (calendar-check, plus, footprints-free "steps" logo mark) — no emoji.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const GREEN = "#2F7D5B";
const INK = "#18251D";

// lucide "calendar-check" and "plus", 24-unit grid, stroke 2
const CAL_CHECK = `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>`;
const PLUS = `<path d="M5 12h14"/><path d="M12 5v14"/>`;

function svg(paths, { bg, stroke, pad = 20 }) {
  const inner = 96 - pad * 2;
  const scale = inner / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  ${bg ? `<rect width="96" height="96" rx="20" fill="${bg}"/>` : ""}
  <g transform="translate(${pad} ${pad}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>`;
}

// Logo mark for the badge: three rising rounded bars (src/components/Logo.tsx), white on transparent.
const BADGE = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect x="14" y="52" width="18" height="30" rx="6" fill="#FFFFFF"/>
  <rect x="39" y="36" width="18" height="46" rx="6" fill="#FFFFFF"/>
  <rect x="64" y="14" width="18" height="68" rx="6" fill="#FFFFFF"/>
</svg>`;

const out = [
  ["public/shortcut-today.png", svg(CAL_CHECK, { bg: "#FFFFFF", stroke: GREEN })],
  ["public/shortcut-add.png", svg(PLUS, { bg: "#FFFFFF", stroke: GREEN })],
  ["public/badge-96.png", BADGE],
];
for (const [file, s] of out) {
  const png = await sharp(Buffer.from(s)).png().toBuffer();
  writeFileSync(file, png);
  console.log(file, png.length, "bytes");
}
void INK;
