import Link from "next/link";
import { notFound } from "next/navigation";
import { Wrench } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { ASSET_SELECT, assetDisplayLabel, type Asset } from "@/lib/assets-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingAssetsTable,
  isMissingMaintenanceRequestsTable,
  isMissingVehicleChecksTable,
} from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { MaintenanceRequestForm } from "@/components/MaintenanceRequestForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apparatusTypeLabel, ppeCategoryLabel } from "@/lib/labels";

export default async function NewMaintenanceRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkId?: string }>;
}) {
  await requireCapability("submit_maintenance");
  const { id } = await params;
  const { checkId } = await searchParams;
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

  let vehicleCheckId: string | null = null;
  let initialTitle = "";
  let initialDescription = "";

  if (checkId && row.kind === "apparatus") {
    const { data: check, error: checkError } = await supabase
      .from("vehicle_checks")
      .select("id, asset_id")
      .eq("id", checkId)
      .maybeSingle();

    if (isMissingVehicleChecksTable(checkError) || isMissingMaintenanceRequestsTable(checkError)) {
      // Fall through without linking if tables are missing.
    } else if (checkError) {
      throw checkError;
    } else if (check && check.asset_id === row.id) {
      vehicleCheckId = check.id;

      const { data: responses, error: responsesError } = await supabase
        .from("vehicle_check_responses")
        .select("label, field_type, result, notes")
        .eq("vehicle_check_id", check.id)
        .eq("field_type", "pass_fail")
        .eq("result", "fail")
        .order("sort_order", { ascending: true });

      if (!responsesError && responses && responses.length > 0) {
        const firstLabel = responses[0]?.label?.trim();
        initialTitle =
          responses.length === 1 && firstLabel
            ? `Failed: ${firstLabel}`
            : "Failed vehicle check items";
        initialDescription = responses
          .map((item) => {
            const note = item.notes?.trim();
            return note ? `Failed: ${item.label} — ${note}` : `Failed: ${item.label}`;
          })
          .join("\n");
      }
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Wrench className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Request maintenance</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>{assetDisplayLabel(row)}</span>
            {row.kind === "apparatus" && row.apparatus_type ? (
              <Badge variant="outline">{apparatusTypeLabel(row.apparatus_type)}</Badge>
            ) : null}
            {row.kind === "ppe" && row.ppe_category ? (
              <Badge variant="outline">{ppeCategoryLabel(row.ppe_category)}</Badge>
            ) : null}
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/assets/${row.id}`}>Back</Link>
        </Button>
      </div>

      <MaintenanceRequestForm
        assetId={row.id}
        assetKind={row.kind}
        vehicleCheckId={vehicleCheckId}
        initialTitle={initialTitle}
        initialDescription={initialDescription}
      />
    </div>
  );
}
