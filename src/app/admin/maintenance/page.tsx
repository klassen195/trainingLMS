import { Wrench } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { asSingleProfile } from "@/lib/assets";
import {
  MAINTENANCE_PHOTO_BUCKET,
  MAINTENANCE_REQUEST_WITH_REQUESTER_SELECT,
  type MaintenanceRequestWithAsset,
} from "@/lib/maintenance-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingMaintenanceRequestsTable } from "@/lib/supabase/errors";
import { MaintenanceRequestAdminList } from "@/components/MaintenanceRequestAdminList";
import { Button } from "@/components/ui/Button";

export default async function AdminMaintenancePage() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("maintenance_requests")
    .select(
      `${MAINTENANCE_REQUEST_WITH_REQUESTER_SELECT}, asset:assets!asset_id(id, kind, name, unit_number, build_number, apparatus_type, station, status)`
    )
    .order("requested_at", { ascending: false });

  if (isMissingMaintenanceRequestsTable(error)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Maintenance requests</h1>
        <p className="text-muted-foreground">
          Maintenance requests are not set up yet. Run{" "}
          <code className="text-sm">supabase/migrations/20260729310000_maintenance_requests.sql</code>{" "}
          in the Supabase SQL editor.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    );
  }
  if (error) throw error;

  const requests: MaintenanceRequestWithAsset[] = await Promise.all(
    ((data ?? []) as Record<string, unknown>[]).map(async (raw) => {
      const { requester, asset, ...rest } = raw;
      const row = {
        ...(rest as Omit<MaintenanceRequestWithAsset, "requester" | "asset" | "photo_url">),
        requester: asSingleProfile(
          requester as
            | { id: string; display_name: string | null; email: string | null }
            | { id: string; display_name: string | null; email: string | null }[]
            | null
            | undefined
        ),
        asset: (Array.isArray(asset) ? asset[0] : asset) as MaintenanceRequestWithAsset["asset"],
        photo_url: null as string | null,
      };

      if (row.photo_storage_path) {
        const { data: signed } = await supabase.storage
          .from(MAINTENANCE_PHOTO_BUCKET)
          .createSignedUrl(row.photo_storage_path, 3600);
        row.photo_url = signed?.signedUrl ?? null;
      }

      return row;
    })
  );

  const openCount = requests.filter((r) => r.status === "open").length;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Wrench className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Maintenance requests</h1>
          </div>
          <p className="text-muted-foreground">
            {openCount} open request{openCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back</Link>
        </Button>
      </div>

      <MaintenanceRequestAdminList requests={requests} />
    </div>
  );
}
