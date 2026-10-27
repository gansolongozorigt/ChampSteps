// src/lib/pdfTemplates.ts — PDF template ids + plan gating + legacy id map.
// No jsPDF import here so App / PdfPreviewModal can use it without pulling the
// pdfExport chunk into the main bundle (pdfExport stays a dynamic import).

export const PDF_TEMPLATES = ["official", "framed", "portfolio"] as const;
export type PdfTemplate = (typeof PDF_TEMPLATES)[number];

/** Templates that need a paid plan; "official" is available on the free plan too. */
export const PAID_PDF_TEMPLATES: readonly PdfTemplate[] = ["framed", "portfolio"];
export function isPaidTemplate(tpl: PdfTemplate): boolean {
  return PAID_PDF_TEMPLATES.includes(tpl);
}

/**
 * Old template ids (v7: official / kids / gold / portfolio / framed) -> v8.
 * Nothing persists the choice today (no localStorage / Firestore field); the map
 * only guards values that may still arrive from old state, links or tests.
 */
export const LEGACY_TEMPLATE_MAP: Record<string, PdfTemplate> = {
  official: "official",
  gold: "framed",         // v7 "Gold" award look -> certificate-style framed
  framed: "framed",       // v7 decorative frame -> framed
  portfolio: "portfolio", // v7 resume-style -> image portfolio
  kids: "portfolio",      // v7 i18n-only leftover -> image portfolio
};
export function normalizePdfTemplate(value: unknown): PdfTemplate {
  if (typeof value === "string" && value in LEGACY_TEMPLATE_MAP) return LEGACY_TEMPLATE_MAP[value];
  return "official";
}

// -----------------------------------------------------------------------------
// Achievement card (all 3 templates): 2-column layout constants + column maths
// (pure, unit-tested in tests/pdf-layout.test.mjs)
// -----------------------------------------------------------------------------

/** Card geometry in mm. The left column holds label/value rows + notes, the right one the photos. */
export const CARD = {
  /** inner padding on every side */
  pad: 4,
  /** label column width inside the left column */
  labelW: 24,
  /** gap between the two columns */
  colGap: 5,
  /** share of the inner width given to the left (text) column when there are photos */
  leftRatio: 0.58,
  /** one photo never grows taller than this */
  imgMaxH: 45,
  /** vertical gap between stacked photos */
  imgGap: 3,
  /** photos shown on the card; the rest becomes "+N" */
  maxImages: 3,
  /** space between cards */
  gap: 6,
} as const;

/**
 * Column widths for a card whose inner width (padding already removed) is `innerW`.
 * Without photos the right column collapses and the text column takes the full width.
 */
export function cardColumns(innerW: number, hasImages: boolean): { leftW: number; rightW: number } {
  if (!hasImages) return { leftW: innerW, rightW: 0 };
  const rightW = Math.round(innerW * (1 - CARD.leftRatio));
  return { leftW: innerW - rightW - CARD.colGap, rightW };
}

/** Photo box (mm) for a natural size, fitted to `colW` wide and at most CARD.imgMaxH tall, aspect kept. */
export function fitImage(naturalW: number, naturalH: number, colW: number): { w: number; h: number } {
  const aspect = naturalW > 0 && naturalH > 0 ? naturalW / naturalH : 4 / 3;
  const w = Math.min(colW, CARD.imgMaxH * aspect);
  return { w, h: Math.min(CARD.imgMaxH, w / aspect) };
}
