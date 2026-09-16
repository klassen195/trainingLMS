"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getAuthContext } from "@/lib/auth";
import {
  buildClientLogoStoragePath,
  CLIENT_LOGOS_BUCKET,
  isClientLogoMimeType,
  type Client,
} from "@/lib/clients";
import { getClientLogoSignedUrl } from "@/lib/client-logo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function revalidateClientBranding() {
  revalidatePath("/admin/branding");
  revalidatePath("/reports");
  revalidatePath("/", "layout");
}

const CLIENT_BRANDING_SELECT =
  "id, code, name, is_active, created_at, updated_at, logo_storage_path, logo_file_name, logo_mime_type, logo_updated_at";

export async function getCurrentClientBranding(): Promise<Client> {
  await requireAdmin();
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") throw new Error("Not authenticated");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_BRANDING_SELECT)
    .eq("id", ctx.clientId)
    .single();
  if (error) throw error;
  return data as Client;
}

export async function prepareClientLogoUpload(input: {
  fileName: string;
  mimeType: string;
}): Promise<{ storagePath: string }> {
  await requireAdmin();
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") throw new Error("Not authenticated");

  if (!isClientLogoMimeType(input.mimeType)) {
    throw new Error("Logo must be a JPEG, PNG, or WebP image.");
  }

  const fileName = input.fileName.trim() || "logo.png";
  const storagePath = buildClientLogoStoragePath(ctx.clientId, fileName);
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("clients")
    .select("logo_storage_path")
    .eq("id", ctx.clientId)
    .maybeSingle();

  const previousPath = existing?.logo_storage_path as string | null | undefined;
  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(CLIENT_LOGOS_BUCKET).remove([previousPath]);
  }

  const { error } = await supabase
    .from("clients")
    .update({
      logo_storage_path: storagePath,
      logo_file_name: fileName,
      logo_mime_type: input.mimeType,
      logo_updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.clientId);
  if (error) throw error;

  revalidateClientBranding();
  return { storagePath };
}

export async function removeClientLogo() {
  await requireAdmin();
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") throw new Error("Not authenticated");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("logo_storage_path")
    .eq("id", ctx.clientId)
    .maybeSingle();
  if (error) throw error;

  const path = data?.logo_storage_path as string | null | undefined;
  if (path) {
    await supabase.storage.from(CLIENT_LOGOS_BUCKET).remove([path]);
  }

  const { error: updateError } = await supabase
    .from("clients")
    .update({
      logo_storage_path: null,
      logo_file_name: null,
      logo_mime_type: null,
      logo_updated_at: null,
    })
    .eq("id", ctx.clientId);
  if (updateError) throw updateError;

  revalidateClientBranding();
}

export async function getClientLogoPreviewUrl(): Promise<string | null> {
  await requireAdmin();
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") return null;
  return getClientLogoSignedUrl(ctx.clientId);
}
