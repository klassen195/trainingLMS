import { notFound } from "next/navigation";
import { TechRescueLink } from "@/components/RopeBagNest";
import { RopeDatabaseSetup } from "@/components/RopeDatabaseSetup";
import { RopeCompartmentPanel, RopeVehiclePanel } from "@/components/RopeInventoryCards";
import { requireRopeAccess } from "@/lib/rope-access";
import { fetchCompartmentBoard, fetchRopeApparatus } from "@/lib/rope";
import { ropeApparatusLabel } from "@/lib/rope-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingRopeInventory } from "@/lib/supabase/errors";

export default async function RopeApparatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compartment?: string; bag?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { canManage } = await requireRopeAccess();
  const supabase = await createSupabaseServerClient();
  const [result, board] = await Promise.all([
    fetchRopeApparatus(supabase, id),
    query.compartment
      ? fetchCompartmentBoard(supabase, query.compartment, canManage, query.bag)
      : Promise.resolve(null),
  ]);
  for (const response of [result, board]) {
    if (!response?.error) continue;
    if (isMissingRopeInventory(response.error)) return <RopeDatabaseSetup />;
    throw response.error;
  }
  if (!result.data) notFound();

  const { apparatus, compartments } = result.data;
  const label = ropeApparatusLabel(apparatus);
  const apparatusHref = `/assets/rope/apparatus/${apparatus.id}`;
  const openBoard = board?.data?.apparatus.id === apparatus.id ? board.data : null;

  return (
    <div className="container mx-auto px-4 py-5">
      <TechRescueLink />
      <RopeVehiclePanel
        apparatusId={apparatus.id}
        label={label}
        canManage={canManage}
        compartments={compartments}
        titleTag="h1"
        hrefForCompartment={(compartmentId) => `${apparatusHref}?compartment=${compartmentId}`}
        openCompartmentId={openBoard?.compartment.id}
        openCompartment={
          openBoard ? (
            <RopeCompartmentPanel
              board={openBoard}
              canManage={canManage}
              titleTag="h2"
              closeCardHref={apparatusHref}
              deleteRedirect={apparatusHref}
              closeHref={`${apparatusHref}?compartment=${openBoard.compartment.id}`}
            />
          ) : null
        }
      />
    </div>
  );
}
