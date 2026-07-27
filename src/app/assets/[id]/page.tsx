import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import {
  ASSET_WITH_ASSIGNEE_SELECT,
  INSPECTION_WITH_INSPECTOR_SELECT,
  type AssetInspectionWithInspector,
  type AssetWithAssignee,
} from "@/lib/assets-types";
import { asSingleProfile } from "@/lib/assets";
import {
  apparatusTypeLabel,
  assetStatusLabel,
  inspectionResultLabel,
  ppeCategoryLabel,
} from "@/lib/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetInspectionForm } from "@/components/AssetInspectionForm";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { DeleteAssetButton } from "@/components/DeleteAssetButton";
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

function formatTimestamp(value: string) {
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

  const { data: inspections, error: inspectionError } = await supabase
    .from("asset_inspections")
    .select(INSPECTION_WITH_INSPECTOR_SELECT)
    .eq("asset_id", id)
    .order("inspected_at", { ascending: false });

  if (isMissingAssetsTable(inspectionError)) return <AssetsDatabaseSetup />;
  if (inspectionError) throw inspectionError;

  const history: AssetInspectionWithInspector[] = ((inspections ?? []) as Record<string, unknown>[]).map(
    (item) => {
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
    }
  );
  const latestNextDue = history[0]?.next_due_on ?? null;
  const listHref = row.kind === "ppe" ? "/assets/ppe" : "/assets/apparatus";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{row.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{assetStatusLabel(row.status)}</Badge>
            <Badge variant="outline">{row.station}</Badge>
            {row.kind === "ppe" && row.ppe_category ? (
              <Badge variant="outline">{ppeCategoryLabel(row.ppe_category)}</Badge>
            ) : null}
            {row.kind === "apparatus" && row.apparatus_type ? (
              <Badge variant="outline">{apparatusTypeLabel(row.apparatus_type)}</Badge>
            ) : null}
            {isPast(latestNextDue) ? (
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
              <DeleteAssetButton assetId={row.id} name={row.name} />
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
                  </>
                ) : (
                  <>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Unit number
                      </dt>
                      <dd className="text-sm">{row.unit_number || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Year</dt>
                      <dd className="text-sm">{row.year ?? "—"}</dd>
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
              </dl>
              {row.notes ? (
                <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{row.notes}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inspection history</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
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
                      {history.map((item) => (
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
        </div>

        {isAdmin ? <AssetInspectionForm assetId={row.id} /> : null}
      </div>
    </div>
  );
}
