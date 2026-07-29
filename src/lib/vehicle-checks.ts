import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApparatusType } from "@/lib/assets-types";
import {
  VEHICLE_CHECK_TEMPLATE_SELECT,
  type VehicleCheckTemplate,
} from "@/lib/vehicle-checks-types";

export type AssetForTemplateResolve = {
  id: string;
  apparatus_type: ApparatusType | null;
};

export type ResolvedVehicleCheckTemplate = {
  template: VehicleCheckTemplate;
  source: "unit" | "type_default";
};

/**
 * Resolve which named checklists a unit uses:
 * 1) explicit unit assignments (full replace)
 * 2) else all type-default templates for the apparatus type
 */
export async function resolveVehicleCheckTemplates(
  supabase: SupabaseClient,
  asset: AssetForTemplateResolve
): Promise<ResolvedVehicleCheckTemplate[]> {
  const { data: assigned, error: assignedError } = await supabase
    .from("asset_vehicle_check_templates")
    .select("template_id, sort_order")
    .eq("asset_id", asset.id)
    .order("sort_order", { ascending: true });
  if (assignedError) throw assignedError;

  if (assigned && assigned.length > 0) {
    const ids = assigned.map((row) => row.template_id);
    const { data: templates, error } = await supabase
      .from("vehicle_check_templates")
      .select(VEHICLE_CHECK_TEMPLATE_SELECT)
      .in("id", ids);
    if (error) throw error;

    const byId = new Map(
      ((templates ?? []) as VehicleCheckTemplate[]).map((t) => [t.id, t] as const)
    );
    const resolved: ResolvedVehicleCheckTemplate[] = [];
    for (const id of ids) {
      const template = byId.get(id);
      if (!template) continue;
      resolved.push({ template, source: "unit" });
    }
    return resolved;
  }

  if (!asset.apparatus_type) return [];

  const { data: defaults, error: defaultsError } = await supabase
    .from("vehicle_check_templates")
    .select(VEHICLE_CHECK_TEMPLATE_SELECT)
    .eq("apparatus_type", asset.apparatus_type)
    .eq("is_type_default", true)
    .order("name", { ascending: true });
  if (defaultsError) throw defaultsError;

  return ((defaults ?? []) as VehicleCheckTemplate[]).map((template) => ({
    template,
    source: "type_default" as const,
  }));
}

/** Resolve a single template for a unit, ensuring the unit is allowed to use it. */
export async function resolveVehicleCheckTemplateForUnit(
  supabase: SupabaseClient,
  asset: AssetForTemplateResolve,
  templateId: string
): Promise<ResolvedVehicleCheckTemplate | null> {
  const resolved = await resolveVehicleCheckTemplates(supabase, asset);
  return resolved.find((row) => row.template.id === templateId) ?? null;
}
