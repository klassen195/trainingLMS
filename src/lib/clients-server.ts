import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeClientCode } from "@/lib/clients";

export async function resolveClientIdByCode(code: string): Promise<string | null> {
  const normalized = normalizeClientCode(code);
  if (!normalized) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_client_id_by_code", {
    p_code: normalized,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function assertClientMembership(input: {
  profileClientId: string | null | undefined;
  clientCode: string;
  isPlatformAdmin?: boolean;
}): Promise<{ clientId: string } | { error: string }> {
  const clientId = await resolveClientIdByCode(input.clientCode);
  if (!clientId) {
    return { error: "Invalid Client ID. Check the code from your administrator." };
  }
  if (input.isPlatformAdmin) {
    return { clientId };
  }
  if (!input.profileClientId || input.profileClientId !== clientId) {
    return { error: "This account does not belong to that Client ID." };
  }
  return { clientId };
}
