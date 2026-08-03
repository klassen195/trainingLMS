import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  APP_CAPABILITIES,
  emptyCapabilityMatrix,
  type AppCapability,
  type CapabilityMatrix,
} from "@/lib/capabilities";
import type { UserRole } from "@/lib/training-lms-types";

type CapabilityRow = {
  role: UserRole;
  capability: string;
  enabled: boolean;
};

export const loadCapabilityMatrix = cache(async (): Promise<CapabilityMatrix> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("permission_level_capabilities")
    .select("role, capability, enabled");

  const matrix = emptyCapabilityMatrix();
  if (error || !data) return matrix;

  for (const row of data as CapabilityRow[]) {
    if (!(APP_CAPABILITIES as readonly string[]).includes(row.capability)) continue;
    if (!matrix[row.role]) continue;
    matrix[row.role][row.capability as AppCapability] = row.enabled;
  }
  return matrix;
});
