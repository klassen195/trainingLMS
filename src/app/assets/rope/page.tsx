import Link from "next/link";
import { Cable } from "lucide-react";
import { AssetsSectionNav } from "@/components/AssetsSectionNav";
import { RopeDatabaseSetup } from "@/components/RopeDatabaseSetup";
import { RopeEditFrame } from "@/components/RopeEditFrame";
import { EnableRopeApparatusForm } from "@/components/RopeForms";
import { RopeCompartmentPanel, RopeVehicleCards, RopeVehiclePanel } from "@/components/RopeInventoryCards";
import { RopeReserveCacheSection } from "@/components/RopeReserveCacheSection";
import { Button } from "@/components/ui/Button";
import { requireRopeAccess } from "@/lib/rope-access";
import { fetchCompartmentBoard, fetchRopeApparatus, fetchRopeApparatusOptions, fetchRopeCache, fetchRopeStations } from "@/lib/rope";
import { ropeApparatusLabel } from "@/lib/rope-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingRopeInventory } from "@/lib/supabase/errors";

const RESERVE_CACHE_ANCHOR = "reserve-cache";

export default async function RopeStationsPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string; compartment?: string; bag?: string }>;
}) {
  const query = await searchParams;
  const { caps, canManage, showApparatus, showMaintenance } = await requireRopeAccess();
  const supabase = await createSupabaseServerClient();
  const [stations, apparatus, cache, openedVehicle, board] = await Promise.all([
    fetchRopeStations(supabase),
    canManage ? fetchRopeApparatusOptions(supabase) : Promise.resolve({ data: [], error: null }),
    fetchRopeCache(supabase),
    query.vehicle ? fetchRopeApparatus(supabase, query.vehicle) : Promise.resolve(null),
    query.vehicle && query.compartment
      ? fetchCompartmentBoard(supabase, query.compartment, canManage, query.bag)
      : Promise.resolve(null),
  ]);
  for (const response of [stations, apparatus, cache, openedVehicle, board]) {
    if (!response?.error) continue;
    if (isMissingRopeInventory(response.error)) return <RopeDatabaseSetup />;
    throw response.error;
  }

  const trucks = stations.data
    .flatMap((station) => station.trucks)
    .sort((a, b) => a.label.localeCompare(b.label));
  const vehicle = openedVehicle?.data && trucks.some((truck) => truck.id === openedVehicle.data?.apparatus.id)
    ? openedVehicle.data
    : null;
  const openBoard =
    vehicle && board?.data && board.data.apparatus.id === vehicle.apparatus.id ? board.data : null;
  const vehicleHref = vehicle ? `/assets/rope?vehicle=${vehicle.apparatus.id}` : "/assets/rope";

  return (
    <div className="container mx-auto px-4 py-5">
      <AssetsSectionNav
        showApparatus={showApparatus}
        showMaintenance={showMaintenance}
        showRope={caps.view_rope_inventory || canManage}
      />

      <RopeEditFrame
        canManage={canManage}
        editLabel="Add vehicle"
        header={
          <div className="flex items-start gap-2">
            <Cable className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tech Rescue</p>
                  <h1 className="text-xl font-bold">Tech Rescue</h1>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" asChild>
                  <Link href="/assets/rope/cache">Reserve cache</Link>
                </Button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Complement of tech rescue gear on each vehicle. Open a vehicle to see its compartments, then a
                compartment to see its bags. The reserve cache is its own location.
              </p>
            </div>
          </div>
        }
        editor={<EnableRopeApparatusForm apparatus={apparatus.data} />}
      >
        <div className="space-y-4">
          <RopeVehicleCards
            trucks={trucks}
            hrefForVehicle={(vehicleId) => `/assets/rope?vehicle=${vehicleId}`}
            openId={vehicle?.apparatus.id}
            openBody={
              vehicle ? (
                <RopeVehiclePanel
                  apparatusId={vehicle.apparatus.id}
                  label={ropeApparatusLabel(vehicle.apparatus)}
                  canManage={canManage}
                  compartments={vehicle.compartments}
                  hrefForCompartment={(compartmentId) =>
                    `/assets/rope?vehicle=${vehicle.apparatus.id}&compartment=${compartmentId}`
                  }
                  openCompartmentId={openBoard?.compartment.id}
                  closeHref="/assets/rope"
                  openCompartment={
                    openBoard ? (
                      <RopeCompartmentPanel
                        board={openBoard}
                        canManage={canManage}
                        titleTag="h3"
                        closeCardHref={vehicleHref}
                        deleteRedirect={vehicleHref}
                        closeHref={`${vehicleHref}&compartment=${openBoard.compartment.id}`}
                      />
                    ) : null
                  }
                />
              ) : null
            }
          />
          <RopeReserveCacheSection anchor={RESERVE_CACHE_ANCHOR} rows={cache.data.rows} />
        </div>
      </RopeEditFrame>
    </div>
  );
}
