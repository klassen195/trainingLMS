import { notFound, redirect } from "next/navigation";
import { Backpack } from "lucide-react";
import { RopeAuditSummaryLine } from "@/components/RopeAudit";
import { RopeBagNest, TechRescueLink } from "@/components/RopeBagNest";
import { RopeBagSection } from "@/components/RopeBagPanel";
import { RopeDatabaseSetup } from "@/components/RopeDatabaseSetup";
import { requireRopeAccess } from "@/lib/rope-access";
import { fetchLoadoutTargets, fetchRopeBag, fetchUnplacedEquipment } from "@/lib/rope";
import {
  ropeApparatusLabel,
  ropeComplementLabel,
  type RopeAttachOption,
  type RopeLoadoutTarget,
} from "@/lib/rope-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingRopeInventory } from "@/lib/supabase/errors";

export default async function RopeBagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { canManage } = await requireRopeAccess();
  const supabase = await createSupabaseServerClient();
  const result = await fetchRopeBag(supabase, id);
  if (isMissingRopeInventory(result.error)) return <RopeDatabaseSetup />;
  if (result.error) throw result.error;
  if (!result.data) notFound();

  const [attach, targets] = await Promise.all([
    canManage ? fetchUnplacedEquipment(supabase) : Promise.resolve({ data: [] as RopeAttachOption[], error: null }),
    canManage ? fetchLoadoutTargets(supabase, id) : Promise.resolve({ data: [] as RopeLoadoutTarget[], error: null }),
  ]);
  if (attach.error) {
    if (isMissingRopeInventory(attach.error)) return <RopeDatabaseSetup />;
    throw attach.error;
  }
  if (targets.error) {
    if (isMissingRopeInventory(targets.error)) return <RopeDatabaseSetup />;
    throw targets.error;
  }

  const { bag, compartment, apparatus, lines, audit, gearTypes } = result.data;
  if (bag.is_loose) redirect(`/assets/rope/compartment/${compartment.id}`);
  const apparatusLabel = ropeApparatusLabel(apparatus);
  const short = lines.reduce((sum, line) => sum + line.short, 0);
  const requiredLineCount = lines.filter((line) => line.expectedQuantity > 0).length;

  return (
    <div className="container mx-auto px-4 py-5">
      <TechRescueLink />

      <RopeBagNest
        apparatusLabel={apparatusLabel}
        apparatusHref={`/assets/rope?vehicle=${apparatus.id}`}
        compartmentName={compartment.name}
        compartmentHref={`/assets/rope?vehicle=${apparatus.id}&compartment=${compartment.id}`}
      >
        <RopeBagSection
          canManage={canManage}
          bagId={bag.id}
          bagName={bag.name}
          redirectTo={`/assets/rope/compartment/${compartment.id}`}
          lines={lines}
          gearTypes={gearTypes}
          loadoutTargets={targets.data}
          attachOptions={attach.data}
          header={
            <div className="flex items-start gap-2">
              <Backpack className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bag</p>
                <h1 className="text-xl font-bold">{bag.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ropeComplementLabel(short, requiredLineCount)}. Required gear compared with what is actually in the
                  bag.
                </p>
                <RopeAuditSummaryLine summary={audit} />
              </div>
            </div>
          }
        />

      </RopeBagNest>
    </div>
  );
}
