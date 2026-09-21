"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { convertHeicBlobToJpeg, isHeicImage } from "@/lib/heic";
import { personnelFilePreviewKind } from "@/lib/personnel-types";
import { renderPdfFirstPageThumbnailBlob } from "@/lib/pdf-thumbnail";

/** Thumbnail frame: 9rem × 6rem (144×96 at default root). */
const FRAME_CLASS =
  "relative flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40";

function FileKindFallback({
  kind,
  fileName,
}: {
  kind: "image" | "pdf" | "file";
  fileName: string | null;
}) {
  return (
    <span className="flex flex-col items-center gap-1 px-2 text-muted-foreground">
      <FileText className="h-7 w-7" />
      <span className="max-w-full truncate text-[10px] font-medium uppercase">
        {kind === "pdf" ? "PDF" : fileName?.includes(".") ? fileName.split(".").pop() : "File"}
      </span>
    </span>
  );
}

function usePreviewImageSrc(
  src: string | null,
  mimeType: string | null,
  fileName: string | null
) {
  const heic = isHeicImage(mimeType, fileName);
  const [displaySrc, setDisplaySrc] = useState<string | null>(heic ? null : src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setDisplaySrc(null);
      setFailed(false);
      return;
    }

    if (!isHeicImage(mimeType, fileName)) {
      setDisplaySrc(src);
      setFailed(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setDisplaySrc(null);
    setFailed(false);

    (async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("Could not load image.");
        const jpeg = await convertHeicBlobToJpeg(await response.blob());
        if (cancelled) return;
        objectUrl = URL.createObjectURL(jpeg);
        setDisplaySrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, mimeType, fileName]);

  return {
    src: displaySrc,
    converting: heic && Boolean(src) && !displaySrc && !failed,
    failed,
  };
}

/**
 * Render PDF page 1 to a bitmap. Avoids Chrome/Safari iframe PDF viewers, which
 * crop differently and often ignore #view=Fit on storage URLs.
 */
function usePdfThumbnailSrc(src: string | null) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setThumbSrc(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setThumbSrc(null);
    setLoading(true);
    setFailed(false);

    (async () => {
      try {
        const blob = await renderPdfFirstPageThumbnailBlob(src);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setThumbSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return { src: thumbSrc, loading, failed };
}

export function CertificationFilePreview({
  src,
  mimeType,
  fileName,
  onOpen,
  className,
}: {
  src: string | null;
  mimeType: string | null;
  fileName: string | null;
  onOpen?: () => void;
  className?: string;
}) {
  const kind = personnelFilePreviewKind(mimeType, fileName);
  const [imageFailed, setImageFailed] = useState(false);
  const heicPreview = usePreviewImageSrc(src, mimeType, fileName);
  const pdfPreview = usePdfThumbnailSrc(kind === "pdf" ? src : null);
  const label = fileName ? `Preview ${fileName}` : "Preview certification file";
  const imageSrc = kind === "image" ? heicPreview.src : src;
  const showImage = kind === "image" && Boolean(imageSrc) && !imageFailed && !heicPreview.failed;
  const showPdf = kind === "pdf" && Boolean(pdfPreview.src) && !pdfPreview.failed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  const inner =
    heicPreview.converting || (kind === "pdf" && pdfPreview.loading) ? (
      <span className="px-2 text-center text-[10px] text-muted-foreground">Loading…</span>
    ) : showImage ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc ?? ""}
        alt=""
        className="h-full w-full object-contain"
        onError={() => setImageFailed(true)}
      />
    ) : showPdf ? (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pdfPreview.src ?? ""} alt="" className="h-full w-full object-contain bg-white" />
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          PDF
        </span>
      </>
    ) : (
      <FileKindFallback kind={kind} fileName={fileName} />
    );

  return (
    <div className={cn(FRAME_CLASS, onOpen && "transition hover:ring-2 hover:ring-ring", className)}>
      {inner}
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label={label} className="absolute inset-0" />
      ) : null}
    </div>
  );
}
