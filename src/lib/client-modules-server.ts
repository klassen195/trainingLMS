import { cache } from "react";
import {
  applyClientModuleGates,
  defaultClientModules,
  normalizeClientModules,
  normalizePlatformModuleOrder,
  type ClientModule,
  type PlatformModuleOrderItem,
} from "@/lib/client-modules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import type { AppCapability } from "@/lib/capabilities";

function isMissingCatalogTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("platform_module_catalog") ?? false) ||
    (error.message?.includes("client_modules") ?? false) ||
    (error.message?.includes("Could not find the table") ?? false)
  );
}

export const loadPlatformModuleOrder = cache(async (): Promise<PlatformModuleOrderItem[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platform_module_catalog")
    .select("module_key, sort_order")
    .order("sort_order")
    .order("module_key");

  if (error) {
    if (isMissingTrainingLmsTables(error) || isMissingCatalogTable(error)) {
      return normalizePlatformModuleOrder(null);
    }
    throw error;
  }

  return normalizePlatformModuleOrder(data);
});

export const loadClientModules = cache(async (clientId: string): Promise<ClientModule[]> => {
  const masterOrder = await loadPlatformModuleOrder();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_modules")
    .select("module_key, enabled, sort_order")
    .eq("client_id", clientId)
    .order("sort_order")
    .order("module_key");

  if (error) {
    if (isMissingTrainingLmsTables(error) || isMissingCatalogTable(error)) {
      return defaultClientModules(masterOrder);
    }
    throw error;
  }

  return normalizeClientModules(data, masterOrder);
});

export async function gateCapabilitiesForClient(
  clientId: string,
  capabilities: Record<AppCapability, boolean>
): Promise<Record<AppCapability, boolean>> {
  const modules = await loadClientModules(clientId);
  return applyClientModuleGates(capabilities, modules);
}
