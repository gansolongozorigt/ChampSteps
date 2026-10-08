import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, Expand, FileText, Maximize2, Shrink, X } from "lucide-react";
import type { PdfTemplate, FrameStyle } from "../lib/pdfExport";

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
        const { exportPortfolio } = await import("../lib/pdfExport");
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
      const { exportPortfolio } = await import("../lib/pdfExport");
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

  const checkIcon = <Check size={14} strokeWidth={3} className="text-white" />;
  const fullscreenIcon = <Maximize2 size={18} strokeWidth={2} />;
  const expandIcon = <Expand size={18} strokeWidth={2} />;
  const collapseIcon = <Shrink size={18} strokeWidth={2} />;
  const pdfIcon = <FileText size={26} strokeWidth={1.75} />;

  const toolbarBtnClass = "cs-icon-btn cs-icon-btn-sm disabled:opacity-30 disabled:hover:bg-transparent";

  const listContent = (
    <>
      <div className="flex items-center justify-between mb-2 min-h-[36px]">
        <span className="t-label">{t("pdfPreview.entries")}</span>
        <button type="button" onClick={toggleAll} className="cs-btn cs-btn-ghost cs-btn-xs text-primary">
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
            className="w-full flex items-start gap-3 py-3 text-left border-t border-line min-h-[44px]"
            aria-pressed={on}
          >
            <span className={`shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${on ? "bg-primary border-primary" : "bg-surface border-line-strong"}`}>
              {on && checkIcon}
            </span>
            <span className={`min-w-0 ${on ? "" : "opacity-50"}`}>
              <span className="block t-body-strong text-ink leading-tight truncate">{a.title}</span>
              <span className="block t-caption mt-0.5">{a.date} · {t(`awards.${a.awardType}`)}</span>
            </span>
          </button>
        );
      })}
    </>
  );

  const previewToolbar = (
    <div className="flex items-center justify-between mb-2 min-h-[36px]">
      <span className="t-label">{t("pdfPreview.preview")}</span>
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
    <div className="absolute inset-0 flex items-center justify-center bg-surface/70 rounded-card">
      <div className="flex items-center gap-2 t-caption text-ink-2">
        <span className="w-4 h-4 border-2 border-line-strong border-t-primary rounded-full animate-spin" />
        {t("pdfPreview.generating")}
      </div>
    </div>
  );

  const previewContent = (
    <div className="flex-1 min-h-0 flex flex-col">
      {selectedList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center t-body text-ink-3 text-center px-4">
          {t("pdfPreview.noneSelected")}
        </div>
      ) : isMobile ? (
        // Phones: inline PDF iframes are unreliable (iOS Safari shows only page 1), so offer a button instead.
        <div className="relative flex-1 min-h-[12rem] flex flex-col items-center justify-center gap-2 px-4">
          <button
            type="button"
            onClick={openFullscreen}
            disabled={!previewUrl || generating}
            className="cs-btn cs-btn-ink"
          >
            {pdfIcon}
            {t("pdf.previewOnPhone")}
            {fullscreenIcon}
          </button>
          <p className="t-caption text-center">{t("pdf.previewOnPhoneHint")}</p>
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
                className="w-full h-full rounded-card border border-line bg-surface"
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
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${step === "select" ? "bg-primary text-white" : "bg-primary-soft text-primary-soft-ink"}`}>{step === "select" ? "1" : <Check size={13} strokeWidth={3} />}</span>
      <span className={`t-caption ${step === "select" ? "text-ink" : ""}`}>{t("pdfPreview.stepSelect")}</span>
      <span className="flex-1 h-px bg-line" />
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${step === "preview" ? "bg-primary text-white" : "bg-surface-muted text-ink-3"}`}>2</span>
      <span className={`t-caption ${step === "preview" ? "text-ink" : ""}`}>{t("pdfPreview.preview")}</span>
    </div>
  );

  const downloadBtn = (
    <button
      type="button"
      onClick={handleDownload}
      disabled={selectedList.length === 0 || generating}
      className="cs-btn cs-btn-primary cs-btn-sm"
    >
      {t("pdfPreview.downloadN", { n: selectedList.length })}
    </button>
  );

  const isExpanded = expanded && !isMobile;

  return (
    <div className="cs-modal-backdrop cs-backdrop-in print:hidden" onClick={onClose}>
      <div
        className={`cs-modal cs-panel-in overflow-hidden flex flex-col ${
          isExpanded ? "sm:max-w-[95vw] h-[95dvh]" : "sm:max-w-3xl h-[92dvh] sm:h-[85vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cs-handle shrink-0" />
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 pb-3 border-b border-line shrink-0">
          <div className="min-w-0">
            <p className="t-h1">{t("pdfPreview.title")}</p>
            <p className="t-caption mt-0.5 truncate">{t(`pdf.${template}`)} · {child.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("pdfPreview.close")} className="cs-icon-btn shrink-0 -mr-2">
            <X size={22} />
          </button>
        </div>

        {template === "framed" && (
          <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5 border-b border-line bg-bg-soft shrink-0 overflow-x-auto scrollbar-hide">
            <span className="t-label shrink-0">{t("pdfPreview.frame")}</span>
            <div className="cs-segment" role="group">
              {FRAME_STYLES.map((fs) => (
                <button
                  key={fs}
                  type="button"
                  onClick={() => setFrameStyle(fs)}
                  aria-pressed={frameStyle === fs}
                  className="cs-segment-item"
                >
                  {t(`pdfPreview.frameStyle.${fs}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {!isMobile ? (
            <div className={`grid h-full ${isExpanded ? "grid-cols-1" : "grid-cols-2"}`}>
              {!isExpanded && (
                <div className="overflow-y-auto p-4 border-r border-line">{listContent}</div>
              )}
              <div className="bg-bg-soft p-4 flex flex-col min-h-0">{previewContent}</div>
            </div>
          ) : step === "select" ? (
            <div className="h-full overflow-y-auto p-4">
              {stepIndicator}
              {listContent}
            </div>
          ) : (
            <div className="h-full bg-bg-soft p-4 flex flex-col">
              {stepIndicator}
              {previewContent}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-line shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="t-caption">
            {t("pdfPreview.selected", { n: selectedList.length, total: achievements.length })}
          </span>
          <div className="flex gap-2">
            {!isMobile ? (
              <>
                <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost cs-btn-sm">
                  {t("pdfPreview.cancel")}
                </button>
                {downloadBtn}
              </>
            ) : step === "select" ? (
              <>
                <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost cs-btn-sm">
                  {t("pdfPreview.cancel")}
                </button>
                <button type="button" onClick={() => setStep("preview")} disabled={selectedList.length === 0} className="cs-btn cs-btn-primary cs-btn-sm">
                  {t("pdfPreview.continue")}
                  <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep("select")} className="cs-btn cs-btn-ghost cs-btn-sm">
                  <ArrowLeft size={16} strokeWidth={2.5} />
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
