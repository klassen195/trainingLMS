import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import {
  fetchAssetsWithLatestInspection,
  fetchOpenMaintenanceRequestsByAssetIds,
} from "@/lib/assets";
import { listLocations } from "@/lib/locations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { ApparatusTable } from "@/components/ApparatusTable";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { AssetsSectionNav } from "@/components/AssetsSectionNav";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export default async function AssetsApparatusPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string }>;
}) {
  const profile = await requireUserProfile();
  const caps = await getProfileCapabilities(profile);
  if (!caps.view_apparatus && !caps.manage_assets) redirect("/assets");
  const admin = caps.manage_assets;
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
            <Truck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Apparatus</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Unit roster, status, and latest vehicle checks by location.
          </p>
        </div>
        {admin ? (
          <Button asChild size="sm">
            <Link href="/assets/new?kind=apparatus">
              <Plus className="mr-1.5 h-4 w-4" />
              Add apparatus
            </Link>
          </Button>
        ) : null}
      </div>

      <AssetsSectionNav
        showApparatus
        showMaintenance={caps.resolve_maintenance}
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Link
          href="/assets/apparatus"
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            !station
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:bg-accent"
          )}
        >
          All locations
        </Link>
        {locations.map((location) => (
          <Link
            key={location.id}
            href={`/assets/apparatus?station=${encodeURIComponent(location.name)}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              station === location.name
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-accent"
            )}
          >
            {location.name}
          </Link>
        ))}
      </div>

      <ApparatusTable
        rows={rows}
        openRequestsByAssetId={openRequestsByAssetId}
        canRequestMaintenance={caps.submit_maintenance}
        emptyMessage={
          station
            ? `No apparatus recorded for ${station}.`
            : "No apparatus recorded yet."
        }
      />
    </div>
  );
}
