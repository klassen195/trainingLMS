"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { supabaseErrorMessage } from "@/lib/supabase/errors";

export type PlatformOperatorRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  client_code: string | null;
  client_name: string | null;
};

export async function switchActingDepartment(clientId: string) {
  await requirePlatformAdmin();
  if (!clientId) throw new Error("Choose a department.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("switch_platform_acting_client", {
    p_client_id: clientId,
  });
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePath("/", "layout");
}

export async function listPlatformOperators(): Promise<PlatformOperatorRow[]> {
  await requirePlatformAdmin();
  const admin = createSupabaseServiceClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, display_name, client_id")
    .eq("is_platform_operator", true)
    .order("display_name", { ascending: true, nullsFirst: false });
  if (error) throw new Error(supabaseErrorMessage(error));

  const clientIds = [...new Set((data ?? []).map((row) => row.client_id as string).filter(Boolean))];
  const clientsById = new Map<string, { code: string; name: string }>();
  if (clientIds.length > 0) {
    const { data: clients, error: clientsError } = await admin
      .from("clients")
      .select("id, code, name")
      .in("id", clientIds);
    if (clientsError) throw new Error(supabaseErrorMessage(clientsError));
    for (const client of clients ?? []) {
      clientsById.set(client.id as string, {
        code: client.code as string,
        name: client.name as string,
      });
    }
  }

  return (data ?? []).map((row) => {
    const client = clientsById.get(row.client_id as string);
    return {
      id: row.id as string,
      email: (row.email as string | null) ?? null,
      display_name: (row.display_name as string | null) ?? null,
      client_code: client?.code ?? null,
      client_name: client?.name ?? null,
    };
  });
}

export async function grantPlatformOperator(email: string) {
  const actor = await requirePlatformAdmin();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Enter the person's email.");

  const admin = createSupabaseServiceClient();
  const { data: profile, error: lookupError } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", normalized)
    .maybeSingle();
  if (lookupError) throw new Error(supabaseErrorMessage(lookupError));
  if (!profile) throw new Error("No personnel record found for that email.");
  if (profile.id === actor.id) throw new Error("You already have platform operator access.");

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !userData.user) throw new Error("Could not load that account.");

  const { error: jwtError } = await admin.auth.admin.updateUserById(profile.id, {
    app_metadata: {
      ...userData.user.app_metadata,
      is_platform_admin: true,
    },
  });
  if (jwtError) throw new Error(jwtError.message);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_platform_operator: true })
    .eq("id", profile.id);
  if (profileError) throw new Error(supabaseErrorMessage(profileError));

  revalidatePath("/admin/platform-operators");
  revalidatePath("/personnel");
}

export async function revokePlatformOperator(profileId: string) {
  const actor = await requirePlatformAdmin();
  if (!profileId) throw new Error("Choose a platform operator.");
  if (profileId === actor.id) throw new Error("You cannot remove your own platform operator access.");

  const admin = createSupabaseServiceClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError || !userData.user) throw new Error("Could not load that account.");

  const { error: jwtError } = await admin.auth.admin.updateUserById(profileId, {
    app_metadata: {
      ...userData.user.app_metadata,
      is_platform_admin: false,
    },
  });
  if (jwtError) throw new Error(jwtError.message);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_platform_operator: false })
    .eq("id", profileId);
  if (profileError) throw new Error(supabaseErrorMessage(profileError));

  await admin.from("platform_operator_context").delete().eq("profile_id", profileId);

  revalidatePath("/admin/platform-operators");
  revalidatePath("/personnel");
}
