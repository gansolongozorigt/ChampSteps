// =============================================================================
// Browser-side image compression utility.
// Resizes images to a max dimension and re-encodes as JPEG.
// Run BEFORE uploading to Firebase Storage to keep bandwidth/cost low.
// =============================================================================

export interface CompressOptions {
  /** Max width or height in px. Aspect ratio is preserved. */
  maxDimension?: number;
  /** JPEG quality between 0–1. */
  quality?: number;
  /** Target MIME type, defaults to image/jpeg. */
  mimeType?: "image/jpeg" | "image/webp";
}

/**
 * Compress a single image File using a canvas. Returns a new File ready to
 * upload. Uses `createImageBitmap` for fast decoding when available.
 */
export async function compressImage(
  file: File,
  {
    maxDimension = 1600,
    quality = 0.8,
    mimeType = "image/jpeg",
  }: CompressOptions = {}
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const targetW = Math.round(bitmap.width * scale);
  const targetH = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      mimeType,
      quality
    )
  );

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: mimeType, lastModified: Date.now() });
}

/** Convenience: compress an array of files in parallel. */
export function compressImages(files: File[], opts?: CompressOptions) {
  return Promise.all(files.map((f) => compressImage(f, opts)));
}
