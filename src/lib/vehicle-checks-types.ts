import type { ApparatusType } from "@/lib/assets-types";

export type VehicleCheckType = "daily" | "weekly";

export type VehicleCheckTemplateRowKind = "section" | "item";

export type VehicleCheckFieldType = "pass_fail" | "level" | "short_answer";

export type VehicleCheckItemResult = "pass" | "fail";

export type VehicleCheckLevel =
  | "full"
  | "three_quarters"
  | "half"
  | "one_quarter"
  | "empty";

export type VehicleCheckTemplate = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  apparatus_type: ApparatusType | null;
  is_type_default: boolean;
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
};

export type VehicleCheck = {
  id: string;
  created_at: string;
  asset_id: string;
  checked_at: string;
  checked_by: string | null;
  includes_daily: boolean;
  includes_weekly: boolean;
  notes: string;
};

export type VehicleCheckResponse = {
  id: string;
  vehicle_check_id: string;
  check_type: VehicleCheckType;
  label: string;
  section_title: string | null;
  sort_order: number;
  field_type: VehicleCheckFieldType;
  result: VehicleCheckItemResult | null;
  level_value: VehicleCheckLevel | null;
  text_value: string;
  notes: string;
};

export type VehicleCheckWithChecker = VehicleCheck & {
  checker?: { id: string; display_name: string | null; email: string | null } | null;
};

export type VehicleCheckWithDetails = VehicleCheckWithChecker & {
  responses: VehicleCheckResponse[];
};

export const VEHICLE_CHECK_TEMPLATE_SELECT =
  "id, created_at, updated_at, name, apparatus_type, is_type_default, notes";

export const VEHICLE_CHECK_TEMPLATE_ITEM_SELECT =
  "id, created_at, template_id, row_kind, check_type, field_type, label, help_text, sort_order, is_active";

export const VEHICLE_CHECK_SELECT =
  "id, created_at, asset_id, checked_at, checked_by, includes_daily, includes_weekly, notes";

export const VEHICLE_CHECK_WITH_CHECKER_SELECT = `${VEHICLE_CHECK_SELECT}, checker:profiles!checked_by(id, display_name, email)`;

export const VEHICLE_CHECK_RESPONSE_SELECT =
  "id, vehicle_check_id, check_type, label, section_title, sort_order, field_type, result, level_value, text_value, notes";

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

    if (!row.check_type) continue;
    if (includeTypes && !includeTypes.includes(row.check_type)) continue;
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
  return "—";
}

export function isVehicleCheckResponseIssue(response: VehicleCheckResponse): boolean {
  if (response.field_type === "pass_fail") return response.result === "fail";
  if (response.field_type === "level") return response.level_value === "empty";
  return false;
}
