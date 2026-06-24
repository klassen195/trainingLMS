import type { ModuleResourceType } from "@/lib/training-lms-types";

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const POWERPOINT_MIME_TYPES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const POWERPOINT_EXTENSIONS = new Set([".ppt", ".pptx"]);

export const MODULE_RESOURCE_ACCEPT =
  "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function resourceTypeLabel(type: ModuleResourceType) {
  switch (type) {
    case "video":
      return "Video";
    case "pdf":
      return "PDF";
    case "powerpoint":
      return "PowerPoint";
    case "youtube":
      return "YouTube";
  }
}

export function resourceSubtitle(resource: {
  resource_type: ModuleResourceType;
  file_name: string | null;
  external_url: string | null;
}) {
  if (resource.resource_type === "youtube") {
    return resource.external_url ?? "YouTube video";
  }
  return resource.file_name ?? "";
}

export function parseYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return id || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] ?? null;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] ?? null;
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

export function getYouTubeEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function getYouTubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function fileExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function detectResourceType(file: File): ModuleResourceType | null {
  if (VIDEO_MIME_TYPES.has(file.type) || VIDEO_EXTENSIONS.has(fileExtension(file.name))) {
    return "video";
  }
  if (PDF_MIME_TYPES.has(file.type) || PDF_EXTENSIONS.has(fileExtension(file.name))) {
    return "pdf";
  }
  if (POWERPOINT_MIME_TYPES.has(file.type) || POWERPOINT_EXTENSIONS.has(fileExtension(file.name))) {
    return "powerpoint";
  }
  return null;
}

export function sanitizeFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned || "file";
}

export function buildModuleResourceStoragePath(moduleId: string, resourceId: string, fileName: string) {
  return `${moduleId}/${resourceId}/${sanitizeFileName(fileName)}`;
}
