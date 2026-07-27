import Link from "next/link";
import { HardHat, Plus } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { fetchAssetsWithLatestInspection } from "@/lib/assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetList } from "@/components/AssetList";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { AssetsSectionNav } from "@/components/AssetsSectionNav";
import { Button } from "@/components/ui/Button";

export default async function AssetsPpePage() {
  const profile = await requireUserProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createSupabaseServerClient();

  const { rows, error } = await fetchAssetsWithLatestInspection(supabase, "ppe", {
    assignedTo: isAdmin ? undefined : profile.id,
  });

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <HardHat className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{isAdmin ? "PPE inventory" : "My PPE"}</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            {isAdmin
              ? "All personal protective equipment across the department."
              : "PPE assigned to you, with expiration and inspection due dates."}
          </p>
        </div>
        {isAdmin ? (
          <Button asChild>
            <Link href="/assets/new?kind=ppe">
              <Plus className="mr-2 h-4 w-4" />
              Add PPE
            </Link>
          </Button>
        ) : null}
      </div>

      <AssetsSectionNav />

      <AssetList
        rows={rows}
        kind="ppe"
        isAdmin={isAdmin}
        emptyMessage={
          isAdmin
            ? "No PPE recorded yet. Add the first item."
            : "No PPE is assigned to you yet."
        }
      />
    </div>
  );
}
