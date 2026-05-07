// =============================================================================
// pdfExport v2 — 3 template: official, kids, gold
// Монгол Кирилл фонт: NotoSans (public/NotoSans-Regular.ttf)
// =============================================================================

import { jsPDF } from "jspdf";
import type { Achievement, Child } from "../types";

export type PdfTemplate = "official" | "kids" | "gold";

interface ExportOpts {
  template?: PdfTemplate;
  filename?: string;
  t?: (key: string, opts?: Record<string, unknown>) => string;
}

const A4 = { w: 210, h: 297 };
const M = 18;
const CW = A4.w - M * 2;

// -----------------------------------------------------------------------------
// Фонт cache — bytes хадгална, doc-д дахин нэмнэ
// -----------------------------------------------------------------------------

interface FontCache {
  regular: string | null;
  bold: string | null;
}

const fontCache: FontCache = { regular: null, bold: null };

async function loadFont(doc: jsPDF) {
  // Bytes татаагүй бол татна
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

  // Cache-аас doc-д нэмнэ — doc бүрт заавал хийнэ
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
// Үндсэн export функц
// -----------------------------------------------------------------------------

export async function exportPortfolio(
  child: Child,
  achievements: Achievement[],
  opts: ExportOpts = {}
): Promise<void> {
  const { template = "official", t = (k: string) => k, filename } = opts;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await loadFont(doc);

  if (template === "official") {
    await renderOfficial(doc, child, achievements, t);
  } else if (template === "kids") {
    await renderKids(doc, child, achievements, t);
  } else {
    await renderGold(doc, child, achievements, t);
  }

  const safeName = (filename ?? `${child.name}_ChampStep`).replace(/[^\w.-]+/g, "_");
  doc.save(`${safeName}_${template}.pdf`);
}

// =============================================================================
// Template 1: Албан ёсны (Official)
// =============================================================================

async function renderOfficial(
  doc: jsPDF,
  child: Child,
  achievements: Achievement[],
  t: (k: string, o?: Record<string, unknown>) => string
) {
  doc.setFillColor(28, 25, 23);
  doc.rect(0, 0, A4.w, 32, "F");

  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("CHAMPSTEP", M, 20);

  doc.setFontSize(8);
  doc.setTextColor(160, 150, 140);
  doc.text("Хүүхдийн амжилтын портфолио", A4.w - M, 20, { align: "right" });

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

  const stats = [
    ["Нийт бүртгэл", String(achievements.length)],
    ["Алтан медаль", String(achievements.filter(a => a.awardType === "Gold").length)],
    ["Төрсөн огноо", new Date().toLocaleDateString("mn-MN")],
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

  doc.setDrawColor(220, 215, 210);
  doc.line(M, 120, A4.w - M, 120);

  let y = 132;
  for (let i = 0; i < achievements.length; i++) {
    const a = achievements[i];
    if (y > A4.h - 30) {
      doc.addPage();
      y = M + 10;
    }

    setFont(doc, "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 25, 23);
    doc.text(a.title, M, y);

    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text(`${a.date}  ·  ${a.location}  ·  ${a.category}  ·  ${a.awardType}`, M, y + 6);

    if (a.description) {
      doc.setFontSize(9);
      doc.setTextColor(80, 75, 70);
      const lines = doc.splitTextToSize(a.description, CW - 10);
      doc.text(lines.slice(0, 2), M, y + 13);
    }

    doc.setDrawColor(235, 230, 225);
    doc.line(M, y + 20, A4.w - M, y + 20);
    y += 26;
  }

  addPageNumbers(doc);
}

// =============================================================================
// Template 2: Хүүхэдлэг (Kids)
// =============================================================================

async function renderKids(
  doc: jsPDF,
  child: Child,
  achievements: Achievement[],
  _t: (k: string, o?: Record<string, unknown>) => string
) {
  const colors = {
    Sports: [59, 130, 246] as [number, number, number],
    Arts: [168, 85, 247] as [number, number, number],
    Academic: [16, 185, 129] as [number, number, number],
  };

  const awardEmoji: Record<string, string> = {
    Gold: "🥇", Silver: "🥈", Bronze: "🥉", Participant: "🎖"
  };

  doc.setFillColor(255, 247, 237);
  doc.rect(0, 0, A4.w, A4.h, "F");

  doc.setFillColor(251, 191, 36);
  doc.roundedRect(M, M, CW, 40, 5, 5, "F");

  setFont(doc, "bold");
  doc.setFontSize(22);
  doc.setTextColor(120, 53, 15);
  doc.text(`⭐ ${child.name}-ийн амжилтууд`, M + 8, M + 16);

  setFont(doc, "normal");
  doc.setFontSize(11);
  doc.setTextColor(146, 64, 14);
  if (child.bio) doc.text(child.bio, M + 8, M + 28, { maxWidth: CW - 16 });

  let y = M + 52;
  for (const a of achievements) {
    if (y > A4.h - 50) {
      doc.addPage();
      doc.setFillColor(255, 247, 237);
      doc.rect(0, 0, A4.w, A4.h, "F");
      y = M;
    }

    const catColor = colors[a.category as keyof typeof colors] ?? [100, 100, 100];
    doc.setFillColor(...catColor);
    doc.setDrawColor(...catColor);
    doc.roundedRect(M, y, CW, 36, 4, 4, "F");

    setFont(doc, "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(`${awardEmoji[a.awardType] ?? ""} ${a.title}`, M + 5, y + 11);

    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text(`${a.date}  ·  ${a.location}`, M + 5, y + 20);

    if (a.description) {
      doc.setTextColor(240, 240, 240);
      const lines = doc.splitTextToSize(a.description, CW - 10);
      doc.text(lines[0] ?? "", M + 5, y + 28);
    }

    y += 42;
  }

  doc.setFontSize(8);
  doc.setTextColor(200, 180, 150);
  doc.text("ChampStep · Хүүхдийн өсөлтийн дэвтэр", M, A4.h - 8);
}

// =============================================================================
// Template 3: Алтлаг (Gold/Premium)
// =============================================================================

async function renderGold(
  doc: jsPDF,
  child: Child,
  achievements: Achievement[],
  _t: (k: string, o?: Record<string, unknown>) => string
) {
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
    ["НИЙТ", String(achievements.length)],
    ["АЛТАН", String(golds)],
    ["ОН", new Date().getFullYear().toString()],
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
    if (y > A4.h - 28) {
      doc.addPage();
      doc.setFillColor(15, 12, 10);
      doc.rect(0, 0, A4.w, A4.h, "F");
      doc.setFillColor(180, 130, 40);
      doc.rect(0, 0, A4.w, 3, "F");
      y = 20;
    }

    doc.setFillColor(217, 119, 6);
    doc.rect(M, y - 1, 2, 18, "F");

    setFont(doc, "bold");
    doc.setFontSize(11);
    doc.setTextColor(217, 179, 80);
    doc.text(a.title, M + 6, y + 7);

    setFont(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 100, 70);
    doc.text(`${a.date}  ·  ${a.location}  ·  ${a.awardType}`, M + 6, y + 14);

    doc.setDrawColor(40, 35, 25);
    doc.line(M, y + 20, A4.w - M, y + 20);
    y += 26;
  }

  doc.setFillColor(180, 130, 40);
  doc.rect(0, A4.h - 2, A4.w, 2, "F");

  addPageNumbers(doc, true);
}

// -----------------------------------------------------------------------------
// Page numbers
// -----------------------------------------------------------------------------

function addPageNumbers(doc: jsPDF, dark = false) {
  const total = (doc as jsPDF & { internal: { pages: unknown[] } }).internal.pages.length - 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(dark ? 120 : 160, dark ? 100 : 150, dark ? 70 : 140);
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
