"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeClientCode, type Client } from "@/lib/clients";
import {
  isClientModuleKey,
  masterModuleKeys,
  normalizeClientModules,
  type ClientModule,
  type ClientModuleKey,
  type PlatformModuleOrderItem,
} from "@/lib/client-modules";
import { loadPlatformModuleOrder } from "@/lib/client-modules-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { supabaseErrorMessage } from "@/lib/supabase/errors";

export type ClientWithModules = Client & { modules: ClientModule[] };

function revalidateClients() {
  revalidatePath("/admin/clients");
  revalidatePath("/admin/modules");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function listClients(): Promise<Client[]> {
  await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, code, name, is_active, created_at, updated_at")
    .order("code");
  if (error) throw new Error(supabaseErrorMessage(error));
  return (data ?? []) as Client[];
}

export async function getPlatformModuleOrder(): Promise<PlatformModuleOrderItem[]> {
  await requirePlatformAdmin();
  return loadPlatformModuleOrder();
}

export async function reorderPlatformModules(input: { moduleKeys: string[] }) {
  await requirePlatformAdmin();
  if (input.moduleKeys.length === 0) return;

  const seen = new Set<string>();
  const keys: ClientModuleKey[] = [];
  for (const key of input.moduleKeys) {
    if (!isClientModuleKey(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  for (const key of masterModuleKeys()) {
    if (seen.has(key)) continue;
    keys.push(key);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("platform_module_catalog").upsert(
    keys.map((module_key, index) => ({
      module_key,
      sort_order: index + 1,
    })),
    { onConflict: "module_key" }
  );
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateClients();
}

export async function listClientsWithModules(): Promise<ClientWithModules[]> {
  await requirePlatformAdmin();
  const masterOrder = await loadPlatformModuleOrder();
  const supabase = await createSupabaseServerClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, code, name, is_active, created_at, updated_at")
    .order("code");
  if (error) throw new Error(supabaseErrorMessage(error));

  const { data: moduleRows, error: modulesError } = await supabase
    .from("client_modules")
    .select("client_id, module_key, enabled, sort_order")
    .order("sort_order")
    .order("module_key");

  if (modulesError) {
    if (
      modulesError.code === "PGRST205" ||
      modulesError.message.includes("client_modules") ||
      modulesError.message.includes("Could not find the table")
    ) {
      return ((clients ?? []) as Client[]).map((client) => ({
        ...client,
        modules: normalizeClientModules(null, masterOrder),
      }));
    }
    throw new Error(supabaseErrorMessage(modulesError));
  }

  const byClient = new Map<string, typeof moduleRows>();
  for (const row of moduleRows ?? []) {
    const list = byClient.get(row.client_id) ?? [];
    list.push(row);
    byClient.set(row.client_id, list);
  }

  return ((clients ?? []) as Client[]).map((client) => ({
    ...client,
    modules: normalizeClientModules(byClient.get(client.id) ?? [], masterOrder),
  }));
}

export async function createClient(input: { code: string; name: string }) {
  await requirePlatformAdmin();
  const code = normalizeClientCode(input.code);
  const name = input.name.trim();
  if (!code) throw new Error("Enter a Client ID code.");
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    throw new Error("Client ID may only contain letters, numbers, hyphens, and underscores.");
  }
  if (!name) throw new Error("Enter a client name.");

  const admin = createSupabaseServiceClient();
  const { data, error } = await admin
    .from("clients")
    .insert({ code, name, is_active: true })
    .select("id")
    .single();
  if (error) throw new Error(supabaseErrorMessage(error));

  const { error: seedError } = await admin.rpc("seed_client_permission_defaults", {
    p_client_id: data.id,
  });
  if (seedError) throw new Error(seedError.message);

  revalidateClients();
}

export async function updateClient(input: {
  id: string;
  code?: string;
  name: string;
  isActive: boolean;
}) {
  await requirePlatformAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Enter a client name.");

  const patch: { name: string; is_active: boolean; code?: string } = {
    name,
    is_active: input.isActive,
  };

  if (input.code != null) {
    const code = normalizeClientCode(input.code);
    if (!code) throw new Error("Enter a Client ID code.");
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      throw new Error("Client ID may only contain letters, numbers, hyphens, and underscores.");
    }
    patch.code = code;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clients").update(patch).eq("id", input.id);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateClients();
}

export async function setClientModuleEnabled(input: {
  clientId: string;
  moduleKey: string;
  enabled: boolean;
}) {
  await requirePlatformAdmin();
  if (!isClientModuleKey(input.moduleKey)) throw new Error("Unknown module.");

  const masterOrder = await loadPlatformModuleOrder();
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("client_modules")
    .select("sort_order")
    .eq("client_id", input.clientId)
    .eq("module_key", input.moduleKey)
    .maybeSingle();
  if (existingError) throw new Error(supabaseErrorMessage(existingError));

  const masterIndex = masterModuleKeys(masterOrder).indexOf(input.moduleKey);
  const sortOrder = existing?.sort_order ?? (masterIndex >= 0 ? masterIndex + 1 : 99);

  const { error } = await supabase.from("client_modules").upsert(
    {
      client_id: input.clientId,
      module_key: input.moduleKey,
      enabled: input.enabled,
      sort_order: sortOrder,
    },
    { onConflict: "client_id,module_key" }
  );
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateClients();
}
