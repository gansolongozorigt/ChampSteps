import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportPortfolio, type PdfTemplate } from "../lib/pdfExport";
import type { Achievement, Child } from "../types";

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
  const language: "mn" | "en" = i18n.language?.startsWith("en") ? "en" : "mn";

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState<"select" | "preview">("select");
  const [isMobile, setIsMobile] = useState(false);
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
          t, template, language, includeImages, output: "bloburl",
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
  }, [open, isMobile, step, selectedList, template, includeImages, language]);

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

  async function handleDownload() {
    if (selectedList.length === 0) return;
    try {
      setGenerating(true);
      await exportPortfolio(child, selectedList, {
        t, template, language, includeImages, output: "save",
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

  const previewContent = (
    <div className="flex-1 min-h-0 flex flex-col">
      {selectedList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-stone-400 text-center px-4">
          {t("pdfPreview.noneSelected")}
        </div>
      ) : (
        <>
          <div className="relative flex-1 min-h-0">
            {previewUrl && (
              <iframe
                title={t("pdfPreview.preview")}
                src={previewUrl}
                className="w-full h-full rounded-lg border border-stone-200 bg-white"
              />
            )}
            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <span className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  {t("pdfPreview.generating")}
                </div>
              </div>
            )}
          </div>
          {isMobile && previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-2 text-center text-xs text-amber-600 hover:text-amber-700">
              {t("pdfPreview.openNewTab")}
            </a>
          )}
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4 print:hidden" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
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

        <div className="flex-1 min-h-0">
          {!isMobile ? (
            <div className="grid grid-cols-2 h-full">
              <div className="overflow-y-auto p-4 border-r border-stone-100">{listContent}</div>
              <div className="bg-stone-50 p-4 flex flex-col">{previewContent}</div>
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
