import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import {
  ASSET_WITH_ASSIGNEE_SELECT,
  INSPECTION_WITH_INSPECTOR_SELECT,
  UNIT_ASSIGNMENT_WITH_ACTOR_SELECT,
  assetDisplayLabel,
  type ApparatusUnitAssignmentWithActor,
  type AssetInspectionWithInspector,
  type AssetWithAssignee,
} from "@/lib/assets-types";
import {
  resolveVehicleCheckTemplates,
  type ResolvedVehicleCheckTemplate,
} from "@/lib/vehicle-checks";
import {
  apparatusTypeLabel,
  assetStatusBadgeClass,
  assetStatusLabel,
  inspectionResultLabel,
  ppeCategoryLabel,
} from "@/lib/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingAssetsTable,
  isMissingVehicleChecksTable,
} from "@/lib/supabase/errors";
import {
  VEHICLE_CHECK_RESPONSE_SELECT,
  VEHICLE_CHECK_WITH_CHECKER_SELECT,
  type VehicleCheckResponse,
  type VehicleCheckWithDetails,
} from "@/lib/vehicle-checks-types";
import { asSingleProfile } from "@/lib/assets";
import { AssetInspectionForm } from "@/components/AssetInspectionForm";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { DeleteAssetButton } from "@/components/DeleteAssetButton";
import { VehicleCheckHistory } from "@/components/VehicleCheckHistory";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

function formatPerson(
  person: { display_name: string | null; email: string | null } | null | undefined
) {
  return person?.display_name || person?.email || "Unknown";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function isPast(date: string | null | undefined) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`) < today;
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUserProfile();
  const isAdmin = profile.role === "admin";
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: asset, error } = await supabase
    .from("assets")
    .select(ASSET_WITH_ASSIGNEE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;
  if (!asset) notFound();

  const raw = asset as Record<string, unknown>;
  const row: AssetWithAssignee = {
    ...(raw as Omit<AssetWithAssignee, "assignee">),
    assignee: asSingleProfile(
      raw.assignee as
        | { id: string; display_name: string | null; email: string | null }
        | { id: string; display_name: string | null; email: string | null }[]
        | null
        | undefined
    ),
  };

  const listHref = row.kind === "ppe" ? "/assets/ppe" : "/assets/apparatus";

  let inspectionHistory: AssetInspectionWithInspector[] = [];
  let latestNextDue: string | null = null;
  let vehicleChecks: VehicleCheckWithDetails[] = [];
  let latestDailyAt: string | null = null;
  let latestWeeklyAt: string | null = null;
  let resolvedChecklists: ResolvedVehicleCheckTemplate[] = [];
  let unitAssignments: ApparatusUnitAssignmentWithActor[] = [];

  if (row.kind === "ppe") {
    const { data: inspections, error: inspectionError } = await supabase
      .from("asset_inspections")
      .select(INSPECTION_WITH_INSPECTOR_SELECT)
      .eq("asset_id", id)
      .order("inspected_at", { ascending: false });

    if (isMissingAssetsTable(inspectionError)) return <AssetsDatabaseSetup />;
    if (inspectionError) throw inspectionError;

    inspectionHistory = ((inspections ?? []) as Record<string, unknown>[]).map((item) => {
      const { inspector, ...rest } = item;
      return {
        ...(rest as Omit<AssetInspectionWithInspector, "inspector">),
        inspector: asSingleProfile(
          inspector as
            | { id: string; display_name: string | null; email: string | null }
            | { id: string; display_name: string | null; email: string | null }[]
            | null
            | undefined
        ),
      };
    });
    latestNextDue = inspectionHistory[0]?.next_due_on ?? null;
  } else {
    const checksResult = await supabase
      .from("vehicle_checks")
      .select(VEHICLE_CHECK_WITH_CHECKER_SELECT)
      .or(`asset_id.eq.${id},swap_destination_asset_id.eq.${id}`)
      .order("checked_at", { ascending: false });

    if (isMissingVehicleChecksTable(checksResult.error)) {
      return (
        <div className="container mx-auto max-w-3xl px-4 py-8">
          <h1 className="mb-2 text-3xl font-bold">{assetDisplayLabel(row)}</h1>
          <p className="text-muted-foreground">
            Vehicle checks are not set up yet. Run the vehicle check migrations in Supabase.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href={listHref}>Back</Link>
          </Button>
        </div>
      );
    }
    if (checksResult.error) throw checksResult.error;

    const resolved = await resolveVehicleCheckTemplates(supabase, {
      id: row.id,
      apparatus_type: row.apparatus_type,
    });
    resolvedChecklists = resolved;

    const checkRows = ((checksResult.data ?? []) as Record<string, unknown>[]).map((item) => {
      const { checker, template, swap_source, swap_destination, ...rest } = item;
      return {
        ...(rest as Omit<
          VehicleCheckWithDetails,
          "checker" | "template" | "swap_source" | "swap_destination" | "responses"
        >),
        checker: asSingleProfile(
          checker as
            | { id: string; display_name: string | null; email: string | null }
            | { id: string; display_name: string | null; email: string | null }[]
            | null
            | undefined
        ),
        template: (Array.isArray(template)
          ? template[0] ?? null
          : template ?? null) as {
          id: string;
          name: string;
          checklist_kind?: "check" | "swap";
        } | null,
        swap_source: (Array.isArray(swap_source)
          ? swap_source[0] ?? null
          : swap_source ?? null) as {
          id: string;
          name: string | null;
          unit_number: string | null;
          build_number: string | null;
        } | null,
        swap_destination: (Array.isArray(swap_destination)
          ? swap_destination[0] ?? null
          : swap_destination ?? null) as {
          id: string;
          name: string | null;
          unit_number: string | null;
          build_number: string | null;
        } | null,
        responses: [] as VehicleCheckResponse[],
      };
    });

    const checkIds = checkRows.map((c) => c.id);
    if (checkIds.length > 0) {
      const { data: responses, error: responsesError } = await supabase
        .from("vehicle_check_responses")
        .select(VEHICLE_CHECK_RESPONSE_SELECT)
        .in("vehicle_check_id", checkIds)
        .order("sort_order", { ascending: true });

      if (responsesError) throw responsesError;

      const byCheck = new Map<string, VehicleCheckResponse[]>();
      for (const response of (responses ?? []) as VehicleCheckResponse[]) {
        const list = byCheck.get(response.vehicle_check_id) ?? [];
        list.push(response);
        byCheck.set(response.vehicle_check_id, list);
      }

      vehicleChecks = checkRows.map((check) => ({
        ...check,
        responses: byCheck.get(check.id) ?? [],
      }));
    } else {
      vehicleChecks = checkRows;
    }

    for (const check of vehicleChecks) {
      // Incoming swaps on this unit shouldn't drive daily/weekly "last checked" stamps.
      if (check.asset_id !== row.id) continue;
      if (check.includes_daily && !latestDailyAt) latestDailyAt = check.checked_at;
      if (check.includes_weekly && !latestWeeklyAt) latestWeeklyAt = check.checked_at;
      if (latestDailyAt && latestWeeklyAt) break;
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from("apparatus_unit_assignments")
      .select(UNIT_ASSIGNMENT_WITH_ACTOR_SELECT)
      .eq("asset_id", id)
      .order("assigned_at", { ascending: false });

    if (assignmentsError && !isMissingAssetsTable(assignmentsError)) {
      // Table may not exist until migration is applied; ignore missing-table soft fail via message
      if (!assignmentsError.message.includes("apparatus_unit_assignments")) {
        throw assignmentsError;
      }
    } else if (!assignmentsError) {
      unitAssignments = ((assignments ?? []) as Record<string, unknown>[]).map((item) => {
        const { actor, ...rest } = item;
        return {
          ...(rest as Omit<ApparatusUnitAssignmentWithActor, "actor">),
          actor: asSingleProfile(
            actor as
              | { id: string; display_name: string | null; email: string | null }
              | { id: string; display_name: string | null; email: string | null }[]
              | null
              | undefined
          ),
        };
      });
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{assetDisplayLabel(row)}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={assetStatusBadgeClass(row.status)}>
              {assetStatusLabel(row.status)}
            </Badge>
            {row.station ? <Badge variant="outline">{row.station}</Badge> : null}
            {row.kind === "ppe" && row.ppe_category ? (
              <Badge variant="outline">{ppeCategoryLabel(row.ppe_category)}</Badge>
            ) : null}
            {row.kind === "apparatus" && row.apparatus_type ? (
              <Badge variant="outline">{apparatusTypeLabel(row.apparatus_type)}</Badge>
            ) : null}
            {row.kind === "apparatus" && row.unit_number && row.build_number ? (
              <Badge variant="outline">{row.build_number}</Badge>
            ) : null}
            {row.kind === "ppe" && isPast(latestNextDue) ? (
              <Badge variant="destructive">Inspection overdue</Badge>
            ) : null}
            {row.kind === "ppe" && isPast(row.expires_on) ? (
              <Badge variant="destructive">Expired</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={listHref}>Back</Link>
          </Button>
          {isAdmin ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`/assets/${row.id}/edit`}>Edit</Link>
              </Button>
              <DeleteAssetButton assetId={row.id} label={assetDisplayLabel(row)} />
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                {row.kind === "ppe" ? (
                  <>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Assigned to
                      </dt>
                      <dd className="text-sm">{formatPerson(row.assignee)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Size</dt>
                      <dd className="text-sm">{row.size || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Manufactured
                      </dt>
                      <dd className="text-sm">{formatDate(row.manufactured_on)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Expires
                      </dt>
                      <dd
                        className={cn(
                          "text-sm",
                          isPast(row.expires_on) && "font-medium text-destructive"
                        )}
                      >
                        {formatDate(row.expires_on)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Next inspection due
                      </dt>
                      <dd
                        className={cn(
                          "text-sm",
                          isPast(latestNextDue) && "font-medium text-destructive"
                        )}
                      >
                        {formatDate(latestNextDue)}
                      </dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Build number
                      </dt>
                      <dd className="text-sm">{row.build_number || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Current unit
                      </dt>
                      <dd className="text-sm">{row.unit_number || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Year</dt>
                      <dd className="text-sm">{row.year ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Last daily check
                      </dt>
                      <dd className="text-sm">{formatTimestamp(latestDailyAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Last weekly check
                      </dt>
                      <dd className="text-sm">{formatTimestamp(latestWeeklyAt)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Checklists
                      </dt>
                      <dd className="text-sm">
                        {resolvedChecklists.length === 0
                          ? "No checklist assigned"
                          : resolvedChecklists
                              .map(
                                (item) =>
                                  `${item.template.name} (${
                                    item.source === "unit" ? "build list" : "type default"
                                  })`
                              )
                              .join(", ")}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Manufacturer
                  </dt>
                  <dd className="text-sm">{row.manufacturer || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Model</dt>
                  <dd className="text-sm">{row.model || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Serial number
                  </dt>
                  <dd className="text-sm">{row.serial_number || "—"}</dd>
                </div>
              </dl>
              {row.notes ? (
                <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{row.notes}</p>
              ) : null}
            </CardContent>
          </Card>

          {row.kind === "ppe" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inspection history</CardTitle>
              </CardHeader>
              <CardContent>
                {inspectionHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No inspections logged yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Date</th>
                          <th className="px-2 py-2 font-medium">Result</th>
                          <th className="px-2 py-2 font-medium">Next due</th>
                          <th className="px-2 py-2 font-medium">By</th>
                          <th className="px-2 py-2 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspectionHistory.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="px-2 py-2 align-top whitespace-nowrap">
                              {formatTimestamp(item.inspected_at)}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <Badge
                                variant={
                                  item.result === "pass"
                                    ? "secondary"
                                    : item.result === "fail"
                                      ? "destructive"
                                      : "outline"
                                }
                              >
                                {inspectionResultLabel(item.result)}
                              </Badge>
                            </td>
                            <td
                              className={cn(
                                "px-2 py-2 align-top whitespace-nowrap",
                                isPast(item.next_due_on) && "text-destructive"
                              )}
                            >
                              {formatDate(item.next_due_on)}
                            </td>
                            <td className="px-2 py-2 align-top">{formatPerson(item.inspector)}</td>
                            <td className="px-2 py-2 align-top text-muted-foreground">
                              {item.notes || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <VehicleCheckHistory assetId={row.id} checks={vehicleChecks} />
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Unit assignment history</CardTitle>
                  <p className="text-sm font-normal text-muted-foreground">
                    Call signs that have been assigned to this apparatus. An open row means that
                    unit is still on this build.
                  </p>
                </CardHeader>
                <CardContent>
                  {unitAssignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No unit numbers have been assigned to this apparatus yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[320px] text-left text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="px-2 py-2 font-medium">Unit</th>
                            <th className="px-2 py-2 font-medium">From</th>
                            <th className="px-2 py-2 font-medium">To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unitAssignments.map((item) => (
                            <tr key={item.id} className="border-b last:border-0">
                              <td className="px-2 py-2 align-top font-medium">{item.unit_number}</td>
                              <td className="px-2 py-2 align-top whitespace-nowrap">
                                {formatDate(item.assigned_at)}
                              </td>
                              <td className="px-2 py-2 align-top whitespace-nowrap">
                                {item.unassigned_at ? (
                                  formatDate(item.unassigned_at)
                                ) : (
                                  <Badge variant="secondary">Still assigned</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {row.kind === "ppe" ? (
          isAdmin ? (
            <AssetInspectionForm assetId={row.id} />
          ) : null
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vehicle checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resolvedChecklists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No checklist assigned for this build. An admin can set type defaults or assign
                  named templates on Edit.
                </p>
              ) : (
                resolvedChecklists.map((item) => (
                  <Button
                    key={item.template.id}
                    variant="primary"
                    asChild
                    className="w-full bg-[#C11B2B] text-white"
                  >
                    <Link href={`/assets/${row.id}/vehicle-check/${item.template.id}`}>
                      {item.template.name}
                    </Link>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
