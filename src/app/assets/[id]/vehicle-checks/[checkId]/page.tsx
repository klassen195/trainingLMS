import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import {
  ASSET_SELECT,
  apparatusOptionLabel,
  assetDisplayLabel,
  type Asset,
} from "@/lib/assets-types";
import {
  VEHICLE_CHECK_RESPONSE_WITH_RETURN_DEST_SELECT,
  VEHICLE_CHECK_WITH_CHECKER_SELECT,
  type VehicleCheckDestination,
  type VehicleCheckResponse,
  type VehicleCheckWithDetails,
} from "@/lib/vehicle-checks-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingAssetsTable,
  isMissingVehicleChecksTable,
} from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { VehicleCheckSwapDetail } from "@/components/VehicleCheckSwapDetail";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatPerson(
  person: { display_name: string | null; email: string | null } | null | undefined
) {
  return person?.display_name || person?.email || "Unknown";
}

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default async function VehicleCheckDetailPage({
  params,
}: {
  params: Promise<{ id: string; checkId: string }>;
}) {
  await requireUserProfile();
  const { id, checkId } = await params;
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

  const { data: checkRow, error: checkError } = await supabase
    .from("vehicle_checks")
    .select(VEHICLE_CHECK_WITH_CHECKER_SELECT)
    .eq("id", checkId)
    .or(`asset_id.eq.${row.id},swap_destination_asset_id.eq.${row.id}`)
    .maybeSingle();

  if (isMissingVehicleChecksTable(checkError)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Swap details</h1>
        <p className="text-muted-foreground">
          Vehicle checks are not set up yet. Run the vehicle check migrations in Supabase.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href={`/assets/${row.id}`}>Back</Link>
        </Button>
      </div>
    );
  }
  if (checkError) throw checkError;
  if (!checkRow) notFound();

  const template = asSingle(
    checkRow.template as
      | { id: string; name: string; checklist_kind?: string }
      | { id: string; name: string; checklist_kind?: string }[]
      | null
  );

  if (template?.checklist_kind !== "swap") {
    redirect(`/assets/${row.id}`);
  }

  const parentId = (checkRow as { parent_vehicle_check_id?: string | null })
    .parent_vehicle_check_id;
  if (parentId) {
    redirect(`/assets/${row.id}/vehicle-checks/${parentId}`);
  }

  const { data: responses, error: responsesError } = await supabase
    .from("vehicle_check_responses")
    .select(VEHICLE_CHECK_RESPONSE_WITH_RETURN_DEST_SELECT)
    .eq("vehicle_check_id", checkId)
    .order("sort_order", { ascending: true });

  if (responsesError) throw responsesError;

  const mappedResponses = ((responses ?? []) as Record<string, unknown>[]).map((item) => {
    const { return_destination, ...rest } = item;
    return {
      ...(rest as VehicleCheckResponse),
      return_destination: asSingle(
        return_destination as
          | VehicleCheckDestination
          | VehicleCheckDestination[]
          | null
          | undefined
      ),
    };
  });

  const check: VehicleCheckWithDetails = {
    ...(checkRow as unknown as Omit<
      VehicleCheckWithDetails,
      "checker" | "template" | "swap_source" | "swap_destination" | "responses"
    >),
    checker: asSingle(
      checkRow.checker as
        | { id: string; display_name: string | null; email: string | null }
        | { id: string; display_name: string | null; email: string | null }[]
        | null
    ),
    template: template as { id: string; name: string; checklist_kind?: "check" | "swap" },
    swap_source: asSingle(
      checkRow.swap_source as
        | VehicleCheckDestination
        | VehicleCheckDestination[]
        | null
    ),
    swap_destination: asSingle(
      checkRow.swap_destination as
        | VehicleCheckDestination
        | VehicleCheckDestination[]
        | null
    ),
    responses: mappedResponses,
  };

  const viewingAsDestination = check.swap_destination_asset_id === row.id;
  const defaultReturnUnitId = check.asset_id;

  let returnUnitsQuery = supabase
    .from("assets")
    .select("id, name, unit_number, build_number")
    .eq("kind", "apparatus")
    .order("unit_number", { ascending: true })
    .order("build_number", { ascending: true });

  // Prefer units matching the source apparatus type when available.
  const sourceTypeQuery = await supabase
    .from("assets")
    .select("apparatus_type")
    .eq("id", check.asset_id)
    .maybeSingle();
  const sourceType = sourceTypeQuery.data?.apparatus_type ?? row.apparatus_type;
  if (sourceType) {
    returnUnitsQuery = returnUnitsQuery.eq("apparatus_type", sourceType);
  }

  const { data: returnUnits, error: returnUnitsError } = await returnUnitsQuery;
  if (returnUnitsError) throw returnUnitsError;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">
              {check.template?.name ?? "Swap checklist"}
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">{assetDisplayLabel(row)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">Swap</Badge>
            {viewingAsDestination && check.swap_source ? (
              <Badge variant="outline">
                ← {apparatusOptionLabel(check.swap_source)}
              </Badge>
            ) : check.swap_destination ? (
              <Badge variant="outline">
                → {apparatusOptionLabel(check.swap_destination)}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatTimestamp(check.checked_at)} · {formatPerson(check.checker)}
          </p>
          {check.notes ? (
            <p className="mt-2 text-sm text-muted-foreground">{check.notes}</p>
          ) : null}
        </div>
        <Button variant="outline" asChild>
          <Link href={`/assets/${row.id}`}>Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Swap items</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleCheckSwapDetail
            assetId={row.id}
            check={check}
            returnUnits={returnUnits ?? []}
            defaultReturnUnitId={defaultReturnUnitId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
