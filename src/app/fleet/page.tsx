import { Wrench } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import {
  fetchAssetsWithLatestInspection,
  fetchOpenMaintenanceRequestsByAssetIds,
} from "@/lib/assets";
import { fetchMaintenanceSchedulesByAssetIds } from "@/lib/maintenance-schedules";
import { listLocations } from "@/lib/locations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { FleetBoard } from "@/components/FleetBoard";

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string }>;
}) {
  const profile = await requireCapability("view_fleet");
  const { station: stationParam } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { rows: locations, error: locationsError } = await listLocations(supabase, {
    activeOnly: true,
  });
  if (locationsError) throw locationsError;

  const station =
    stationParam && locations.some((location) => location.name === stationParam)
      ? stationParam
      : undefined;

  const { rows, error } = await fetchAssetsWithLatestInspection(supabase, "apparatus", {
    station,
  });
  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;

  const assetIds = rows.map((asset) => asset.id);
  const [{ byAssetId: openRequestsByAssetId, error: maintenanceError }, { byAssetId: schedulesByAssetId, error: scheduleError }] =
    await Promise.all([
      fetchOpenMaintenanceRequestsByAssetIds(supabase, assetIds),
      fetchMaintenanceSchedulesByAssetIds(supabase, assetIds),
    ]);
  if (maintenanceError) throw maintenanceError;
  if (scheduleError) throw scheduleError;

  const { data: mechanics, error: mechanicsError } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  if (mechanicsError) throw mechanicsError;

  return (
    <div className="container mx-auto px-4 py-5">
      <div className="mb-4">
        <div className="mb-1 flex items-center gap-2">
          <Wrench className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Fleet</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Shop board: unit status, open work orders, and upcoming maintenance at a glance.
        </p>
      </div>

      <FleetBoard
        rows={rows}
        openRequestsByAssetId={openRequestsByAssetId}
        schedulesByAssetId={schedulesByAssetId}
        locations={locations.map((location) => location.name)}
        station={station}
        mechanics={mechanics ?? []}
        currentUserId={profile.id}
      />
    </div>
  );
}
