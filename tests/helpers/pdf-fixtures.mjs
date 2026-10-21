// Shared by tests/pdf-templates.test.mjs and tests/pdf-layout.test.mjs:
// NotoSans fonts from public/, i18n lookup like the app's, sharp-made fixture images.
import { readFileSync } from "node:fs";
import sharp from "sharp";

/** i18next-style lookup with {{var}} interpolation and count plurals over a locale json (mn by default). */
export function makeT(lang = "mn") {
  const dict = JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${lang}.json`, import.meta.url), "utf8"));
  const rules = new Intl.PluralRules(lang);
  const get = (k) => k.split(".").reduce((o, p) => (o && typeof o === "object" ? o[p] : undefined), dict);
  return (key, vars = {}) => {
    // i18next v4 plurals: key_one / key_few / key_many / key_other picked by Intl.PluralRules
    const v = typeof vars.count === "number" ? get(`${key}_${rules.select(vars.count)}`) ?? get(`${key}_other`) ?? get(key) : get(key);
    if (typeof v !== "string") return key;
    return v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
  };
}

export const fonts = {
  regular: readFileSync(new URL("../../public/NotoSans-Regular.ttf", import.meta.url)).toString("base64"),
  bold: readFileSync(new URL("../../public/NotoSans-Bold.ttf", import.meta.url)).toString("base64"),
};

const svgText = (w, h, text, size, fill) =>
  Buffer.from(`<svg width="${w}" height="${h}"><text x="50%" y="50%" font-family="Helvetica, Arial" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`);

/** Fixture images as data URLs: a 16:10 landscape photo, a portrait "certificate", a square-ish avatar, a wide panorama. */
export async function fixtures() {
  const landscape = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#2F7D5B" } })
    .composite([{ input: svgText(1600, 1000, "PHOTO 16:10", 140, "#DDF3E6") }]).jpeg({ quality: 82 }).toBuffer();
  const certificate = await sharp({ create: { width: 1000, height: 1400, channels: 3, background: "#FFFFFF" } })
    .composite([
      { input: Buffer.from(`<svg width="1000" height="1400"><rect x="40" y="40" width="920" height="1320" fill="none" stroke="#18251D" stroke-width="10"/><rect x="70" y="70" width="860" height="1260" fill="none" stroke="#2F7D5B" stroke-width="4"/></svg>`) },
      { input: svgText(1000, 1400, "CERTIFICATE", 110, "#18251D") },
    ]).jpeg({ quality: 85 }).toBuffer();
  const avatar = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#C9D6CE" } })
    .composite([{ input: svgText(600, 800, "T", 320, "#18251D") }]).png().toBuffer();
  const panorama = await sharp({ create: { width: 2400, height: 800, channels: 3, background: "#D4A24C" } })
    .composite([{ input: svgText(2400, 800, "PANORAMA 3:1", 160, "#18251D") }]).jpeg({ quality: 82 }).toBuffer();
  return {
    landscape: `data:image/jpeg;base64,${landscape.toString("base64")}`,
    certificate: `data:image/jpeg;base64,${certificate.toString("base64")}`,
    avatar: `data:image/png;base64,${avatar.toString("base64")}`,
    panorama: `data:image/jpeg;base64,${panorama.toString("base64")}`,
  };
}
