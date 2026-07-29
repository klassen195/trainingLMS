import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { ASSET_SELECT, type Asset } from "@/lib/assets-types";
import { resolveVehicleCheckTemplate } from "@/lib/vehicle-checks";
import {
  VEHICLE_CHECK_TEMPLATE_ITEM_SELECT,
  type VehicleCheckTemplateItem,
} from "@/lib/vehicle-checks-types";
import { apparatusTypeLabel } from "@/lib/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingAssetsTable,
  isMissingVehicleChecksTable,
} from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { VehicleCheckForm } from "@/components/VehicleCheckForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function VehicleCheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUserProfile();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: asset, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;
  if (!asset) notFound();

  const row = asset as Asset;
  if (row.kind !== "apparatus") {
    redirect(`/assets/${row.id}`);
  }

  const resolved = await resolveVehicleCheckTemplate(supabase, {
    apparatus_type: row.apparatus_type,
    vehicle_check_template_id: row.vehicle_check_template_id,
  });

  if (!resolved) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Vehicle check</h1>
        <p className="text-muted-foreground">
          No checklist assigned for this unit. An admin can set a type default template or assign a
          named template override on Edit.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href={`/assets/${row.id}`}>Back to {row.name}</Link>
        </Button>
      </div>
    );
  }

  const { data: items, error: itemsError } = await supabase
    .from("vehicle_check_template_items")
    .select(VEHICLE_CHECK_TEMPLATE_ITEM_SELECT)
    .eq("template_id", resolved.template.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (isMissingVehicleChecksTable(itemsError)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Vehicle check</h1>
        <p className="text-muted-foreground">
          Vehicle checks are not set up yet. Run the vehicle check migrations in Supabase.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href={`/assets/${row.id}`}>Back</Link>
        </Button>
      </div>
    );
  }
  if (itemsError) throw itemsError;

  const templateItems = (items ?? []) as VehicleCheckTemplateItem[];
  const sourceLabel =
    resolved.source === "override" ? "unit override" : "type default";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Vehicle check</h1>
          </div>
          <p className="text-lg text-muted-foreground">{row.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {row.unit_number ? <Badge variant="outline">{row.unit_number}</Badge> : null}
            {row.apparatus_type ? (
              <Badge variant="outline">{apparatusTypeLabel(row.apparatus_type)}</Badge>
            ) : null}
            <Badge variant="secondary">
              {resolved.template.name} ({sourceLabel})
            </Badge>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/assets/${row.id}`}>Cancel</Link>
        </Button>
      </div>

      {templateItems.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No checklist items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This template has no active items yet. An admin can add them under Manage templates.
            </p>
          </CardContent>
        </Card>
      ) : (
        <VehicleCheckForm assetId={row.id} templateItems={templateItems} />
      )}
    </div>
  );
}
