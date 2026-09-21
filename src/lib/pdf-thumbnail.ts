/**
 * Render PDF page 1 to a JPEG bitmap for UI/report thumbnails.
 * Avoids embedding raw PDFs (unsupported by react-pdf Image) and iframe viewers.
 */

/** Render at 2× on-screen frame size (9rem × 6rem) for sharp thumbnails. */
export const PDF_THUMB_MAX_W = 288;
export const PDF_THUMB_MAX_H = 192;

export async function renderPdfFirstPageThumbnailBlob(
  src: string,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<Blob> {
  const maxW = options?.maxWidth ?? PDF_THUMB_MAX_W;
  const maxH = options?.maxHeight ?? PDF_THUMB_MAX_H;
  const quality = options?.quality ?? 0.85;

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load PDF.");
  const data = new Uint8Array(await response.arrayBuffer());

  const pdf = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxW / base.width, maxH / base.height);
    const viewport = page.getViewport({ scale: Math.max(scale, 0.05) });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create canvas.");

    await page.render({ canvasContext: context, viewport }).promise;

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error("Could not encode thumbnail."));
          else resolve(blob);
        },
        "image/jpeg",
        quality
      );
    });
  } finally {
    await pdf.destroy();
  }
}

export async function renderPdfFirstPageThumbnailDataUrl(
  src: string,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<string> {
  const blob = await renderPdfFirstPageThumbnailBlob(src, options);
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read thumbnail."));
    reader.readAsDataURL(blob);
  });
}
