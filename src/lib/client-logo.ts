import { CLIENT_LOGOS_BUCKET } from "@/lib/clients";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Signed URL for the acting client's uploaded department logo, or null if none. */
export async function getClientLogoSignedUrl(
  clientId: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("logo_storage_path")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data?.logo_storage_path) return null;

  const { data: signed, error: signedError } = await supabase.storage
    .from(CLIENT_LOGOS_BUCKET)
    .createSignedUrl(data.logo_storage_path as string, expiresInSeconds);
  if (signedError) return null;
  return signed?.signedUrl ?? null;
}
