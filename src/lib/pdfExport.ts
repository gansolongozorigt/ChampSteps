// =============================================================================
// pdfExport — Generates a real downloadable PDF of a child's portfolio using
// jsPDF (no headless browser, no window.print hack).
//
// Layout:
//   • Cover page — child's name, bio, generated date, total count.
//   • One entry per achievement with optional first photo.
// =============================================================================

import { jsPDF } from "jspdf";
import type { Achievement, Child } from "../types";

// Note: Cyrillic rendering in jsPDF's built-in Helvetica is limited. For
// production-grade Mongolian text, embed a Unicode font with doc.addFileToVFS
// and doc.addFont(). We keep this dependency-free and use the "Default" font,
// which handles Latin cleanly and most Cyrillic on modern viewers.

interface ExportOpts {
  filename?: string;
  locale?: "mn" | "en";
  /** Translator function — pass t from react-i18next. */
  t?: (key: string, opts?: Record<string, unknown>) => string;
}

const A4 = { w: 210, h: 297 };
const MARGIN = 18;
const CONTENT_W = A4.w - MARGIN * 2;

export async function exportPortfolio(
  child: Child,
  achievements: Achievement[],
  opts: ExportOpts = {}
): Promise<void> {
  const { t = (k: string) => k, filename } = opts;

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  await renderCover(doc, child, achievements.length, t);

  let pageNum = 1;
  for (const ach of achievements) {
    doc.addPage();
    pageNum += 1;
    await renderAchievement(doc, ach, pageNum, achievements.length, t);
  }

  const safeName = (filename ?? `${child.name}_ChampStep`).replace(/[^\w.-]+/g, "_");
  doc.save(`${safeName}.pdf`);
}

// -----------------------------------------------------------------------------
// Cover page
// -----------------------------------------------------------------------------

async function renderCover(
  doc: jsPDF,
  child: Child,
  total: number,
  t: NonNullable<ExportOpts["t"]>
) {
  // Top accent bar
  doc.setFillColor(28, 25, 23); // stone-900
  doc.rect(0, 0, A4.w, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CHAMPSTEP", MARGIN, 18);

  // Title
  doc.setTextColor(28, 25, 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const title = t("pdf.coverTitle", { name: child.name });
  doc.text(title, MARGIN, 70, { maxWidth: CONTENT_W });

  // Bio
  if (child.bio) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(87, 83, 78); // stone-600
    doc.text(child.bio, MARGIN, 90, { maxWidth: CONTENT_W });
  }

  // Meta grid
  const gridY = 120;
  const metaItems: Array<[string, string]> = [
    [t("pdf.meta.birthDate"), child.birthDate || "—"],
    [t("pdf.meta.totalEntries"), String(total)],
    [t("pdf.meta.generated"), new Date().toLocaleDateString()],
  ];
  metaItems.forEach(([label, value], i) => {
    const colW = CONTENT_W / metaItems.length;
    const x = MARGIN + i * colW;

    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text(label, x, gridY);

    doc.setFontSize(13);
    doc.setTextColor(28, 25, 23);
    doc.setFont("helvetica", "bold");
    doc.text(value, x, gridY + 7);
    doc.setFont("helvetica", "normal");
  });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(168, 162, 158);
  doc.text(t("pdf.coverFooter"), MARGIN, A4.h - 12);
}

// -----------------------------------------------------------------------------
// Achievement page
// -----------------------------------------------------------------------------

async function renderAchievement(
  doc: jsPDF,
  ach: Achievement,
  page: number,
  total: number,
  t: NonNullable<ExportOpts["t"]>
) {
  // Header pill
  doc.setFillColor(245, 245, 244); // stone-100
  doc.roundedRect(MARGIN, MARGIN, CONTENT_W, 10, 2, 2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text(t("pdf.pageOf", { current: page, total }), MARGIN + 3, MARGIN + 6.5);

  const awardLabel = t(`awards.${ach.awardType}`);
  const categoryLabel = t(`categories.${ach.category}`);
  doc.text(
    `${categoryLabel} · ${awardLabel}`,
    A4.w - MARGIN - 3,
    MARGIN + 6.5,
    { align: "right" }
  );

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(28, 25, 23);
  doc.text(ach.title, MARGIN, MARGIN + 25, { maxWidth: CONTENT_W });

  // Sub-line: date · location
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(120, 113, 108);
  const sub = [ach.date, ach.location].filter(Boolean).join(" · ");
  doc.text(sub, MARGIN, MARGIN + 34);

  // Description
  doc.setFontSize(11);
  doc.setTextColor(68, 64, 60);
  const descLines = doc.splitTextToSize(ach.description || "", CONTENT_W);
  doc.text(descLines, MARGIN, MARGIN + 46);

  // Photo (first one only, fitted)
  const firstPhoto = ach.imageURLs?.[0];
  if (firstPhoto) {
    try {
      const dataUrl = await urlToDataUrl(firstPhoto);
      const imgY = MARGIN + 46 + descLines.length * 5 + 6;
      const maxH = A4.h - imgY - MARGIN - 10;
      const imgH = Math.min(100, maxH);
      doc.addImage(dataUrl, "JPEG", MARGIN, imgY, CONTENT_W, imgH, undefined, "FAST");
    } catch (e) {
      console.warn("[champstep] could not embed image:", e);
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(168, 162, 158);
  doc.text("ChampStep", MARGIN, A4.h - 8);
  doc.text(String(page), A4.w - MARGIN, A4.h - 8, { align: "right" });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Load a remote image URL (Firebase Storage or otherwise) and return a
 * base64 data URL suitable for jsPDF.addImage. Uses the Canvas trick so
 * we don't need a CORS-enabled fetch for every image.
 */
function urlToDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("2d context missing");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("image load failed: " + url));
    img.src = url;
  });
}
