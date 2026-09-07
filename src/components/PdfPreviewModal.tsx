import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportPortfolio, type PdfTemplate, type FrameStyle } from "../lib/pdfExport";

const FRAME_STYLES: FrameStyle[] = ["classic", "corner", "minimal"];
import type { Achievement, Child } from "../types";
import { SUPPORTED_LANGS, type AppLang } from "../i18n";

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  child: Child;
  achievements: Achievement[];
  template: PdfTemplate;
  includeImages: boolean;
}

export default function PdfPreviewModal({
  open,
  onClose,
  child,
  achievements,
  template,
  includeImages,
}: PdfPreviewModalProps) {
  const { t, i18n } = useTranslation();
  const language: AppLang = SUPPORTED_LANGS.includes(i18n.resolvedLanguage as AppLang)
    ? (i18n.resolvedLanguage as AppLang)
    : "mn";

  const [frameStyle, setFrameStyle] = useState<FrameStyle>("classic");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState<"select" | "preview">("select");
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const urlRef = useRef<string | null>(null);

  const replaceUrl = (url: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setPreviewUrl(url);
  };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(achievements.map((a) => a.id)));
      setStep("select");
      setExpanded(false);
    }
  }, [open, achievements]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selectedList = useMemo(
    () => achievements.filter((a) => selectedIds.has(a.id)),
    [achievements, selectedIds]
  );

  useEffect(() => {
    if (!open) return;
    if (isMobile && step !== "preview") return;
    if (selectedList.length === 0) { replaceUrl(null); return; }

    let cancelled = false;
    setGenerating(true);
    const handle = window.setTimeout(async () => {
      try {
        const url = await exportPortfolio(child, selectedList, {
          t, template, language, includeImages, frameStyle, output: "bloburl",
        });
        if (!cancelled && typeof url === "string") replaceUrl(url);
      } catch (err) {
        console.warn("[champstep] preview failed:", err);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    }, 350);

    return () => { cancelled = true; window.clearTimeout(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMobile, step, selectedList, template, includeImages, language, frameStyle]);

  useEffect(() => {
    if (!open) replaceUrl(null);
    return () => replaceUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const allSelected = achievements.length > 0 && selectedIds.size === achievements.length;
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(achievements.map((a) => a.id)));

  // Must stay synchronous (no await before window.open) or popup blockers will cancel it.
  const openFullscreen = () => {
    const url = urlRef.current;
    if (!url) return;
    window.open(url, "_blank", "noopener");
  };

  async function handleDownload() {
    if (selectedList.length === 0) return;
    try {
      setGenerating(true);
      await exportPortfolio(child, selectedList, {
        t, template, language, includeImages, frameStyle, output: "save",
      });
      onClose();
    } catch (err) {
      console.warn("[champstep] download failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  const checkIcon = (
    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );

  const fullscreenIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
    </svg>
  );

  const expandIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4h5v5M20 4l-6 6M9 20H4v-5M4 20l6-6" />
    </svg>
  );

  const collapseIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h5M14 10V5M14 10l6-6M10 14H5M10 14v5M10 14l-6 6" />
    </svg>
  );

  const pdfIcon = (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );

  const toolbarBtnClass =
    "w-8 h-8 rounded-md flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-200/70 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

  const listContent = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-stone-500">{t("pdfPreview.entries")}</span>
        <button type="button" onClick={toggleAll} className="text-xs text-amber-600 hover:text-amber-700">
          {allSelected ? t("pdfPreview.deselectAll") : t("pdfPreview.selectAll")}
        </button>
      </div>
      {achievements.map((a) => {
        const on = selectedIds.has(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className="w-full flex items-start gap-3 py-2.5 text-left border-t border-stone-100"
          >
            <span className={`shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${on ? "bg-stone-950 border-stone-950" : "bg-white border-stone-300"}`}>
              {on && checkIcon}
            </span>
            <span className={`min-w-0 ${on ? "" : "opacity-50"}`}>
              <span className="block text-sm text-stone-800 leading-tight truncate">{a.title}</span>
              <span className="block text-xs text-stone-400 mt-0.5">{a.date} · {t(`awards.${a.awardType}`)}</span>
            </span>
          </button>
        );
      })}
    </>
  );

  const previewToolbar = (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-stone-500">{t("pdfPreview.preview")}</span>
      <div className="flex items-center gap-1">
        {!isMobile && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? t("pdf.collapse") : t("pdf.expand")}
            aria-label={expanded ? t("pdf.collapse") : t("pdf.expand")}
            aria-pressed={expanded}
            className={toolbarBtnClass}
          >
            {expanded ? collapseIcon : expandIcon}
          </button>
        )}
        <button
          type="button"
          onClick={openFullscreen}
          disabled={!previewUrl}
          title={t("pdf.openFullscreen")}
          aria-label={t("pdf.openFullscreen")}
          className={toolbarBtnClass}
        >
          {fullscreenIcon}
        </button>
      </div>
    </div>
  );

  const generatingOverlay = generating && (
    <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <span className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
        {t("pdfPreview.generating")}
      </div>
    </div>
  );

  const previewContent = (
    <div className="flex-1 min-h-0 flex flex-col">
      {selectedList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-stone-400 text-center px-4">
          {t("pdfPreview.noneSelected")}
        </div>
      ) : isMobile ? (
        // Phones: inline PDF iframes are unreliable (iOS Safari shows only page 1), so offer a button instead.
        <div className="relative flex-1 min-h-[12rem] flex flex-col items-center justify-center gap-2 px-4">
          <button
            type="button"
            onClick={openFullscreen}
            disabled={!previewUrl || generating}
            className="inline-flex items-center gap-3 px-5 py-3.5 rounded-xl bg-stone-950 text-white text-sm font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors"
          >
            {pdfIcon}
            {t("pdf.previewOnPhone")}
            {fullscreenIcon}
          </button>
          <p className="text-xs text-stone-400 text-center">{t("pdf.previewOnPhoneHint")}</p>
          {generatingOverlay}
        </div>
      ) : (
        <>
          {previewToolbar}
          <div className="relative flex-1 min-h-0">
            {previewUrl && (
              <iframe
                title={t("pdfPreview.preview")}
                src={previewUrl}
                className="w-full h-full rounded-lg border border-stone-200 bg-white"
              />
            )}
            {generatingOverlay}
          </div>
        </>
      )}
    </div>
  );

  const stepIndicator = (
    <div className="flex items-center gap-2 mb-4">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === "select" ? "bg-stone-950 text-white" : "bg-stone-200 text-stone-500"}`}>1</span>
      <span className={`text-xs ${step === "select" ? "text-stone-900 font-medium" : "text-stone-400"}`}>{t("pdfPreview.stepSelect")}</span>
      <span className="flex-1 h-px bg-stone-200" />
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === "preview" ? "bg-stone-950 text-white" : "bg-stone-200 text-stone-500"}`}>2</span>
      <span className={`text-xs ${step === "preview" ? "text-stone-900 font-medium" : "text-stone-400"}`}>{t("pdfPreview.preview")}</span>
    </div>
  );

  const downloadBtn = (
    <button
      type="button"
      onClick={handleDownload}
      disabled={selectedList.length === 0 || generating}
      className="px-4 py-2 rounded-lg text-sm bg-stone-950 text-white disabled:opacity-40 hover:bg-stone-800 transition-colors"
    >
      {t("pdfPreview.downloadN", { n: selectedList.length })}
    </button>
  );

  const isExpanded = expanded && !isMobile;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4 print:hidden cs-backdrop-in" onClick={onClose}>
      <div
        className={`bg-white w-full rounded-2xl shadow-xl overflow-hidden flex flex-col cs-panel-in ${
          isExpanded ? "max-w-[95vw] h-[95vh]" : "max-w-3xl max-h-[90vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-stone-100">
          <div className="min-w-0">
            <p className="text-base font-medium text-stone-900">{t("pdfPreview.title")}</p>
            <p className="text-xs text-stone-500 mt-0.5 truncate">{t(`pdf.${template}`)} · {child.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("pdfPreview.close")} className="shrink-0 text-stone-400 hover:text-stone-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {template === "framed" && (
          <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-stone-100 bg-stone-50/60">
            <span className="text-xs text-stone-500 shrink-0">{t("pdfPreview.frame")}:</span>
            {FRAME_STYLES.map((fs) => (
              <button
                key={fs}
                type="button"
                onClick={() => setFrameStyle(fs)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  frameStyle === fs
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                }`}
              >
                {t(`pdfPreview.frameStyle.${fs}`)}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {!isMobile ? (
            <div className={`grid h-full ${isExpanded ? "grid-cols-1" : "grid-cols-2"}`}>
              {!isExpanded && (
                <div className="overflow-y-auto p-4 border-r border-stone-100">{listContent}</div>
              )}
              <div className="bg-stone-50 p-4 flex flex-col min-h-0">{previewContent}</div>
            </div>
          ) : step === "select" ? (
            <div className="h-full overflow-y-auto p-4">
              {stepIndicator}
              {listContent}
            </div>
          ) : (
            <div className="h-full bg-stone-50 p-4 flex flex-col">
              {stepIndicator}
              {previewContent}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-t border-stone-100">
          <span className="text-xs text-stone-400">
            {t("pdfPreview.selected", { n: selectedList.length, total: achievements.length })}
          </span>
          <div className="flex gap-2">
            {!isMobile ? (
              <>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors">
                  {t("pdfPreview.cancel")}
                </button>
                {downloadBtn}
              </>
            ) : step === "select" ? (
              <>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors">
                  {t("pdfPreview.cancel")}
                </button>
                <button type="button" onClick={() => setStep("preview")} disabled={selectedList.length === 0} className="px-4 py-2 rounded-lg text-sm bg-stone-950 text-white disabled:opacity-40 hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5">
                  {t("pdfPreview.continue")}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h14" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep("select")} className="px-4 py-2 rounded-lg text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 12H5" />
                  </svg>
                  {t("pdfPreview.back")}
                </button>
                {downloadBtn}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
