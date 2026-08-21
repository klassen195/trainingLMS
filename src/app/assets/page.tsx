import Link from "next/link";
import { HardHat, Package, Plus, Truck } from "lucide-react";
import { requireCapability, getProfileCapabilities } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function AssetsPage() {
  const profile = await requireCapability("access_assets");
  const caps = await getProfileCapabilities(profile);
  const supabase = await createSupabaseServerClient();

  let ppeQuery = supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("kind", "ppe");
  if (!caps.view_all_ppe && !caps.manage_assets) {
    ppeQuery = ppeQuery.eq("assigned_to", profile.id);
  }
  const { count: ppeCount, error: ppeError } = await ppeQuery;

  if (isMissingAssetsTable(ppeError)) return <AssetsDatabaseSetup />;
  if (ppeError) throw ppeError;

  let apparatusCount: number | null = null;
  if (caps.view_apparatus || caps.manage_assets) {
    const { count, error: apparatusError } = await supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("kind", "apparatus");

    if (isMissingAssetsTable(apparatusError)) return <AssetsDatabaseSetup />;
    if (apparatusError) throw apparatusError;
    apparatusCount = count;
  }

  const showApparatus = caps.view_apparatus || caps.manage_assets;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Assets</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            {showApparatus
              ? "Track equipment and apparatus, including inspections and vehicle checks."
              : "Your assigned equipment."}
          </p>
        </div>
        {caps.manage_assets ? (
          <Button asChild>
            <Link href="/assets/new">
              <Plus className="mr-2 h-4 w-4" />
              New asset
            </Link>
          </Button>
        ) : null}
      </div>

      <div className={`grid gap-4 ${showApparatus ? "md:grid-cols-2" : ""}`}>
        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <HardHat className="h-5 w-5" />
              <CardTitle>Equipment</CardTitle>
            </div>
            <CardDescription>
              {caps.view_all_ppe || caps.manage_assets
                ? "Department equipment inventory, assignments, and inspections."
                : "Your assigned equipment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {ppeCount ?? 0} item{(ppeCount ?? 0) === 1 ? "" : "s"}
            </p>
            <Button variant="outline" asChild>
              <Link href="/assets/ppe">View equipment</Link>
            </Button>
          </CardContent>
        </Card>

        {showApparatus ? (
          <Card>
            <CardHeader>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Truck className="h-5 w-5" />
                <CardTitle>Apparatus</CardTitle>
              </div>
              <CardDescription>
                Engines, ladders, ambulances, and other units with daily/weekly vehicle checks.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {apparatusCount ?? 0} unit{(apparatusCount ?? 0) === 1 ? "" : "s"}
              </p>
              <Button variant="outline" asChild>
                <Link href="/assets/apparatus">View apparatus</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
