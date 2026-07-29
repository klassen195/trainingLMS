export type AssetKind = "ppe" | "apparatus";

export type AssetStatus = "in_service" | "out_of_service" | "reserve" | "retired";

export type PpeCategory =
  | "turnout_coat"
  | "turnout_pants"
  | "helmet"
  | "boots"
  | "gloves"
  | "hood"
  | "scba_facepiece"
  | "other";

export type ApparatusType =
  | "engine"
  | "ladder"
  | "ambulance"
  | "rescue"
  | "tender"
  | "boat"
  | "other";

export type InspectionResult = "pass" | "fail" | "needs_attention";

export type Asset = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  kind: AssetKind;
  name: string | null;
  status: AssetStatus;
  station: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  notes: string;
  assigned_to: string | null;
  ppe_category: PpeCategory | null;
  size: string | null;
  manufactured_on: string | null;
  expires_on: string | null;
  unit_number: string | null;
  apparatus_type: ApparatusType | null;
  year: number | null;
  build_number: string | null;
};

export type AssetInspection = {
  id: string;
  asset_id: string;
  inspected_at: string;
  inspected_by: string | null;
  result: InspectionResult;
  notes: string;
  next_due_on: string | null;
};

export type AssetWithAssignee = Asset & {
  assignee?: { id: string; display_name: string | null; email: string | null } | null;
};

export type AssetInspectionWithInspector = AssetInspection & {
  inspector?: { id: string; display_name: string | null; email: string | null } | null;
};

export type AssetListRow = AssetWithAssignee & {
  latest_next_due_on?: string | null;
  latest_inspected_at?: string | null;
  latest_daily_checked_at?: string | null;
  latest_weekly_checked_at?: string | null;
};

export type ApparatusUnitAssignment = {
  id: string;
  asset_id: string;
  unit_number: string;
  assigned_at: string;
  unassigned_at: string | null;
  assigned_by: string | null;
  notes: string;
};

export type ApparatusUnitAssignmentWithActor = ApparatusUnitAssignment & {
  actor?: { id: string; display_name: string | null; email: string | null } | null;
};

export const ASSET_STATIONS = [
  "Station 1",
  "Station 2",
  "Station 3",
  "Station 4",
  "Station 5",
] as const;

export type AssetStation = (typeof ASSET_STATIONS)[number];

export const ASSET_SELECT =
  "id, created_at, updated_at, created_by, kind, name, status, station, manufacturer, model, serial_number, notes, assigned_to, ppe_category, size, manufactured_on, expires_on, unit_number, apparatus_type, year, build_number";

export const ASSET_WITH_ASSIGNEE_SELECT = `${ASSET_SELECT}, assignee:profiles!assigned_to(id, display_name, email)`;

export const INSPECTION_SELECT =
  "id, asset_id, inspected_at, inspected_by, result, notes, next_due_on";

export const INSPECTION_WITH_INSPECTOR_SELECT = `${INSPECTION_SELECT}, inspector:profiles!inspected_by(id, display_name, email)`;

export const UNIT_ASSIGNMENT_SELECT =
  "id, asset_id, unit_number, assigned_at, unassigned_at, assigned_by, notes";

export const UNIT_ASSIGNMENT_WITH_ACTOR_SELECT = `${UNIT_ASSIGNMENT_SELECT}, actor:profiles!assigned_by(id, display_name, email)`;

/** Display title for lists/headers: unit when assigned, otherwise build number; PPE uses name. */
export function assetDisplayLabel(
  asset: Pick<Asset, "kind" | "name" | "build_number" | "unit_number">
) {
  if (asset.kind === "apparatus") {
    const unit = asset.unit_number?.trim();
    if (unit) return unit;
    return asset.build_number?.trim() || "Apparatus";
  }
  return asset.name?.trim() || "Asset";
}

/** Compact label for pickers: "E11 — 0V95" or "0V95". */
export function apparatusOptionLabel(
  asset: Pick<Asset, "build_number" | "unit_number"> & { name?: string | null }
) {
  const build = asset.build_number?.trim() || "Unknown";
  if (asset.unit_number?.trim()) {
    return `${asset.unit_number.trim()} — ${build}`;
  }
  return build;
}