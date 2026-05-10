// =============================================================================
// pdfExport v3 — i18n бүрэн дэмжсэн, 3 template
// =============================================================================

import { jsPDF } from "jspdf";
import type { Achievement, Child } from "../types";

export type PdfTemplate = "official" | "kids" | "gold";

interface ExportOpts {
  template?: PdfTemplate;
  filename?: string;
  language?: "mn" | "en";
  includeImages?: boolean;
  t?: (key: string, opts?: Record<string, unknown>) => string;
}

const A4 = { w: 210, h: 297 };
const M = 18;
const CW = A4.w - M * 2;

// -----------------------------------------------------------------------------
// Font cache
// -----------------------------------------------------------------------------

interface FontCache {
  regular: string | null;
  bold: string | null;
}

const fontCache: FontCache = { regular: null, bold: null };

async function loadFont(doc: jsPDF) {
  if (!fontCache.regular || !fontCache.bold) {
    try {
      const [regRes, boldRes] = await Promise.all([
        fetch("/NotoSans-Regular.ttf"),
        fetch("/NotoSans-Bold.ttf"),
      ]);
      const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);

      const toBase64 = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      fontCache.regular = toBase64(regBuf);
      fontCache.bold = toBase64(boldBuf);
    } catch (e) {
      console.warn("[champstep] NotoSans фонт ачаалахад алдаа:", e);
      return;
    }
  }

  try {
    doc.addFileToVFS("NotoSans-Regular.ttf", fontCache.regular!);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFileToVFS("NotoSans-Bold.ttf", fontCache.bold!);
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  } catch (e) {
    console.warn("[champstep] doc-д фонт нэмэхэд алдаа:", e);
  }
}

function setFont(doc: jsPDF, weight: "normal" | "bold" = "normal") {
  const fontList = doc.getFontList();
  if (fontList["NotoSans"]) {
    doc.setFont("NotoSans", weight);
  } else {
    doc.setFont("helvetica", weight);
  }
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export async function exportPortfolio(
  child: Child,
  achievements: Achievement[],
  opts: ExportOpts = {}
): Promise<void> {
  const {
    template = "official",
    t = (k: string) => k,
    language = "mn",
    includeImages = false,
    filename,
  } = opts;

  // Огноог хэлтэй уялдуулан форматлах
  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(language === "en" ? "en-US" : "mn-MN", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  // Зургуудыг урьдчилан татах (includeImages=true бол)
  const imageCache = new Map<string, string>();
  if (includeImages) {
    const allUrls = achievements.flatMap(a => a.imageURLs ?? []).slice(0, 30);
    await Promise.allSettled(
      allUrls.map(async (url) => {
        try {
          const dataUrl = await urlToDataUrl(url);
          imageCache.set(url, dataUrl);
        } catch {
          // зураг татагдахгүй бол алгасана
        }
      })
    );
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await loadFont(doc);

  if (template === "official") {
    await renderOfficial(doc, child, achievements, t, formatDate, imageCache);
  } else if (template === "kids") {
    await renderKids(doc, child, achievements, t, formatDate, imageCache);
  } else {
    await renderGold(doc, child, achievements, t, formatDate, imageCache);
  }

  const safeName = (filename ?? `${child.name}_ChampStep`).replace(/[^\w.-]+/g, "_");
  doc.save(`${safeName}_${template}.pdf`);
}

// =============================================================================
// Template 1: Official
// =============================================================================

async function renderOfficial(
  doc: jsPDF,
  child: Child,
  achievements: Achievement[],
  t: (k: string, o?: Record<string, unknown>) => string,
  formatDate: (iso: string) => string,
  imageCache: Map<string, string>
) {
  const IMG_W = 34;
  const IMG_H = 25;
  const textW = imageCache.size > 0 ? CW - IMG_W - 4 : CW;

  // Header bar
  doc.setFillColor(28, 25, 23);
  doc.rect(0, 0, A4.w, 32, "F");

  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("CHAMPSTEP", M, 20);

  doc.setFontSize(8);
  doc.setTextColor(160, 150, 140);
  doc.text(t("pdf.subtitle"), A4.w - M, 20, { align: "right" });

  // Child name
  setFont(doc, "bold");
  doc.setFontSize(26);
  doc.setTextColor(28, 25, 23);
  doc.text(child.name, M, 60);

  if (child.bio) {
    setFont(doc, "normal");
    doc.setFontSize(12);
    doc.setTextColor(100, 95, 90);
    doc.text(child.bio, M, 72, { maxWidth: CW });
  }

  // Stats
  const stats = [
    [t("pdf.totalEntries"), String(achievements.length)],
    [t("pdf.goldMedals"), String(achievements.filter(a => a.awardType === "Gold").length)],
    [t("pdf.birthDate"), child.birthDate ? formatDate(child.birthDate) : "—"],
  ];

  stats.forEach(([label, val], i) => {
    const x = M + i * (CW / 3);
    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(130, 120, 110);
    doc.text(label, x, 100);
    setFont(doc, "bold");
    doc.setFontSize(16);
    doc.setTextColor(28, 25, 23);
    doc.text(val, x, 110);
  });

  // Divider
  doc.setDrawColor(220, 215, 210);
  doc.line(M, 120, A4.w - M, 120);

  // Achievements
  let y = 132;
  for (const a of achievements) {
    // Зургийн өндрийг тооцоолно
    const imgs = (a.imageURLs ?? []).map(u => imageCache.get(u)).filter(Boolean) as string[];
    const hasImg = imgs.length > 0;
    const rowH = hasImg ? Math.max(34, 26) : 26;

    if (y > A4.h - rowH - 10) {
      doc.addPage();
      y = M + 10;
    }

    // Текст хэсэг
    const tw = hasImg ? CW - IMG_W - 4 : CW;

    setFont(doc, "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 25, 23);
    doc.text(a.title, M, y, { maxWidth: tw });

    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text(
      `${formatDate(a.date)}  ·  ${a.location}  ·  ${t(`categories.${a.category}`)}  ·  ${t(`awards.${a.awardType}`)}`,
      M, y + 6, { maxWidth: tw }
    );

    if (a.description) {
      doc.setFontSize(9);
      doc.setTextColor(80, 75, 70);
      const lines = doc.splitTextToSize(a.description, tw);
      doc.text(lines.slice(0, 2), M, y + 13);
    }

    // Зураг (байвал баруун талд)
    if (hasImg) {
      const imgX = A4.w - M - IMG_W;
      try {
        doc.addImage(imgs[0], "JPEG", imgX, y - 2, IMG_W, IMG_H, undefined, "FAST");
        // Хоёр дахь зураг байвал доор нэмнэ
        if (imgs[1] && IMG_H + 2 < rowH) {
          doc.addImage(imgs[1], "JPEG", imgX, y - 2 + IMG_H + 1, IMG_W, IMG_H * 0.6, undefined, "FAST");
        }
      } catch { /* зураг алдаа бол алгасана */ }
    }

    doc.setDrawColor(235, 230, 225);
    doc.line(M, y + rowH - 2, A4.w - M, y + rowH - 2);
    y += rowH + 2;
  }

  // Footer
  const total = (doc as jsPDF & { internal: { pages: unknown[] } }).internal.pages.length - 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setFont(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 150, 140);
    doc.text(t("pdf.coverFooter"), M, A4.h - 8);
    doc.text(`${i} / ${total}`, A4.w - M, A4.h - 8, { align: "right" });
  }
}

// =============================================================================
// Template 2: Kids
// =============================================================================

async function renderKids(
  doc: jsPDF,
  child: Child,
  achievements: Achievement[],
  t: (k: string, o?: Record<string, unknown>) => string,
  formatDate: (iso: string) => string,
  imageCache: Map<string, string>
) {
  const IMG_W = 32;
  const IMG_H = 24;

  const colors = {
    Sports:   [59, 130, 246]  as [number, number, number],
    Arts:     [168, 85, 247]  as [number, number, number],
    Academic: [16, 185, 129]  as [number, number, number],
  };
  const awardEmoji: Record<string, string> = {
    Gold: "🥇", Silver: "🥈", Bronze: "🥉", Participant: "🎖",
  };

  doc.setFillColor(255, 247, 237);
  doc.rect(0, 0, A4.w, A4.h, "F");

  doc.setFillColor(251, 191, 36);
  doc.roundedRect(M, M, CW, 40, 5, 5, "F");

  setFont(doc, "bold");
  doc.setFontSize(22);
  doc.setTextColor(120, 53, 15);
  doc.text(`⭐ ${t("pdf.achievementsTitle", { name: child.name })}`, M + 8, M + 16);

  setFont(doc, "normal");
  doc.setFontSize(11);
  doc.setTextColor(146, 64, 14);
  if (child.bio) doc.text(child.bio, M + 8, M + 28, { maxWidth: CW - 16 });

  let y = M + 52;
  for (const a of achievements) {
    const imgs = (a.imageURLs ?? []).map(u => imageCache.get(u)).filter(Boolean) as string[];
    const hasImg = imgs.length > 0;
    const rowH = hasImg ? 42 : 36;

    if (y > A4.h - rowH - 10) {
      doc.addPage();
      doc.setFillColor(255, 247, 237);
      doc.rect(0, 0, A4.w, A4.h, "F");
      y = M;
    }

    const catColor = colors[a.category as keyof typeof colors] ?? [100, 100, 100];
    doc.setFillColor(...catColor);
    doc.setDrawColor(...catColor);
    doc.roundedRect(M, y, CW, rowH, 4, 4, "F");

    const tw = hasImg ? CW - IMG_W - 8 : CW - 10;

    setFont(doc, "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(`${awardEmoji[a.awardType] ?? ""} ${a.title}`, M + 5, y + 10, { maxWidth: tw });

    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text(`${formatDate(a.date)}  ·  ${a.location}  ·  ${t(`awards.${a.awardType}`)}`, M + 5, y + 19, { maxWidth: tw });

    if (a.description) {
      doc.setTextColor(240, 240, 240);
      const lines = doc.splitTextToSize(a.description, tw);
      doc.text(lines[0] ?? "", M + 5, y + 27);
    }

    // Зураг — баруун талд
    if (hasImg) {
      const imgX = M + CW - IMG_W - 2;
      try {
        doc.addImage(imgs[0], "JPEG", imgX, y + 2, IMG_W, IMG_H, undefined, "FAST");
      } catch { /* алгасана */ }
    }

    y += rowH + 4;
  }

  setFont(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 180, 150);
  doc.text(t("pdf.footer"), M, A4.h - 8);
}

// =============================================================================
// Template 3: Gold
// =============================================================================

async function renderGold(
  doc: jsPDF,
  child: Child,
  achievements: Achievement[],
  t: (k: string, o?: Record<string, unknown>) => string,
  formatDate: (iso: string) => string,
  imageCache: Map<string, string>
) {
  const IMG_W = 32;
  const IMG_H = 22;

  doc.setFillColor(15, 12, 10);
  doc.rect(0, 0, A4.w, A4.h, "F");

  doc.setFillColor(180, 130, 40);
  doc.rect(0, 0, A4.w, 3, "F");
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 3, A4.w, 1, "F");

  setFont(doc, "bold");
  doc.setFontSize(9);
  doc.setTextColor(180, 130, 40);
  doc.text("C H A M P S T E P", M, 22);

  setFont(doc, "bold");
  doc.setFontSize(32);
  doc.setTextColor(217, 179, 80);
  doc.text(child.name, M, 70);

  setFont(doc, "normal");
  doc.setFontSize(11);
  doc.setTextColor(140, 120, 90);
  if (child.bio) doc.text(child.bio, M, 82, { maxWidth: CW });

  doc.setFillColor(180, 130, 40);
  doc.rect(M, 92, 40, 0.5, "F");

  const golds = achievements.filter(a => a.awardType === "Gold").length;
  const statsData = [
    [t("pdf.statsTotal"), String(achievements.length)],
    [t("pdf.statsGold"),  String(golds)],
    [t("pdf.statsYear"),  new Date().getFullYear().toString()],
  ];

  statsData.forEach(([label, val], i) => {
    const x = M + i * 55;
    setFont(doc, "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 100, 70);
    doc.text(label, x, 106);
    setFont(doc, "bold");
    doc.setFontSize(20);
    doc.setTextColor(217, 179, 80);
    doc.text(val, x, 118);
  });

  let y = 136;
  for (const a of achievements) {
    const imgs = (a.imageURLs ?? []).map(u => imageCache.get(u)).filter(Boolean) as string[];
    const hasImg = imgs.length > 0;
    const rowH = hasImg ? 30 : 26;

    if (y > A4.h - rowH - 10) {
      doc.addPage();
      doc.setFillColor(15, 12, 10);
      doc.rect(0, 0, A4.w, A4.h, "F");
      doc.setFillColor(180, 130, 40);
      doc.rect(0, 0, A4.w, 3, "F");
      y = 20;
    }

    doc.setFillColor(217, 119, 6);
    doc.rect(M, y - 1, 2, rowH - 4, "F");

    const tw = hasImg ? CW - IMG_W - 8 : CW - 8;

    setFont(doc, "bold");
    doc.setFontSize(11);
    doc.setTextColor(217, 179, 80);
    doc.text(a.title, M + 6, y + 7, { maxWidth: tw });

    setFont(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 100, 70);
    doc.text(
      `${formatDate(a.date)}  ·  ${a.location}  ·  ${t(`awards.${a.awardType}`)}`,
      M + 6, y + 14, { maxWidth: tw }
    );

    // Зураг — баруун талд
    if (hasImg) {
      const imgX = A4.w - M - IMG_W;
      try {
        doc.addImage(imgs[0], "JPEG", imgX, y, IMG_W, IMG_H, undefined, "FAST");
      } catch { /* алгасана */ }
    }

    doc.setDrawColor(40, 35, 25);
    doc.line(M, y + rowH - 2, A4.w - M, y + rowH - 2);
    y += rowH + 2;
  }

  doc.setFillColor(180, 130, 40);
  doc.rect(0, A4.h - 2, A4.w, 2, "F");

  const total = (doc as jsPDF & { internal: { pages: unknown[] } }).internal.pages.length - 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 100, 70);
    doc.text(`${i} / ${total}`, A4.w - M, A4.h - 8, { align: "right" });
  }
}

// -----------------------------------------------------------------------------
// Image helper
// -----------------------------------------------------------------------------

export function urlToDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas error")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}
