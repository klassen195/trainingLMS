import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApparatusType } from "@/lib/assets-types";
import {
  VEHICLE_CHECK_TEMPLATE_SELECT,
  type VehicleCheckTemplate,
} from "@/lib/vehicle-checks-types";

export type AssetForTemplateResolve = {
  apparatus_type: ApparatusType | null;
  vehicle_check_template_id: string | null;
};

export type ResolvedVehicleCheckTemplate = {
  template: VehicleCheckTemplate;
  source: "override" | "type_default";
};

/**
 * Resolve which named checklist a unit uses:
 * 1) per-unit override on the asset
 * 2) type-default template for the apparatus type
 */
export async function resolveVehicleCheckTemplate(
  supabase: SupabaseClient,
  asset: AssetForTemplateResolve
): Promise<ResolvedVehicleCheckTemplate | null> {
  if (asset.vehicle_check_template_id) {
    const { data, error } = await supabase
      .from("vehicle_check_templates")
      .select(VEHICLE_CHECK_TEMPLATE_SELECT)
      .eq("id", asset.vehicle_check_template_id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return { template: data as VehicleCheckTemplate, source: "override" };
    }
  }

  if (asset.apparatus_type) {
    const { data, error } = await supabase
      .from("vehicle_check_templates")
      .select(VEHICLE_CHECK_TEMPLATE_SELECT)
      .eq("apparatus_type", asset.apparatus_type)
      .eq("is_type_default", true)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return { template: data as VehicleCheckTemplate, source: "type_default" };
    }
  }

  return null;
}
