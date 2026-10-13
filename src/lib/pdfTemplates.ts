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
 * Old template ids (v7: official / kids / gold / portfolio / framed) → v8.
 * Nothing persists the choice today (no localStorage / Firestore field); the map
 * only guards values that may still arrive from old state, links or tests.
 */
export const LEGACY_TEMPLATE_MAP: Record<string, PdfTemplate> = {
  official: "official",
  gold: "framed",         // v7 "Gold" award look → certificate-style framed
  framed: "framed",       // v7 decorative frame → framed
  portfolio: "portfolio", // v7 resume-style → image portfolio
  kids: "portfolio",      // v7 i18n-only leftover → image portfolio
};
export function normalizePdfTemplate(value: unknown): PdfTemplate {
  if (typeof value === "string" && value in LEGACY_TEMPLATE_MAP) return LEGACY_TEMPLATE_MAP[value];
  return "official";
}
