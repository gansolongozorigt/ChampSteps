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

// -----------------------------------------------------------------------------
// Framed template: page flow (pure, unit-tested in tests/pdf-templates.test.mjs)
// -----------------------------------------------------------------------------

/** Thumbnail row box (mm) by image count in the framed template; 1 → 50×36, 2 → 46×34, 3 → 38×28. */
export const FRAMED_IMAGE_ROW: Record<1 | 2 | 3, { w: number; h: number; gap: number }> = {
  1: { w: 50, h: 36, gap: 0 },
  2: { w: 46, h: 34, gap: 5 },
  3: { w: 38, h: 28, gap: 4 },
};

/** Gap between achievement blocks on a framed page (mm). */
export const FRAMED_BLOCK_GAP = 5;

/**
 * Height (mm) of one achievement block in the framed template:
 * title + meta (11) + description lines (4.5 each) + image row (+2 gap) + 3 before the rule.
 */
export function framedBlockHeight(descLines: number, imageCount: number): number {
  const n = Math.min(Math.max(imageCount, 0), 3) as 0 | 1 | 2 | 3;
  const img = n === 0 ? 0 : FRAMED_IMAGE_ROW[n].h + 2;
  return 11 + Math.min(Math.max(descLines, 0), 2) * 4.5 + img + 3;
}

/**
 * Fill pages in order: a block goes on the current page while it fits (height +
 * gap), otherwise it starts the next page; blocks are never split. The first
 * page has its own capacity (profile header above the blocks). Returns the
 * block indices per page; an over-tall block still gets a page of its own.
 */
export function planPages(heights: readonly number[], firstCapacity: number, pageCapacity: number, gap: number): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  let cap = firstCapacity;
  heights.forEach((h, i) => {
    const need = page.length ? gap + h : h;
    if (page.length && used + need > cap) {
      pages.push(page);
      page = [i];
      used = h;
      cap = pageCapacity;
    } else {
      page.push(i);
      used += need;
    }
  });
  if (page.length) pages.push(page);
  return pages;
}
