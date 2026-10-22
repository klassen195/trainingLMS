import type { ReactNode } from "react";
import Link from "next/link";
import { Cable, HardHat, Package, Plus, Truck, Wrench } from "lucide-react";
import { requireCapability, getProfileCapabilities } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingAssetsTable,
  isMissingMaintenanceRequestsTable,
  isMissingRopeInventory,
} from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

function AssetSectionCard({
  href,
  icon,
  title,
  description,
  meta,
  action,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  meta: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full transition-colors hover:bg-accent/40">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-primary">
            {icon}
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{meta}</p>
          <span className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium">
            {action}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

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
  const showMaintenance = caps.resolve_maintenance;
  const showRope = caps.view_rope_inventory || caps.manage_rope_inventory;

  let ropeCount: number | null = null;
  if (showRope) {
    const { count, error: ropeError } = await supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("kind", "apparatus")
      .eq("tracks_rope_inventory", true);
    if (ropeError && !isMissingRopeInventory(ropeError)) throw ropeError;
    if (!ropeError) ropeCount = count;
  }

  let openMaintenanceCount: number | null = null;
  if (showMaintenance) {
    const { count, error: maintenanceError } = await supabase
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    if (maintenanceError && !isMissingMaintenanceRequestsTable(maintenanceError)) {
      throw maintenanceError;
    }
    if (!maintenanceError) openMaintenanceCount = count;
  }

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
        {(showMaintenance || caps.manage_assets) ? (
          <div className="flex flex-wrap gap-2">
            {showMaintenance ? (
              <Button variant="outline" asChild>
                <Link href="/assets/maintenance">
                  <Wrench className="mr-2 h-4 w-4" />
                  Maintenance requests
                </Link>
              </Button>
            ) : null}
            {caps.manage_assets ? (
              <Button asChild>
                <Link href="/assets/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New asset
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={`grid gap-4 ${showApparatus || showMaintenance || showRope ? "md:grid-cols-2" : ""}`}>
        <AssetSectionCard
          href="/assets/ppe"
          icon={<HardHat className="h-5 w-5" />}
          title="Equipment"
          description={
            caps.view_all_ppe || caps.manage_assets
              ? "Department equipment inventory, assignments, and inspections."
              : "Your assigned equipment."
          }
          meta={`${ppeCount ?? 0} item${(ppeCount ?? 0) === 1 ? "" : "s"}`}
          action="View equipment"
        />

        {showApparatus ? (
          <AssetSectionCard
            href="/assets/apparatus"
            icon={<Truck className="h-5 w-5" />}
            title="Apparatus"
            description="Engines, ladders, ambulances, and other units with daily/weekly vehicle checks."
            meta={`${apparatusCount ?? 0} unit${(apparatusCount ?? 0) === 1 ? "" : "s"}`}
            action="View apparatus"
          />
        ) : null}

        {showMaintenance ? (
          <AssetSectionCard
            href="/assets/maintenance"
            icon={<Wrench className="h-5 w-5" />}
            title="Maintenance requests"
            description="Open work orders for equipment and apparatus."
            meta={`${openMaintenanceCount ?? 0} open`}
            action="View requests"
          />
        ) : null}

        {showRope ? (
          <AssetSectionCard
            href="/assets/rope"
            icon={<Cable className="h-5 w-5" />}
            title="Tech Rescue"
            description="Complement of tech rescue gear on each vehicle, plus the reserve cache."
            meta={ropeCount === null ? "Setup required" : `${ropeCount} apparatus`}
            action="View tech rescue"
          />
        ) : null}
      </div>
    </div>
  );
}
