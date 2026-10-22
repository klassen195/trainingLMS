import { MapPin } from "lucide-react";
import { RopeContextCard, TechRescueLink } from "@/components/RopeBagNest";
import { RopeCachePanel } from "@/components/RopeCachePanel";
import { RopeDatabaseSetup } from "@/components/RopeDatabaseSetup";
import { RopeEditFrame } from "@/components/RopeEditFrame";
import { AddGearTypeForm, GearCategoryEditor } from "@/components/RopeForms";
import { requireRopeAccess } from "@/lib/rope-access";
import { fetchGearCategories, fetchLoadoutTargets, fetchRopeCache, fetchUnplacedEquipment } from "@/lib/rope";
import type { RopeLoadoutTarget } from "@/lib/rope-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingRopeInventory } from "@/lib/supabase/errors";

export default async function RopeCachePage() {
  const { canManage } = await requireRopeAccess();
  const supabase = await createSupabaseServerClient();
  const [cache, categories, attach, targets] = await Promise.all([
    fetchRopeCache(supabase),
    fetchGearCategories(supabase),
    canManage ? fetchUnplacedEquipment(supabase) : Promise.resolve({ data: [], error: null }),
    canManage
      ? fetchLoadoutTargets(supabase, "")
      : Promise.resolve({ data: [] as RopeLoadoutTarget[], error: null }),
  ]);
  for (const response of [cache, categories, attach, targets]) {
    if (!response.error) continue;
    if (isMissingRopeInventory(response.error)) return <RopeDatabaseSetup />;
    throw response.error;
  }

  return (
    <div className="container mx-auto px-4 py-5">
      <TechRescueLink />
      <RopeContextCard
        icon={<MapPin className="h-4 w-4 shrink-0 text-primary" />}
        kicker="Location"
        title="Reserve cache"
        titleAs="h1"
        href="/assets/rope#reserve-cache"
      >
        <div className="ml-3 rounded-xl border bg-background p-3 sm:ml-6 sm:p-4">
          <RopeEditFrame
            canManage={canManage}
            editLabel="Edit cache"
            header={
              <p className="text-sm text-muted-foreground">
                Department spare pool. Send gear into a bag when something is missing or broken.
              </p>
            }
            editor={
              <div className="space-y-6">
                <AddGearTypeForm categories={categories.data} />
                <GearCategoryEditor categories={categories.data} />
              </div>
            }
          >
            <RopeCachePanel
              canManage={canManage}
              rows={cache.data.rows}
              categories={categories.data}
              attachOptions={attach.data}
              bags={targets.data}
            />
          </RopeEditFrame>
        </div>
      </RopeContextCard>
    </div>
  );
}
