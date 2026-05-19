// =============================================================================
// pdfExport v6 — 4 template: official, kids, gold, portfolio (resume-style)
// Монгол+Англи хэл, NotoSans фонт, зурагтай
// =============================================================================

import { jsPDF } from "jspdf";
import type { Achievement, Child } from "../types";

export type PdfTemplate = "official" | "kids" | "gold" | "portfolio";

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

const fontCache: { regular: string | null; bold: string | null } = {
  regular: null,
  bold: null,
};

async function loadFont(doc: jsPDF) {
  if (!fontCache.regular || !fontCache.bold) {
    try {
      const [regRes, boldRes] = await Promise.all([
        fetch("/NotoSans-Regular.ttf"),
        fetch("/NotoSans-Bold.ttf"),
      ]);
      if (!regRes.ok || !boldRes.ok) throw new Error("Font fetch failed");
      const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);
      const toBase64 = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        const CHUNK = 8192;
        for (let i = 0; i < bytes.byteLength; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        return btoa(binary);
      };
      fontCache.regular = toBase64(regBuf);
      fontCache.bold = toBase64(boldBuf);
    } catch (e) {
      console.warn("[champstep] NotoSans font load error:", e);
      return;
    }
  }
  try {
    doc.addFileToVFS("NotoSans-Regular.ttf", fontCache.regular!);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFileToVFS("NotoSans-Bold.ttf", fontCache.bold!);
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  } catch (e) {
    console.warn("[champstep] Font add error:", e);
  }
}

function setFont(doc: jsPDF, weight: "normal" | "bold" = "normal") {
  const fontList = doc.getFontList();
  doc.setFont(fontList["NotoSans"] ? "NotoSans" : "helvetica", weight);
}

// -----------------------------------------------------------------------------
// Image helper
// -----------------------------------------------------------------------------

export async function urlToDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  } catch {
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
}

// -----------------------------------------------------------------------------
// Үндсэн export функц
// -----------------------------------------------------------------------------

export async function exportPortfolio(
  child: Child,
  achievements: Achievement[],
  opts: ExportOpts = {}
): Promise<void> {
  const {
    template = "official",
    t = (k: string) => k,
    filename,
    includeImages = true,
  } = opts;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await loadFont(doc);

  if (template === "official") {
    await renderOfficial(doc, child, achievements, t, includeImages);
  } else if (template === "kids") {
    await renderKids(doc, child, achievements, t, includeImages);
  } else if (template === "gold") {
    await renderGold(doc, child, achievements, t, includeImages);
  } else {
    await renderPortfolio(doc, child, achievements, t, includeImages);
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
  includeImages = true
) {
  doc.setFillColor(28, 25, 23);
  doc.rect(0, 0, A4.w, 32, "F");

  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("CHAMPSTEP", M, 20);

  doc.setFontSize(8);
  doc.setTextColor(160, 150, 140);
  doc.text(t("pdf.subtitle"), A4.w - M, 20, { align: "right" });

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
    [t("pdf.totalEntries"), String(achievements.length)],
    [t("pdf.goldMedals"), String(achievements.filter(a => a.awardType === "Gold").length)],
    [t("pdf.birthDate"), child.birthDate || "—"],
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
  for (const a of achievements) {
    const imgH = includeImages && a.imageURLs?.length ? 45 : 0;
    const blockH = 28 + imgH;

    if (y + blockH > A4.h - 20) {
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
    doc.text(
      `${a.date}  ·  ${a.location}  ·  ${t(`categories.${a.category}`)}  ·  ${t(`awards.${a.awardType}`)}`,
      M, y + 6
    );

    if (a.description) {
      doc.setFontSize(9);
      doc.setTextColor(80, 75, 70);
      const lines = doc.splitTextToSize(a.description, CW - 10);
      doc.text(lines.slice(0, 2), M, y + 13);
    }

    if (includeImages && a.imageURLs?.length) {
      try {
        const dataUrl = await urlToDataUrl(a.imageURLs[0]);
        doc.addImage(dataUrl, "JPEG", M, y + 20, 55, 40);
      } catch { /* алгасна */ }
    }

    doc.setDrawColor(235, 230, 225);
    doc.line(M, y + blockH, A4.w - M, y + blockH);
    y += blockH + 6;
  }

  addFooters(doc, t("pdf.coverFooter"));
}

// =============================================================================
// Template 2: Kids
// =============================================================================

async function renderKids(
  doc: jsPDF,
  child: Child,
  achievements: Achievement[],
  t: (k: string, o?: Record<string, unknown>) => string,
  includeImages = true
) {
  const colors = {
    Sports: [59, 130, 246] as [number, number, number],
    Arts: [168, 85, 247] as [number, number, number],
    Academic: [16, 185, 129] as [number, number, number],
  };

  doc.setFillColor(255, 247, 237);
  doc.rect(0, 0, A4.w, A4.h, "F");
  doc.setFillColor(251, 191, 36);
  doc.roundedRect(M, M, CW, 40, 5, 5, "F");

  setFont(doc, "bold");
  doc.setFontSize(22);
  doc.setTextColor(120, 53, 15);
  doc.text(t("pdf.achievementsTitle", { name: child.name }), M + 8, M + 16);

  setFont(doc, "normal");
  doc.setFontSize(11);
  doc.setTextColor(146, 64, 14);
  if (child.bio) doc.text(child.bio, M + 8, M + 28, { maxWidth: CW - 16 });

  let y = M + 52;
  for (const a of achievements) {
    const imgH = includeImages && a.imageURLs?.length ? 45 : 0;
    const blockH = 42 + imgH;

    if (y + blockH > A4.h - 20) {
      doc.addPage();
      doc.setFillColor(255, 247, 237);
      doc.rect(0, 0, A4.w, A4.h, "F");
      y = M;
    }

    const catColor = colors[a.category as keyof typeof colors] ?? [100, 100, 100];
    doc.setFillColor(...catColor);
    doc.roundedRect(M, y, CW, 36, 4, 4, "F");

    setFont(doc, "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(a.title, M + 5, y + 11);

    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text(`${a.date}  ·  ${a.location}  ·  ${t(`awards.${a.awardType}`)}`, M + 5, y + 20);

    if (a.description) {
      doc.setTextColor(240, 240, 240);
      const lines = doc.splitTextToSize(a.description, CW - 10);
      doc.text(lines[0] ?? "", M + 5, y + 28);
    }

    if (includeImages && a.imageURLs?.length) {
      try {
        const dataUrl = await urlToDataUrl(a.imageURLs[0]);
        doc.addImage(dataUrl, "JPEG", M, y + 38, 55, 40);
      } catch { /* алгасна */ }
    }

    y += blockH + 6;
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
  includeImages = true
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
    [t("pdf.statsTotal"), String(achievements.length)],
    [t("pdf.statsGold"), String(golds)],
    [t("pdf.statsYear"), new Date().getFullYear().toString()],
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
    const imgH = includeImages && a.imageURLs?.length ? 45 : 0;
    const blockH = 28 + imgH;

    if (y + blockH > A4.h - 20) {
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
    doc.text(
      `${a.date}  ·  ${a.location}  ·  ${t(`awards.${a.awardType}`)}`,
      M + 6, y + 14
    );

    if (includeImages && a.imageURLs?.length) {
      try {
        const dataUrl = await urlToDataUrl(a.imageURLs[0]);
        doc.addImage(dataUrl, "JPEG", M + 6, y + 20, 55, 40);
      } catch { /* алгасна */ }
    }

    doc.setDrawColor(40, 35, 25);
    doc.line(M, y + blockH, A4.w - M, y + blockH);
    y += blockH + 6;
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

// =============================================================================
// Template 4: Portfolio — Resume-style (Navy sidebar + clean content)
//
// Layout:
//   [62mm sidebar: нэр, дугуй avatar initial, stats, ангилал bar]
//   [130mm content: амжилт бүр — dot + title + date + meta + description + зураг]
//
// Өнгөний схем:
//   Sidebar: navy (#1E2846), steel blue accent, gold stripe
//   Content: цагаан дэвсгэр, navy гарчиг, category-өнгийн dot
// =============================================================================

async function renderPortfolio(
  doc: jsPDF,
  child: Child,
  achievements: Achievement[],
  t: (k: string, o?: Record<string, unknown>) => string,
  includeImages = true
) {
  // ---- Тогтмолууд ----
  const SIDEBAR_W = 62;
  const CONTENT_X = SIDEBAR_W + 9;
  const CONTENT_W = A4.w - CONTENT_X - 8;

  // Өнгөнүүд
  const NAVY: [number, number, number] = [22, 32, 60];
  const STEEL: [number, number, number] = [65, 115, 165];
  const GOLD: [number, number, number] = [212, 160, 23];
  const WHITE: [number, number, number] = [255, 255, 255];
  const MUTED: [number, number, number] = [155, 170, 195];
  const DARK: [number, number, number] = [30, 42, 75];

  const awardColor: Record<string, [number, number, number]> = {
    Gold: [212, 175, 55],
    Silver: [160, 160, 165],
    Bronze: [176, 141, 87],
    Participant: [100, 130, 160],
  };
  const catColor: Record<string, [number, number, number]> = {
    Sports: [59, 130, 246],
    Arts: [168, 85, 247],
    Academic: [16, 185, 129],
  };

  // Stats
  const golds = achievements.filter(a => a.awardType === "Gold").length;
  const silvers = achievements.filter(a => a.awardType === "Silver").length;
  const bronzes = achievements.filter(a => a.awardType === "Bronze").length;
  const cats = {
    Sports: achievements.filter(a => a.category === "Sports").length,
    Arts: achievements.filter(a => a.category === "Arts").length,
    Academic: achievements.filter(a => a.category === "Academic").length,
  };
  const maxCat = Math.max(cats.Sports, cats.Arts, cats.Academic, 1);

  // ---- Sidebar зурах функц ----
  function drawSidebar(pageIdx: number) {
    const cx = SIDEBAR_W / 2;

    // Background
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, SIDEBAR_W, A4.h, "F");

    // Right accent strip
    doc.setFillColor(...STEEL);
    doc.rect(SIDEBAR_W - 2.5, 0, 2.5, A4.h, "F");

    // Gold top stripe
    doc.setFillColor(...GOLD);
    doc.rect(0, 0, SIDEBAR_W, 3.5, "F");

    // Logo text
    setFont(doc, "bold");
    doc.setFontSize(6);
    doc.setTextColor(...GOLD);
    doc.text("CHAMPSTEP", cx, 9, { align: "center" });

    if (pageIdx === 1) {
      // Avatar дугуй
      doc.setFillColor(...DARK);
      doc.circle(cx, 38, 20, "F");
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.7);
      doc.circle(cx, 38, 20, "S");

      // Эхний үсэг
      const initial = (child.name || "?")[0].toUpperCase();
      setFont(doc, "bold");
      doc.setFontSize(20);
      doc.setTextColor(...WHITE);
      doc.text(initial, cx, 43, { align: "center" });

      let sy = 63;

      // Нэр
      setFont(doc, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...WHITE);
      const nameLines = doc.splitTextToSize(child.name, SIDEBAR_W - 10);
      doc.text(nameLines, cx, sy, { align: "center" });
      sy += nameLines.length * 6.5 + 2;

      // Bio
      if (child.bio) {
        setFont(doc, "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        const bioLines = doc.splitTextToSize(child.bio, SIDEBAR_W - 10);
        doc.text(bioLines.slice(0, 3), cx, sy, { align: "center" });
        sy += Math.min(bioLines.length, 3) * 4.5 + 3;
      }

      // Divider
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.25);
      doc.line(7, sy, SIDEBAR_W - 7, sy);
      sy += 6;

      // Статистик гарчиг
      setFont(doc, "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...GOLD);
      doc.text(t("pdf.statsTotal").toUpperCase(), 7, sy);
      sy += 5;

      // Stat мөрүүд
      const statRows: Array<[string, string, [number,number,number]]> = [
        [t("pdf.totalEntries"), String(achievements.length), WHITE],
        [t("pdf.goldMedals"), String(golds), [212, 175, 55]],
        ["Silver", String(silvers), [192, 192, 200]],
        ["Bronze", String(bronzes), [176, 141, 87]],
      ];

      for (const [label, val, color] of statRows) {
        setFont(doc, "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(label, 7, sy);
        setFont(doc, "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...color);
        doc.text(val, SIDEBAR_W - 6, sy, { align: "right" });
        sy += 5.5;
      }

      sy += 3;
      doc.setDrawColor(38, 52, 90);
      doc.line(7, sy, SIDEBAR_W - 7, sy);
      sy += 6;

      // Ангилал гарчиг
      setFont(doc, "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...GOLD);
      doc.text(t("categories.All").toUpperCase(), 7, sy);
      sy += 5;

      // Category bars
      const catRows: Array<[string, number, [number,number,number]]> = [
        [t("categories.Sports"), cats.Sports, catColor.Sports],
        [t("categories.Arts"), cats.Arts, catColor.Arts],
        [t("categories.Academic"), cats.Academic, catColor.Academic],
      ];

      for (const [label, count, color] of catRows) {
        const barW = SIDEBAR_W - 18;
        const fillW = (count / maxCat) * barW;

        // Background bar
        doc.setFillColor(30, 44, 80);
        doc.roundedRect(7, sy - 1.5, barW, 3.5, 1, 1, "F");

        // Fill bar
        if (fillW > 0) {
          doc.setFillColor(...color);
          doc.roundedRect(7, sy - 1.5, fillW, 3.5, 1, 1, "F");
        }

        setFont(doc, "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text(label, 7, sy + 5);
        doc.setTextColor(...color);
        doc.text(String(count), SIDEBAR_W - 6, sy + 5, { align: "right" });
        sy += 10;
      }

      // Төрсөн огноо
      if (child.birthDate) {
        sy += 2;
        doc.setDrawColor(38, 52, 90);
        doc.line(7, sy, SIDEBAR_W - 7, sy);
        sy += 6;

        setFont(doc, "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...GOLD);
        doc.text(t("pdf.birthDate").toUpperCase(), 7, sy);
        sy += 5;

        setFont(doc, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(200, 215, 235);
        doc.text(child.birthDate, 7, sy);
      }
    } else {
      // 2+ хуудас: бяцхан sidebar
      setFont(doc, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...WHITE);
      const nameLines = doc.splitTextToSize(child.name, SIDEBAR_W - 10);
      doc.text(nameLines, cx, 22, { align: "center" });

      // Page number
      setFont(doc, "normal");
      doc.setFontSize(7);
      doc.setTextColor(80, 100, 140);
      doc.text(String(pageIdx), cx, A4.h - 10, { align: "center" });
    }

    // Footer
    setFont(doc, "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(55, 72, 110);
    doc.text(t("pdf.coverFooter"), cx, A4.h - 4, { align: "center" });
  }

  // ---- Content хэсгийн амжилт зурах ----
  function achievementBlockH(a: typeof achievements[0], withImg: boolean): number {
    const descH = a.description ? 9 : 0;
    const imgH = withImg && a.imageURLs?.length ? 34 : 0;
    return 5 + 6 + descH + imgH + 5;
  }

  // ---- Эхний хуудас ----
  let pageIdx = 1;
  drawSidebar(pageIdx);

  // Content header
  let y = 13;
  setFont(doc, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(t("pdf.achievementsTitle", { name: child.name }), CONTENT_X, y + 8);
  y += 12;

  setFont(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...STEEL);
  doc.text(t("pdf.subtitle"), CONTENT_X, y);
  y += 3;

  // Gold divider
  doc.setFillColor(...GOLD);
  doc.rect(CONTENT_X, y, CONTENT_W, 0.8, "F");
  y += 6;

  // ---- Амжилтуудын жагсаалт ----
  for (const a of achievements) {
    const blockH = achievementBlockH(a, includeImages);

    if (y + blockH > A4.h - 10) {
      doc.addPage();
      pageIdx++;
      drawSidebar(pageIdx);
      y = 14;
    }

    // Award dot
    const dotC = awardColor[a.awardType] ?? [150, 150, 150];
    doc.setFillColor(...dotC);
    doc.circle(CONTENT_X + 2.5, y + 3, 2.5, "F");

    // Гарчиг
    setFont(doc, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    const titleLines = doc.splitTextToSize(a.title, CONTENT_W - 25);
    doc.text(titleLines[0], CONTENT_X + 7, y + 4.5);

    // Огноо (баруун тал)
    setFont(doc, "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 155);
    doc.text(a.date, A4.w - 8, y + 4.5, { align: "right" });

    y += 6;

    // Category mini dot + meta
    const catC = catColor[a.category] ?? [130, 130, 130];
    doc.setFillColor(...catC);
    doc.circle(CONTENT_X + 8, y + 1, 1.5, "F");

    setFont(doc, "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 115, 140);
    doc.text(
      `${a.location}  ·  ${t(`categories.${a.category}`)}  ·  ${t(`awards.${a.awardType}`)}`,
      CONTENT_X + 11, y + 2
    );
    y += 5;

    // Тайлбар
    if (a.description) {
      setFont(doc, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(65, 80, 105);
      const descLines = doc.splitTextToSize(a.description, CONTENT_W - 8);
      doc.text(descLines.slice(0, 2), CONTENT_X + 7, y + 3);
      y += descLines.slice(0, 2).length * 4 + 1;
    }

    // Зураг
    if (includeImages && a.imageURLs?.length) {
      try {
        const dataUrl = await urlToDataUrl(a.imageURLs[0]);
        doc.addImage(dataUrl, "JPEG", CONTENT_X + 7, y + 1, 42, 30, undefined, "FAST");
        y += 33;
      } catch { /* алгасна */ }
    }

    // Хуваагч
    doc.setDrawColor(215, 220, 232);
    doc.setLineWidth(0.25);
    doc.line(CONTENT_X + 5, y + 2, A4.w - 8, y + 2);
    y += 6;
  }
}

// -----------------------------------------------------------------------------
// Бүх хуудасны footer + page number
// -----------------------------------------------------------------------------

function addFooters(doc: jsPDF, footerText: string) {
  const total = (doc as jsPDF & { internal: { pages: unknown[] } }).internal.pages.length - 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setFont(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 150, 140);
    doc.text(footerText, M, A4.h - 8);
    doc.text(`${i} / ${total}`, A4.w - M, A4.h - 8, { align: "right" });
  }
}
