// Logo.tsx — the ONE ChampStep logo (docs/BRAND.md → Icon).
// Mark: three ascending rounded bars — first two forest green, the tallest graphite.
// Wordmark: "Champ" ink + "Step" primary, Manrope 800. Used by the header, login,
// PDF export (logoSvgString) and the PWA icons (scripts/brand-icons.mjs).
import type { CSSProperties } from "react";

export const BRAND_GREEN = "#2F7D5B";
export const BRAND_INK = "#18251D";
export const BRAND_WHITE = "#FFFFFF";

export type LogoTone = "color" | "light" | "ink";

/** Bars of the mark in a 32×32 box. */
export const LOGO_BARS = [
  { x: 2, y: 20, w: 8, h: 10 },
  { x: 12, y: 13, w: 8, h: 17 },
  { x: 22, y: 4, w: 8, h: 26 },
] as const;

export function markColors(tone: LogoTone): [string, string, string] {
  if (tone === "light") return [BRAND_WHITE, BRAND_WHITE, "#C9D6CE"];
  if (tone === "ink") return [BRAND_INK, BRAND_INK, BRAND_INK];
  return [BRAND_GREEN, BRAND_GREEN, BRAND_INK];
}

/** Plain SVG string of the mark (for PDF / icon generation outside React). */
export function logoMarkSvg(size: number, tone: LogoTone = "color"): string {
  const c = markColors(tone);
  const bars = LOGO_BARS.map((b, i) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2.5" fill="${c[i]}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${bars}</svg>`;
}

export function LogoMark({ size = 24, tone = "color", className, style }: { size?: number; tone?: LogoTone; className?: string; style?: CSSProperties }) {
  const c = markColors(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} style={style} aria-hidden="true" focusable="false">
      {LOGO_BARS.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2.5" fill={c[i]} />)}
    </svg>
  );
}

export interface LogoProps {
  /** Mark height in px; the wordmark scales with it. */
  size?: number;
  tone?: LogoTone;
  wordmark?: boolean;
  className?: string;
}

export default function Logo({ size = 24, tone = "color", wordmark = true, className }: LogoProps) {
  const ink = tone === "light" ? BRAND_WHITE : BRAND_INK;
  const step = tone === "light" ? "#C9D6CE" : tone === "ink" ? BRAND_INK : BRAND_GREEN;
  return (
    <span className={["inline-flex items-center gap-2 select-none", className].filter(Boolean).join(" ")} aria-label="ChampStep" role="img">
      <LogoMark size={size} tone={tone} />
      {wordmark && (
        <span style={{ fontSize: size * 0.8, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.02em" }}>
          <span style={{ color: ink }}>Champ</span>
          <span style={{ color: step }}>Step</span>
        </span>
      )}
    </span>
  );
}
