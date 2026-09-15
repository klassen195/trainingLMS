"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, requireAdmin, requirePlatformAdmin } from "@/lib/auth";
import {
  isClientModuleKey,
  masterModuleKeys,
  type ClientModule,
  type ClientModuleKey,
} from "@/lib/client-modules";
import { loadClientModules, loadPlatformModuleOrder } from "@/lib/client-modules-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseErrorMessage } from "@/lib/supabase/errors";

function revalidateModuleNav() {
  revalidatePath("/admin/modules");
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

async function assertCanManageClientModules(clientId: string) {
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") throw new Error("Sign in required.");
  if (ctx.mustChangePassword) throw new Error("Change your password before continuing.");

  if (ctx.isPlatformAdmin) {
    await requirePlatformAdmin();
    return ctx;
  }

  await requireAdmin();
  if (ctx.clientId !== clientId) {
    throw new Error("You can only reorder modules for your own department.");
  }
  return ctx;
}

export async function getCurrentClientModules(): Promise<{
  clientId: string;
  modules: ClientModule[];
}> {
  const ctx = await getAuthContext();
  await requireAdmin();
  if (ctx.kind !== "authenticated") throw new Error("Sign in required.");
  const modules = await loadClientModules(ctx.clientId);
  return { clientId: ctx.clientId, modules };
}

export async function reorderClientModules(input: {
  clientId: string;
  moduleKeys: string[];
}) {
  await assertCanManageClientModules(input.clientId);
  if (input.moduleKeys.length === 0) return;

  const masterOrder = await loadPlatformModuleOrder();
  const seen = new Set<string>();
  const keys: ClientModuleKey[] = [];
  for (const key of input.moduleKeys) {
    if (!isClientModuleKey(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  for (const key of masterModuleKeys(masterOrder)) {
    if (seen.has(key)) continue;
    keys.push(key);
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("client_modules")
    .select("module_key, enabled")
    .eq("client_id", input.clientId);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));

  const enabledByKey = new Map(
    (existing ?? []).map((row) => [row.module_key as string, row.enabled !== false])
  );

  // Prefer update-only so department admins do not need insert rights.
  for (const [index, module_key] of keys.entries()) {
    const { data: updated, error } = await supabase
      .from("client_modules")
      .update({ sort_order: index + 1 })
      .eq("client_id", input.clientId)
      .eq("module_key", module_key)
      .select("module_key");
    if (error) throw new Error(supabaseErrorMessage(error));

    if (!updated?.length) {
      const ctx = await getAuthContext();
      if (ctx.kind !== "authenticated" || !ctx.isPlatformAdmin) {
        throw new Error("Module is not available for this department.");
      }
      const { error: insertError } = await supabase.from("client_modules").insert({
        client_id: input.clientId,
        module_key,
        enabled: enabledByKey.get(module_key) ?? true,
        sort_order: index + 1,
      });
      if (insertError) throw new Error(supabaseErrorMessage(insertError));
    }
  }

  revalidateModuleNav();
}

export async function resetClientModulesToMaster(input: { clientId: string }) {
  await assertCanManageClientModules(input.clientId);
  const masterOrder = await loadPlatformModuleOrder();
  const keys = masterModuleKeys(masterOrder);

  const supabase = await createSupabaseServerClient();
  for (const [index, module_key] of keys.entries()) {
    const { data: updated, error } = await supabase
      .from("client_modules")
      .update({ sort_order: index + 1 })
      .eq("client_id", input.clientId)
      .eq("module_key", module_key)
      .select("module_key");
    if (error) throw new Error(supabaseErrorMessage(error));

    if (!updated?.length) {
      const ctx = await getAuthContext();
      if (ctx.kind !== "authenticated" || !ctx.isPlatformAdmin) continue;
      const { error: insertError } = await supabase.from("client_modules").insert({
        client_id: input.clientId,
        module_key,
        enabled: true,
        sort_order: index + 1,
      });
      if (insertError) throw new Error(supabaseErrorMessage(insertError));
    }
  }

  revalidateModuleNav();
}
