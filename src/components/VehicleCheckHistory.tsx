"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveVehicleCheckResponse } from "@/app/assets/vehicle-check-actions";
import { apparatusOptionLabel } from "@/lib/assets-types";
import type {
  VehicleCheckResponse,
  VehicleCheckWithDetails,
} from "@/lib/vehicle-checks-types";
import {
  formatVehicleCheckResponseValue,
  isUnresolvedVehicleCheckIssue,
  isVehicleCheckResponseIssue,
} from "@/lib/vehicle-checks-types";
import { vehicleCheckTypeLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/dates";

function formatPerson(
  person: { display_name: string | null; email: string | null } | null | undefined
) {
  return person?.display_name || person?.email || "Unknown";
}

function unresolvedIssueCount(check: VehicleCheckWithDetails) {
  return check.responses.filter((r) => isUnresolvedVehicleCheckIssue(r)).length;
}

function isSwapReturn(check: VehicleCheckWithDetails) {
  return Boolean(check.parent_vehicle_check_id);
}

function isSwapCheck(check: VehicleCheckWithDetails) {
  return check.template?.checklist_kind === "swap" && !isSwapReturn(check);
}

function typesLabel(check: VehicleCheckWithDetails, viewingAssetId: string) {
  const parts: string[] = [];
  if (isSwapReturn(check)) {
    parts.push("Moved back");
    if (check.swap_destination) {
      parts.push(`→ ${apparatusOptionLabel(check.swap_destination)}`);
    }
    return parts.join(" ");
  }
  if (check.template?.name) parts.push(check.template.name);
  if (check.includes_daily) parts.push(vehicleCheckTypeLabel("daily"));
  if (check.includes_weekly) parts.push(vehicleCheckTypeLabel("weekly"));
  if (check.swap_destination_asset_id === viewingAssetId && check.swap_source) {
    parts.push(`← ${apparatusOptionLabel(check.swap_source)}`);
  } else if (check.swap_destination) {
    parts.push(`→ ${apparatusOptionLabel(check.swap_destination)}`);
  }
  return parts.join(" · ") || "Checklist";
}

function groupIssueResponses(responses: VehicleCheckResponse[]) {
  const issues = responses
    .filter((response) => isVehicleCheckResponseIssue(response))
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const groups: Array<{ title: string | null; items: VehicleCheckResponse[] }> = [];
  for (const response of issues) {
    const title = response.section_title ?? null;
    const last = groups[groups.length - 1];
    if (!last || last.title !== title) {
      groups.push({ title, items: [response] });
    } else {
      last.items.push(response);
    }
  }
  return groups;
}

export function VehicleCheckHistory({
  assetId,
  checks,
}: {
  assetId: string;
  checks: VehicleCheckWithDetails[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vehicle check history</CardTitle>
      </CardHeader>
      <CardContent>
        {checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vehicle checks logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Types</th>
                  <th className="px-2 py-2 font-medium">Issues</th>
                  <th className="px-2 py-2 font-medium">By</th>
                  <th className="px-2 py-2 font-medium">Notes</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => {
                  const issues = unresolvedIssueCount(check);
                  const swap = isSwapCheck(check);
                  const swapReturn = isSwapReturn(check);
                  const detailsCheckId = swapReturn
                    ? check.parent_vehicle_check_id!
                    : check.id;
                  const expanded = !swap && !swapReturn && expandedId === check.id;
                  const issueGroups = groupIssueResponses(check.responses);
                  return (
                    <Fragment key={check.id}>
                      <tr className="border-b last:border-0">
                        <td className="px-2 py-2 align-top whitespace-nowrap">
                          {formatDate(check.checked_at)}
                        </td>
                        <td className="px-2 py-2 align-top">{typesLabel(check, assetId)}</td>
                        <td className="px-2 py-2 align-top">
                          {swap || swapReturn ? (
                            <span className="text-muted-foreground">—</span>
                          ) : issues > 0 ? (
                            <Badge variant="destructive">{issues}</Badge>
                          ) : (
                            <Badge variant="secondary">0</Badge>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top">{formatPerson(check.checker)}</td>
                        <td className="px-2 py-2 align-top text-muted-foreground">
                          {check.notes || "—"}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {swap || swapReturn ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/assets/${assetId}/vehicle-checks/${detailsCheckId}`}>
                                Details
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedId(expanded ? null : check.id)}
                            >
                              {expanded ? "Hide" : "Details"}
                            </Button>
                          )}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-b bg-muted/30 last:border-0">
                          <td colSpan={6} className="px-2 py-3">
                            {issueGroups.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No fails or low levels on this check.
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {error ? (
                                  <p className="text-sm text-destructive">{error}</p>
                                ) : null}
                                {issueGroups.map((group, index) => (
                                  <div
                                    key={`${group.title ?? "none"}-${index}`}
                                    className="space-y-2"
                                  >
                                    {group.title ? (
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {group.title}
                                      </p>
                                    ) : null}
                                    <ul className="space-y-2">
                                      {group.items.map((response) => (
                                        <li
                                          key={response.id}
                                          className="flex flex-wrap items-start justify-between gap-2 text-sm"
                                        >
                                          <div>
                                            {response.check_type ? (
                                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                                {vehicleCheckTypeLabel(response.check_type)}
                                              </span>
                                            ) : null}
                                            <p className="font-medium">{response.label}</p>
                                            {response.notes ? (
                                              <p className="text-muted-foreground">
                                                {response.notes}
                                              </p>
                                            ) : null}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="destructive">
                                              {formatVehicleCheckResponseValue(response)}
                                            </Badge>
                                            {response.resolved_at ? (
                                              <Badge variant="secondary">Resolved</Badge>
                                            ) : (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={pending}
                                                onClick={() => {
                                                  setError(null);
                                                  startTransition(async () => {
                                                    try {
                                                      await resolveVehicleCheckResponse({
                                                        responseId: response.id,
                                                        assetId,
                                                      });
                                                      router.refresh();
                                                    } catch (err) {
                                                      setError(
                                                        err instanceof Error
                                                          ? err.message
                                                          : "Failed to mark resolved"
                                                      );
                                                    }
                                                  });
                                                }}
                                              >
                                                Resolved
                                              </Button>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
