"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeClientCode, type Client } from "@/lib/clients";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { supabaseErrorMessage } from "@/lib/supabase/errors";

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

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
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

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
}
