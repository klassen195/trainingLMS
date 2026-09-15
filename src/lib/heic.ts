import { personnelFileExtension, sanitizePersonnelFileName } from "@/lib/personnel-types";

const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);

export function isHeicImage(mimeType?: string | null, fileName?: string | null) {
  const mime = mimeType?.toLowerCase() ?? "";
  return HEIC_MIME_TYPES.has(mime) || HEIC_EXTENSIONS.has(personnelFileExtension(fileName));
}

export async function convertHeicBlobToJpeg(blob: Blob): Promise<Blob> {
  const { heicTo } = await import("heic-to");
  return heicTo({
    blob,
    type: "image/jpeg",
    quality: 0.85,
  });
}

export async function fileAsJpegIfHeic(file: File): Promise<File> {
  if (!isHeicImage(file.type, file.name)) return file;
  const jpeg = await convertHeicBlobToJpeg(file);
  const base = file.name.replace(/\.(heic|heif)$/i, "") || "image";
  return new File([jpeg], `${sanitizePersonnelFileName(base)}.jpg`, { type: "image/jpeg" });
}
