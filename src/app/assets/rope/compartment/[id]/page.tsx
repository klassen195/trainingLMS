import { notFound } from "next/navigation";
import { Truck } from "lucide-react";
import { RopeContextCard, TechRescueLink } from "@/components/RopeBagNest";
import { RopeDatabaseSetup } from "@/components/RopeDatabaseSetup";
import { RopeCompartmentPanel } from "@/components/RopeInventoryCards";
import { requireRopeAccess } from "@/lib/rope-access";
import { fetchCompartmentBoard } from "@/lib/rope";
import { ropeApparatusLabel } from "@/lib/rope-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingRopeInventory } from "@/lib/supabase/errors";

export default async function RopeCompartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bag?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { canManage } = await requireRopeAccess();
  const supabase = await createSupabaseServerClient();
  const result = await fetchCompartmentBoard(supabase, id, canManage, query.bag);
  if (isMissingRopeInventory(result.error)) return <RopeDatabaseSetup />;
  if (result.error) throw result.error;
  if (!result.data) notFound();

  const { apparatus } = result.data;
  const compartmentHref = `/assets/rope/compartment/${result.data.compartment.id}`;

  return (
    <div className="container mx-auto px-4 py-5">
      <TechRescueLink />
      <RopeContextCard
        icon={<Truck className="h-4 w-4 shrink-0 text-primary" />}
        kicker="Vehicle"
        title={ropeApparatusLabel(apparatus)}
        href={`/assets/rope?vehicle=${apparatus.id}`}
      >
        <div className="ml-3 rounded-xl border bg-background p-3 sm:ml-6 sm:p-4">
          <RopeCompartmentPanel
            board={result.data}
            canManage={canManage}
            titleTag="h1"
            deleteRedirect={`/assets/rope?vehicle=${apparatus.id}`}
            closeHref={compartmentHref}
          />
        </div>
      </RopeContextCard>
    </div>
  );
}
