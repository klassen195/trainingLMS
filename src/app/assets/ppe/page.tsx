import Link from "next/link";
import { HardHat, Plus } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { fetchAssetsWithLatestInspection, fetchOpenMaintenanceRequestsByAssetIds } from "@/lib/assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { AssetsSectionNav } from "@/components/AssetsSectionNav";
import { EquipmentTable } from "@/components/EquipmentTable";
import { Button } from "@/components/ui/Button";

export default async function AssetsPpePage() {
  const profile = await requireUserProfile();
  const caps = await getProfileCapabilities(profile);
  const canManage = caps.manage_assets;
  const viewAll = caps.view_all_ppe || canManage;
  const supabase = await createSupabaseServerClient();

  const { rows, error } = await fetchAssetsWithLatestInspection(supabase, "ppe", {
    assignedTo: viewAll ? undefined : profile.id,
  });

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;

  const { byAssetId: openRequestsByAssetId, error: maintenanceError } =
    await fetchOpenMaintenanceRequestsByAssetIds(
      supabase,
      rows.map((asset) => asset.id)
    );
  if (maintenanceError) throw maintenanceError;

  return (
    <div className="container mx-auto px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <HardHat className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{viewAll ? "Equipment inventory" : "My equipment"}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {viewAll
              ? "Department equipment inventory."
              : "Equipment assigned to you."}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild size="sm">
              <Link href="/assets/ppe/import">Import</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/assets/new?kind=ppe">
                <Plus className="mr-1.5 h-4 w-4" />
                Add equipment
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <AssetsSectionNav
        showApparatus={caps.view_apparatus || canManage}
        showMaintenance={caps.resolve_maintenance}
      />

      <EquipmentTable
        rows={rows}
        showAssignee={viewAll}
        canRequestMaintenance={caps.submit_maintenance}
        openRequestsByAssetId={openRequestsByAssetId}
        emptyMessage={
          viewAll
            ? "No equipment recorded yet. Add the first item."
            : "No equipment is assigned to you yet."
        }
      />
    </div>
  );
}
