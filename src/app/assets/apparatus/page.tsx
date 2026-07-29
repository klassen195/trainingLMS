import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { ASSET_STATIONS } from "@/lib/assets-types";
import { fetchAssetsWithLatestInspection } from "@/lib/assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetList } from "@/components/AssetList";
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
  const isAdmin = profile.role === "admin";
  const { station: stationParam } = await searchParams;
  const station =
    stationParam && ASSET_STATIONS.includes(stationParam as (typeof ASSET_STATIONS)[number])
      ? stationParam
      : undefined;

  const supabase = await createSupabaseServerClient();
  const { rows, error } = await fetchAssetsWithLatestInspection(supabase, "apparatus", {
    station,
  });

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Apparatus</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Unit roster, status, and latest vehicle checks by station.
          </p>
        </div>
        {isAdmin ? (
          <Button asChild>
            <Link href="/assets/new?kind=apparatus">
              <Plus className="mr-2 h-4 w-4" />
              Add apparatus
            </Link>
          </Button>
        ) : null}
      </div>

      <AssetsSectionNav />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/assets/apparatus"
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            !station
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:bg-accent"
          )}
        >
          All stations
        </Link>
        {ASSET_STATIONS.map((s) => (
          <Link
            key={s}
            href={`/assets/apparatus?station=${encodeURIComponent(s)}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              station === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-accent"
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      <AssetList
        rows={rows}
        kind="apparatus"
        isAdmin={isAdmin}
        emptyMessage={
          station
            ? `No apparatus recorded for ${station}.`
            : "No apparatus recorded yet."
        }
      />
    </div>
  );
}
