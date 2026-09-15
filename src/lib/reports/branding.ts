import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { CLIENT_LOGOS_BUCKET, type Client } from "@/lib/clients";
import type { ReportBranding } from "@/lib/reports/types";

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mime = blob.type || "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function loadReportBranding(): Promise<ReportBranding> {
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") {
    return { departmentName: "Department", logoDataUrl: null };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("name, logo_storage_path, logo_mime_type")
    .eq("id", ctx.clientId)
    .maybeSingle();

  if (error || !data) {
    return { departmentName: "Department", logoDataUrl: null };
  }

  const client = data as Pick<Client, "name" | "logo_storage_path" | "logo_mime_type">;
  let logoDataUrl: string | null = null;

  if (client.logo_storage_path) {
    const { data: file, error: downloadError } = await supabase.storage
      .from(CLIENT_LOGOS_BUCKET)
      .download(client.logo_storage_path);
    if (!downloadError && file) {
      try {
        logoDataUrl = await blobToDataUrl(file);
      } catch {
        logoDataUrl = null;
      }
    }
  }

  return {
    departmentName: client.name?.trim() || "Department",
    logoDataUrl,
  };
}
