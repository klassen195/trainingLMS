import type { AssetKind } from "@/lib/assets-types";

export type MaintenanceRequestType = "major" | "minor" | "scheduled";

export type MaintenanceServiceStatus = "in_service" | "out_of_service";

export type MaintenanceRequestStatus = "open" | "resolved";

export type MaintenanceShopStatus = "new" | "assigned" | "in_progress" | "on_hold";

export type MaintenanceRequest = {
  id: string;
  asset_id: string;
  requested_by: string | null;
  requested_at: string;
  service_status: MaintenanceServiceStatus;
  request_type: MaintenanceRequestType;
  title: string;
  description: string;
  photo_storage_path: string | null;
  photo_file_name: string | null;
  vehicle_check_id: string | null;
  status: MaintenanceRequestStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_note: string | null;
  assigned_to: string | null;
  shop_status: MaintenanceShopStatus;
  shop_notes: string;
};

export type MaintenanceRequester = {
  id: string;
  display_name: string | null;
  email: string | null;
};

export type MaintenanceAssignee = MaintenanceRequester;

export type MaintenanceRequestWithRequester = MaintenanceRequest & {
  requester?: MaintenanceRequester | null;
  assignee?: MaintenanceAssignee | null;
  photo_url?: string | null;
};

export type MaintenanceRequestWithAsset = MaintenanceRequestWithRequester & {
  asset?: {
    id: string;
    kind: AssetKind;
    name: string | null;
    unit_number: string | null;
    build_number: string | null;
    apparatus_type: string | null;
    station: string | null;
    status: string;
  } | null;
};

export const MAINTENANCE_REQUEST_SELECT =
  "id, asset_id, requested_by, requested_at, service_status, request_type, title, description, photo_storage_path, photo_file_name, vehicle_check_id, status, resolved_at, resolved_by, resolved_note, assigned_to, shop_status, shop_notes";

export const MAINTENANCE_REQUEST_WITH_REQUESTER_SELECT = `${MAINTENANCE_REQUEST_SELECT}, requester:profiles!requested_by(id, display_name, email), assignee:profiles!assigned_to(id, display_name, email)`;

export const MAINTENANCE_PHOTO_BUCKET = "maintenance-photos";

export const MAINTENANCE_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

export function isMaintenancePhotoFile(file: File) {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return IMAGE_MIME_TYPES.has(file.type) || IMAGE_EXTENSIONS.has(ext);
}

export function sanitizeMaintenanceFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "photo";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned || "photo";
}

export function buildMaintenancePhotoStoragePath(
  assetId: string,
  requestId: string,
  fileName: string
) {
  return `${assetId}/${requestId}/${sanitizeMaintenanceFileName(fileName)}`;
}
