// =============================================================================
// pdfExport v6 — 4 template: official, kids, gold, portfolio (resume-style)
// Монгол+Англи хэл, NotoSans фонт, зурагтай
// =============================================================================
import { jsPDF } from "jspdf";
const A4 = { w: 210, h: 297 };
const M = 18;
const CW = A4.w - M * 2;
// -----------------------------------------------------------------------------
// Font cache
// -----------------------------------------------------------------------------
const fontCache = {
    regular: null,
    bold: null,
};
async function loadFont(doc) {
    if (!fontCache.regular || !fontCache.bold) {
        try {
            const [regRes, boldRes] = await Promise.all([
                fetch("/NotoSans-Regular.ttf"),
                fetch("/NotoSans-Bold.ttf"),
            ]);
            if (!regRes.ok || !boldRes.ok)
                throw new Error("Font fetch failed");
            const [regBuf, boldBuf] = await Promise.all([
                regRes.arrayBuffer(),
                boldRes.arrayBuffer(),
            ]);
            const toBase64 = (buf) => {
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
        }
        catch (e) {
            console.warn("[champstep] NotoSans font load error:", e);
            return;
        }
    }
    try {
        doc.addFileToVFS("NotoSans-Regular.ttf", fontCache.regular);
        doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
        doc.addFileToVFS("NotoSans-Bold.ttf", fontCache.bold);
        doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
    }
    catch (e) {
        console.warn("[champstep] Font add error:", e);
    }
}
function drawImagePlaceholder(doc, x, y, w, h) {
    doc.setFillColor(238, 236, 233);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(180, 170, 160);
    doc.text("[ image ]", x + w / 2, y + h / 2 + 2, { align: "center" });
}
// Crop an image dataURL into a circle (transparent corners) via offscreen canvas.
// Cover-fits + centers the source so non-square photos aren't distorted. Returns PNG.
async function circleCropDataUrl(dataUrl, sizePx = 320) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = sizePx;
                canvas.height = sizePx;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(dataUrl);
                    return;
                }
                ctx.beginPath();
                ctx.arc(sizePx / 2, sizePx / 2, sizePx / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                const scale = Math.max(sizePx / img.width, sizePx / img.height);
                const dw = img.width * scale;
                const dh = img.height * scale;
                ctx.drawImage(img, (sizePx - dw) / 2, (sizePx - dh) / 2, dw, dh);
                resolve(canvas.toDataURL("image/png"));
            }
            catch {
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}
// Draw a circular avatar: photo if available, amber initial circle otherwise.
// cx/cy = center in mm, r = radius in mm.
async function drawAvatar(doc, child, cx, cy, r, opts = {
    bgR: 217, bgG: 119, bgB: 6, textR: 255, textG: 255, textB: 255,
}) {
    const d = r * 2;
    if (child.avatarUrl) {
        const dataUrl = await urlToDataUrl(child.avatarUrl);
        if (dataUrl) {
            // Pre-crop the photo into a circle on an offscreen canvas (cover-fit, centered),
            // then place it — gives a true circular avatar with no square corners.
            try {
                const circular = await circleCropDataUrl(dataUrl, 320);
                doc.addImage(circular, "PNG", cx - r, cy - r, d, d);
                return;
            }
            catch { /* fall through to initial */ }
        }
    }
    // Initial circle fallback
    doc.setFillColor(opts.bgR, opts.bgG, opts.bgB);
    doc.circle(cx, cy, r, "F");
    const initial = (child.name || "?")[0].toUpperCase();
    setFont(doc, "bold");
    doc.setFontSize(r * 4);
    doc.setTextColor(opts.textR, opts.textG, opts.textB);
    doc.text(initial, cx, cy + r * 1.3, { align: "center" });
}
function setFont(doc, weight = "normal") {
    const fontList = doc.getFontList();
    doc.setFont(fontList["NotoSans"] ? "NotoSans" : "helvetica", weight);
}
// -----------------------------------------------------------------------------
// Image helper
// -----------------------------------------------------------------------------
const MAX_IMG_PX = 900;
const IMG_QUALITY = 0.82;
function compressImgElement(img) {
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > MAX_IMG_PX) {
        h = Math.round((h * MAX_IMG_PX) / w);
        w = MAX_IMG_PX;
    }
    if (h > MAX_IMG_PX) {
        w = Math.round((w * MAX_IMG_PX) / h);
        h = MAX_IMG_PX;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("canvas error");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", IMG_QUALITY);
}
export async function urlToDataUrl(url) {
    if (url.startsWith("data:"))
        return url;
    // Blob URLs are same-origin — load directly, no crossOrigin needed
    if (url.startsWith("blob:")) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    resolve(compressImgElement(img));
                }
                catch {
                    console.warn("[champstep] blob compress failed:", url);
                    resolve("");
                }
            };
            img.onerror = () => { console.warn("[champstep] blob load failed:", url); resolve(""); };
            img.src = url;
        });
    }
    // HTTP/HTTPS — try fetch+blob first to sidestep CORS canvas taint
    try {
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok)
            throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                try {
                    resolve(compressImgElement(img));
                }
                catch {
                    resolve("");
                }
            };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(""); };
            img.src = objectUrl;
        });
    }
    catch {
        // Fallback: direct load with crossOrigin="anonymous" (works if server sends CORS headers)
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                try {
                    resolve(compressImgElement(img));
                }
                catch {
                    console.warn("[champstep] crossOrigin compress failed:", url);
                    resolve("");
                }
            };
            img.onerror = () => { console.warn("[champstep] image load failed (CORS?):", url); resolve(""); };
            img.src = url;
        });
    }
}
// -----------------------------------------------------------------------------
// Үндсэн export функц
// -----------------------------------------------------------------------------
export async function exportPortfolio(child, achievements, opts = {}) {
    const { template = "official", t = (k) => k, filename, includeImages = true, output = "save", } = opts;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    await loadFont(doc);
    if (template === "official") {
        await renderOfficial(doc, child, achievements, t, includeImages);
    }
    else if (template === "gold") {
        await renderGold(doc, child, achievements, t, includeImages);
    }
    else if (template === "framed") {
        await renderFramed(doc, child, achievements, t, includeImages);
    }
    else {
        await renderPortfolio(doc, child, achievements, t, includeImages);
    }
    const safeName = (filename ?? `${child.name}_ChampStep`).replace(/[^\w.-]+/g, "_");
    if (output === "bloburl") {
        // Preview-д зориулсан object URL. Дуудсан тал URL.revokeObjectURL()-ээр цэвэрлэнэ.
        return URL.createObjectURL(doc.output("blob"));
    }
    doc.save(`${safeName}_${template}.pdf`);
}
// =============================================================================
// Template 1: Official
// =============================================================================
// Бичлэг бүрт 3 хүртэл зургийг эгнээгээр харуулна
async function drawImageRow(doc, urls, x, y) {
    const imgs = urls.slice(0, 3);
    const n = imgs.length;
    if (n === 0)
        return;
    const dims = n === 1 ? { w: 55, h: 40, gap: 0 } :
        n === 2 ? { w: 50, h: 37, gap: 5 } :
            { w: 40, h: 30, gap: 4 };
    for (let i = 0; i < n; i++) {
        const ix = x + i * (dims.w + dims.gap);
        try {
            const dataUrl = await urlToDataUrl(imgs[i]);
            doc.addImage(dataUrl, "JPEG", ix, y, dims.w, dims.h);
        }
        catch {
            drawImagePlaceholder(doc, ix, y, dims.w, dims.h);
        }
    }
}
async function renderOfficial(doc, child, achievements, t, includeImages = true) {
    doc.setFillColor(28, 25, 23);
    doc.rect(0, 0, A4.w, 32, "F");
    setFont(doc, "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("CHAMPSTEP", M, 20);
    doc.setFontSize(8);
    doc.setTextColor(160, 150, 140);
    doc.text(t("pdf.subtitle"), A4.w - M, 20, { align: "right" });
    // Avatar circle (28mm diameter = 14mm radius), centered vertically in hero area
    const avatarCX = M + 14;
    const avatarCY = 56;
    const avatarR = 14;
    await drawAvatar(doc, child, avatarCX, avatarCY, avatarR, { bgR: 217, bgG: 119, bgB: 6, textR: 255, textG: 255, textB: 255 });
    const textX = M + 14 * 2 + 5; // right of avatar
    setFont(doc, "bold");
    doc.setFontSize(22);
    doc.setTextColor(28, 25, 23);
    doc.text(child.name, textX, 50);
    if (child.bio) {
        setFont(doc, "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 95, 90);
        doc.text(child.bio, textX, 60, { maxWidth: CW - 14 * 2 - 5 });
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
        doc.text(label, x, 82);
        setFont(doc, "bold");
        doc.setFontSize(16);
        doc.setTextColor(28, 25, 23);
        doc.text(val, x, 92);
    });
    doc.setDrawColor(220, 215, 210);
    doc.line(M, 102, A4.w - M, 102);
    let y = 114;
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
        doc.text(`${a.date}  ·  ${a.location}  ·  ${t(`categories.${a.category}`)}  ·  ${t(`awards.${a.awardType}`)}`, M, y + 6);
        if (a.description) {
            doc.setFontSize(9);
            doc.setTextColor(80, 75, 70);
            const lines = doc.splitTextToSize(a.description, CW - 10);
            doc.text(lines.slice(0, 2), M, y + 13);
        }
        if (includeImages && a.imageURLs?.length) {
            await drawImageRow(doc, a.imageURLs, M, y + 20);
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
async function renderKids(doc, child, achievements, t, includeImages = true) {
    const colors = {
        Sports: [59, 130, 246],
        Arts: [168, 85, 247],
        Academic: [16, 185, 129],
    };
    doc.setFillColor(255, 247, 237);
    doc.rect(0, 0, A4.w, A4.h, "F");
    doc.setFillColor(251, 191, 36);
    doc.roundedRect(M, M, CW, 44, 5, 5, "F");
    // Avatar circle inside banner
    const kAvatarR = 14;
    const kAvatarCX = M + CW - kAvatarR - 4;
    const kAvatarCY = M + 22;
    await drawAvatar(doc, child, kAvatarCX, kAvatarCY, kAvatarR, { bgR: 120, bgG: 53, bgB: 15, textR: 255, textG: 247, textB: 237 });
    setFont(doc, "bold");
    doc.setFontSize(19);
    doc.setTextColor(120, 53, 15);
    doc.text(t("pdf.achievementsTitle", { name: child.name }), M + 8, M + 16, { maxWidth: CW - kAvatarR * 2 - 10 });
    setFont(doc, "normal");
    doc.setFontSize(10);
    doc.setTextColor(146, 64, 14);
    if (child.bio)
        doc.text(child.bio, M + 8, M + 30, { maxWidth: CW - kAvatarR * 2 - 10 });
    let y = M + 56;
    for (const a of achievements) {
        const imgH = includeImages && a.imageURLs?.length ? 45 : 0;
        const blockH = 42 + imgH;
        if (y + blockH > A4.h - 20) {
            doc.addPage();
            doc.setFillColor(255, 247, 237);
            doc.rect(0, 0, A4.w, A4.h, "F");
            y = M;
        }
        const catColor = colors[a.category] ?? [100, 100, 100];
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
            await drawImageRow(doc, a.imageURLs, M, y + 38);
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
async function renderGold(doc, child, achievements, t, includeImages = true) {
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
    // Avatar circle (gold template: dark background)
    const gAvatarR = 14;
    const gAvatarCX = A4.w - M - gAvatarR;
    const gAvatarCY = 35;
    await drawAvatar(doc, child, gAvatarCX, gAvatarCY, gAvatarR, { bgR: 40, bgG: 32, bgB: 15, textR: 217, textG: 179, textB: 80 });
    setFont(doc, "bold");
    doc.setFontSize(28);
    doc.setTextColor(217, 179, 80);
    doc.text(child.name, M, 60);
    setFont(doc, "normal");
    doc.setFontSize(11);
    doc.setTextColor(140, 120, 90);
    if (child.bio)
        doc.text(child.bio, M, 70, { maxWidth: CW - gAvatarR * 2 - 8 });
    doc.setFillColor(180, 130, 40);
    doc.rect(M, 80, 40, 0.5, "F");
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
        doc.text(label, x, 94);
        setFont(doc, "bold");
        doc.setFontSize(20);
        doc.setTextColor(217, 179, 80);
        doc.text(val, x, 106);
    });
    let y = 122;
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
        doc.text(`${a.date}  ·  ${a.location}  ·  ${t(`awards.${a.awardType}`)}`, M + 6, y + 14);
        if (includeImages && a.imageURLs?.length) {
            await drawImageRow(doc, a.imageURLs, M + 6, y + 20);
        }
        doc.setDrawColor(40, 35, 25);
        doc.line(M, y + blockH, A4.w - M, y + blockH);
        y += blockH + 6;
    }
    doc.setFillColor(180, 130, 40);
    doc.rect(0, A4.h - 2, A4.w, 2, "F");
    const total = doc.internal.pages.length - 1;
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
async function renderPortfolio(doc, child, achievements, t, includeImages = true) {
    // ---- Тогтмолууд ----
    const SIDEBAR_W = 62;
    const CONTENT_X = SIDEBAR_W + 9;
    const CONTENT_W = A4.w - CONTENT_X - 8;
    // Өнгөнүүд
    const NAVY = [22, 32, 60];
    const STEEL = [65, 115, 165];
    const GOLD = [212, 160, 23];
    const WHITE = [255, 255, 255];
    const MUTED = [155, 170, 195];
    const DARK = [30, 42, 75];
    const awardColor = {
        Gold: [212, 175, 55],
        Silver: [160, 160, 165],
        Bronze: [176, 141, 87],
        Participant: [100, 130, 160],
    };
    const catColor = {
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
    async function drawSidebar(pageIdx) {
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
            // Avatar circle — photo or initial
            await drawAvatar(doc, child, cx, 38, 20, { bgR: DARK[0], bgG: DARK[1], bgB: DARK[2], textR: WHITE[0], textG: WHITE[1], textB: WHITE[2] });
            // Gold border ring over avatar
            doc.setDrawColor(...GOLD);
            doc.setLineWidth(0.7);
            doc.circle(cx, 38, 20, "S");
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
            const statRows = [
                [t("pdf.totalEntries"), String(achievements.length), WHITE],
                [t("pdf.goldMedals"), String(golds), [212, 175, 55]],
                [t("awards.Silver"), String(silvers), [192, 192, 200]],
                [t("awards.Bronze"), String(bronzes), [176, 141, 87]],
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
            const catRows = [
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
        }
        else {
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
    function achievementBlockH(a, withImg) {
        const descH = a.description ? 9 : 0;
        const imgH = withImg && a.imageURLs?.length ? 34 : 0;
        return 5 + 6 + descH + imgH + 5;
    }
    // ---- Эхний хуудас ----
    let pageIdx = 1;
    await drawSidebar(pageIdx);
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
            await drawSidebar(pageIdx);
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
        doc.text(`${a.location}  ·  ${t(`categories.${a.category}`)}  ·  ${t(`awards.${a.awardType}`)}`, CONTENT_X + 11, y + 2);
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
            }
            catch {
                drawImagePlaceholder(doc, CONTENT_X + 7, y + 1, 42, 30);
                y += 33;
            }
        }
        // Хуваагч
        doc.setDrawColor(215, 220, 232);
        doc.setLineWidth(0.25);
        doc.line(CONTENT_X + 5, y + 2, A4.w - 8, y + 2);
        y += 6;
    }
}
const FRAME_THEMES = {
    Arts: { accent: [186, 117, 23], kind: "arts" },
    Sports: { accent: [24, 95, 165], kind: "sports" },
    Academic: { accent: [59, 109, 17], kind: "academic" },
};
function dominantCategory(achievements) {
    const counts = { Arts: 0, Sports: 0, Academic: 0 };
    achievements.forEach((a) => { if (counts[a.category] !== undefined)
        counts[a.category]++; });
    let best = "Arts";
    let max = -1;
    ["Arts", "Sports", "Academic"].forEach((c) => { if (counts[c] > max) {
        max = counts[c];
        best = c;
    } });
    return best;
}
function drawFrameBorder(doc, a) {
    doc.setDrawColor(a[0], a[1], a[2]);
    doc.setLineWidth(0.5);
    doc.rect(8, 8, A4.w - 16, A4.h - 16);
    doc.setLineWidth(0.2);
    doc.rect(10, 10, A4.w - 20, A4.h - 20);
    const L = 6, m = 12;
    doc.setLineWidth(0.5);
    const corners = [
        [m, m, 1, 1], [A4.w - m, m, -1, 1], [m, A4.h - m, 1, -1], [A4.w - m, A4.h - m, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
        doc.line(cx, cy, cx + dx * L, cy);
        doc.line(cx, cy, cx, cy + dy * L);
    }
    doc.setFillColor(a[0], a[1], a[2]);
    const dots = [[m, m], [A4.w - m, m], [m, A4.h - m], [A4.w - m, A4.h - m]];
    for (const [cx, cy] of dots)
        doc.circle(cx, cy, 0.8, "F");
}
function drawSeal(doc, cx, cy, a, kind) {
    doc.setDrawColor(a[0], a[1], a[2]);
    doc.setLineWidth(0.4);
    doc.circle(cx, cy, 5.6, "S");
    doc.setLineWidth(0.22);
    doc.circle(cx, cy, 6.6, "S");
    if (kind === "arts") {
        doc.setFillColor(a[0], a[1], a[2]);
        doc.ellipse(cx - 1.1, cy + 1.5, 1.3, 0.9, "F");
        doc.setLineWidth(0.5);
        doc.line(cx + 0.15, cy + 1.5, cx + 0.15, cy - 2.6);
        doc.line(cx + 0.15, cy - 2.6, cx + 1.8, cy - 1.5);
    }
    else if (kind === "sports") {
        const ro = 3, ri = 1.25;
        const pts = [];
        for (let i = 0; i < 10; i++) {
            const ang = -Math.PI / 2 + (i * Math.PI) / 5;
            const r = i % 2 === 0 ? ro : ri;
            pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
        }
        const dl = [];
        for (let i = 1; i < pts.length; i++)
            dl.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
        doc.setFillColor(a[0], a[1], a[2]);
        doc.lines(dl, pts[0][0], pts[0][1], [1, 1], "F", true);
    }
    else {
        doc.setLineWidth(0.45);
        doc.line(cx, cy - 2.6, cx, cy + 2.4);
        doc.lines([[-4, 1], [0, 3.6], [4, -1.4]], cx, cy - 2.2, [1, 1], "S", false);
        doc.lines([[4, 1], [0, 3.6], [-4, -1.4]], cx, cy - 2.2, [1, 1], "S", false);
    }
}
async function renderFramed(doc, child, achievements, t, includeImages = true) {
    const cat = dominantCategory(achievements);
    const { accent, kind } = FRAME_THEMES[cat];
    const FM = 20;
    drawFrameBorder(doc, accent);
    drawSeal(doc, A4.w / 2, 24, accent, kind);
    setFont(doc, "bold");
    doc.setFontSize(11);
    doc.setTextColor(44, 44, 42);
    doc.text("C H A M P S T E P", A4.w / 2, 36, { align: "center" });
    setFont(doc, "bold");
    doc.setFontSize(8);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(t(`categories.${cat}`).toUpperCase(), A4.w / 2, 41, { align: "center" });
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(0.5);
    doc.line(A4.w / 2 - 9, 44, A4.w / 2 + 9, 44);
    setFont(doc, "bold");
    doc.setFontSize(22);
    doc.setTextColor(44, 44, 42);
    doc.text(child.name, FM, 60);
    await drawAvatar(doc, child, A4.w - FM - 8, 56, 8, { bgR: accent[0], bgG: accent[1], bgB: accent[2], textR: 255, textG: 255, textB: 255 });
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(0.5);
    doc.circle(A4.w - FM - 8, 56, 8, "S");
    if (child.bio) {
        setFont(doc, "normal");
        doc.setFontSize(10);
        doc.setTextColor(138, 138, 133);
        doc.text(child.bio, FM, 67, { maxWidth: A4.w - 2 * FM - 22 });
    }
    doc.setDrawColor(231, 229, 223);
    doc.setLineWidth(0.3);
    doc.line(FM, 74, A4.w - FM, 74);
    let y = 86;
    for (const a of achievements) {
        const imgH = includeImages && a.imageURLs?.length ? 45 : 0;
        const blockH = 26 + imgH;
        if (y + blockH > A4.h - 20) {
            doc.addPage();
            drawFrameBorder(doc, accent);
            y = 26;
        }
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(FM, y - 3.5, 0.9, 5, "F");
        setFont(doc, "bold");
        doc.setFontSize(12);
        doc.setTextColor(44, 44, 42);
        doc.text(a.title, FM + 4, y, { maxWidth: A4.w - 2 * FM - 8 });
        setFont(doc, "normal");
        doc.setFontSize(9);
        doc.setTextColor(138, 138, 133);
        doc.text(`${a.date}  ·  ${a.location}  ·  ${t(`awards.${a.awardType}`)}`, FM + 4, y + 5.5);
        if (a.description) {
            doc.setFontSize(9.5);
            doc.setTextColor(85, 85, 79);
            const lines = doc.splitTextToSize(a.description, A4.w - 2 * FM - 8);
            doc.text(lines.slice(0, 2), FM + 4, y + 11);
        }
        if (includeImages && a.imageURLs?.length) {
            await drawImageRow(doc, a.imageURLs, FM + 4, y + 16);
        }
        doc.setDrawColor(231, 229, 223);
        doc.setLineWidth(0.3);
        doc.line(FM, y + blockH, A4.w - FM, y + blockH);
        y += blockH + 6;
    }
    const total = doc.internal.pages.length - 1;
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        setFont(doc, "normal");
        doc.setFontSize(8);
        doc.setTextColor(170, 165, 158);
        doc.text(t("pdf.footer"), A4.w / 2, A4.h - 14, { align: "center" });
        doc.text(`${i} / ${total}`, A4.w - FM, A4.h - 14, { align: "right" });
    }
}
// -----------------------------------------------------------------------------
function addFooters(doc, footerText) {
    const total = doc.internal.pages.length - 1;
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        setFont(doc, "normal");
        doc.setFontSize(8);
        doc.setTextColor(160, 150, 140);
        doc.text(footerText, M, A4.h - 8);
        doc.text(`${i} / ${total}`, A4.w - M, A4.h - 8, { align: "right" });
    }
}
