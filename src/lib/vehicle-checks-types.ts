import type { ApparatusType } from "@/lib/assets-types";

export type VehicleCheckType = "daily" | "weekly";

export type VehicleChecklistKind = "check" | "swap";

export type VehicleCheckTemplateRowKind = "section" | "item";

export type VehicleCheckFieldType = "pass_fail" | "moved_status" | "level" | "short_answer";

export type VehicleCheckItemResult =
  | "pass"
  | "fail"
  | "moved"
  | "not_moved"
  | "not_applicable";

export type VehicleCheckLevel =
  | "full"
  | "three_quarters"
  | "half"
  | "one_quarter"
  | "empty";

export type VehicleCheckReturnStatus = "moved_back" | "not_moved_back";

export type VehicleCheckTemplate = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  apparatus_type: ApparatusType | null;
  is_type_default: boolean;
  checklist_kind: VehicleChecklistKind;
  notes: string;
};

export type VehicleCheckTemplateItem = {
  id: string;
  created_at: string;
  template_id: string;
  row_kind: VehicleCheckTemplateRowKind;
  check_type: VehicleCheckType | null;
  field_type: VehicleCheckFieldType | null;
  label: string;
  help_text: string;
  sort_order: number;
  is_active: boolean;
  is_mandatory: boolean;
};

export type VehicleCheck = {
  id: string;
  created_at: string;
  asset_id: string;
  template_id: string | null;
  checked_at: string;
  checked_by: string | null;
  includes_daily: boolean;
  includes_weekly: boolean;
  notes: string;
  swap_destination_asset_id: string | null;
  parent_vehicle_check_id: string | null;
};

export type VehicleCheckResponse = {
  id: string;
  vehicle_check_id: string;
  check_type: VehicleCheckType | null;
  label: string;
  section_title: string | null;
  sort_order: number;
  field_type: VehicleCheckFieldType;
  result: VehicleCheckItemResult | null;
  level_value: VehicleCheckLevel | null;
  text_value: string;
  notes: string;
  resolved_at: string | null;
  resolved_by: string | null;
  return_status: VehicleCheckReturnStatus | null;
  return_destination_asset_id: string | null;
  source_response_id: string | null;
};

export type VehicleCheckDestination = {
  id: string;
  name: string | null;
  unit_number: string | null;
  build_number: string | null;
};

export type VehicleCheckWithChecker = VehicleCheck & {
  checker?: { id: string; display_name: string | null; email: string | null } | null;
  template?: { id: string; name: string; checklist_kind?: VehicleChecklistKind } | null;
  /** Originating unit for the check (same as asset_id). Useful when viewing from destination. */
  swap_source?: VehicleCheckDestination | null;
  swap_destination?: VehicleCheckDestination | null;
  return_destination?: VehicleCheckDestination | null;
};

export type VehicleCheckWithDetails = VehicleCheckWithChecker & {
  responses: VehicleCheckResponse[];
};

export const VEHICLE_CHECK_TEMPLATE_SELECT =
  "id, created_at, updated_at, name, apparatus_type, is_type_default, checklist_kind, notes";

export const VEHICLE_CHECK_TEMPLATE_ITEM_SELECT =
  "id, created_at, template_id, row_kind, check_type, field_type, label, help_text, sort_order, is_active, is_mandatory";

export const VEHICLE_CHECK_SELECT =
  "id, created_at, asset_id, template_id, checked_at, checked_by, includes_daily, includes_weekly, notes, swap_destination_asset_id, parent_vehicle_check_id";

export const VEHICLE_CHECK_WITH_CHECKER_SELECT = `${VEHICLE_CHECK_SELECT}, checker:profiles!checked_by(id, display_name, email), template:vehicle_check_templates!template_id(id, name, checklist_kind), swap_source:assets!asset_id(id, name, unit_number, build_number), swap_destination:assets!swap_destination_asset_id(id, name, unit_number, build_number)`;

export const VEHICLE_CHECK_RESPONSE_SELECT =
  "id, vehicle_check_id, check_type, label, section_title, sort_order, field_type, result, level_value, text_value, notes, resolved_at, resolved_by, return_status, return_destination_asset_id, source_response_id";

export const VEHICLE_CHECK_RESPONSE_WITH_RETURN_DEST_SELECT = `${VEHICLE_CHECK_RESPONSE_SELECT}, return_destination:assets!return_destination_asset_id(id, name, unit_number, build_number)`;

export const VEHICLE_CHECK_LEVELS: VehicleCheckLevel[] = [
  "full",
  "three_quarters",
  "half",
  "one_quarter",
  "empty",
];

/** Group checklist items under the nearest preceding section header. */
export function groupTemplateItemsBySection(
  items: VehicleCheckTemplateItem[],
  options?: { includeTypes?: VehicleCheckType[]; activeOnly?: boolean }
): Array<{ sectionTitle: string | null; items: VehicleCheckTemplateItem[] }> {
  const includeTypes = options?.includeTypes;
  const activeOnly = options?.activeOnly ?? true;
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  const groups: Array<{ sectionTitle: string | null; items: VehicleCheckTemplateItem[] }> = [];
  let currentTitle: string | null = null;
  let currentItems: VehicleCheckTemplateItem[] = [];

  function flush() {
    if (currentItems.length > 0) {
      groups.push({ sectionTitle: currentTitle, items: currentItems });
      currentItems = [];
    }
  }

  for (const row of sorted) {
    if (activeOnly && !row.is_active) continue;

    if (row.row_kind === "section") {
      flush();
      currentTitle = row.label;
      continue;
    }

    if (includeTypes) {
      if (!row.check_type || !includeTypes.includes(row.check_type)) continue;
    }
    currentItems.push(row);
  }
  flush();
  return groups;
}

export function formatVehicleCheckResponseValue(response: VehicleCheckResponse): string {
  if (response.field_type === "level" && response.level_value) {
    const labels: Record<VehicleCheckLevel, string> = {
      full: "Full",
      three_quarters: "3/4",
      half: "1/2",
      one_quarter: "1/4",
      empty: "Empty",
    };
    return labels[response.level_value];
  }
  if (response.field_type === "short_answer") {
    return response.text_value || "—";
  }
  if (response.result === "pass") return "Pass";
  if (response.result === "fail") return "Fail";
  if (response.result === "moved") return "Moved";
  if (response.result === "not_moved") return "Not moved";
  if (response.result === "not_applicable") return "N/A";
  return "—";
}

export function isVehicleCheckResponseIssue(response: VehicleCheckResponse): boolean {
  if (response.field_type === "pass_fail") return response.result === "fail";
  if (response.field_type === "moved_status") {
    return response.result === "moved";
  }
  if (response.field_type === "level") {
    return Boolean(response.level_value && response.level_value !== "full");
  }
  return false;
}

export function isUnresolvedVehicleCheckIssue(response: VehicleCheckResponse): boolean {
  if (response.field_type === "moved_status" && response.result === "moved") {
    return response.return_status !== "moved_back";
  }
  return isVehicleCheckResponseIssue(response) && !response.resolved_at;
}
