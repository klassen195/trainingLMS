export const DEFAULT_CLIENT_CODE = "CLIENT1";
export const DEFAULT_CLIENT_ID = "a0000000-0000-4000-8000-000000000001";

export type Client = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  logo_storage_path?: string | null;
  logo_file_name?: string | null;
  logo_mime_type?: string | null;
  logo_updated_at?: string | null;
};

export const CLIENT_LOGOS_BUCKET = "client-logos";

export const CLIENT_LOGO_ACCEPT = "image/jpeg,image/png,image/webp";

export const CLIENT_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ClientLogoMimeType = (typeof CLIENT_LOGO_MIME_TYPES)[number];

export function isClientLogoMimeType(value: string): value is ClientLogoMimeType {
  return (CLIENT_LOGO_MIME_TYPES as readonly string[]).includes(value);
}

export function buildClientLogoStoragePath(clientId: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  return `${clientId}/logo/${safe}`;
}

export function normalizeClientCode(code: string): string {
  return code.trim().toUpperCase();
}
