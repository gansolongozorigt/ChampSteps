// node scripts/gen-native-assets.mjs — source images for @capacitor/assets (npm run cap:assets):
//   resources/icon.png              1024×1024, white, no alpha, no rounded corners (stores round it)
//   resources/icon-foreground.png   1024×1024 adaptive foreground (bars in the safe zone), transparent
//   resources/icon-background.png   1024×1024 solid white
//   resources/splash.png (+ -dark)  2732×2732 white, logo mark centred
// The mark = Logo.tsx LOGO_BARS (3 rising bars: green, green, graphite).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const GREEN = "#2F7D5B", INK = "#18251D", WHITE = "#FFFFFF";
const BARS = [{ x: 2, y: 20, w: 8, h: 10 }, { x: 12, y: 13, w: 8, h: 17 }, { x: 22, y: 4, w: 8, h: 26 }]; // 32-unit grid
const COLORS = [GREEN, GREEN, INK];

function mark(size, scale, offsetX, offsetY) {
  return BARS.map((b, i) => `<rect x="${offsetX + b.x * scale}" y="${offsetY + b.y * scale}" width="${b.w * scale}" height="${b.h * scale}" rx="${2.5 * scale}" fill="${COLORS[i]}"/>`).join("");
}
function svg(size, bg, markScale) {
  const s = (size * markScale) / 32;      // bars occupy markScale of the canvas
  const off = (size - 32 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}${mark(size, s, off, off)}</svg>`;
}
const out = [
  ["resources/icon.png", svg(1024, WHITE, 0.62), false],
  ["resources/icon-foreground.png", svg(1024, null, 0.42), true],   // adaptive safe zone = inner 66 %
  ["resources/icon-background.png", `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${WHITE}"/></svg>`, false],
  ["resources/splash.png", svg(2732, WHITE, 0.16), false],
  ["resources/splash-dark.png", svg(2732, WHITE, 0.16), false],
];
for (const [file, s, alpha] of out) {
  let img = sharp(Buffer.from(s)).png();
  if (!alpha) img = img.flatten({ background: WHITE }).removeAlpha();
  const buf = await img.toBuffer();
  writeFileSync(file, buf);
  const meta = await sharp(buf).metadata();
  console.log(file, meta.width + "x" + meta.height, "alpha:", meta.hasAlpha);
}
