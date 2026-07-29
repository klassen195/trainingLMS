"use client";

import { Fragment, useState } from "react";
import type { VehicleCheckWithDetails } from "@/lib/vehicle-checks-types";
import {
  formatVehicleCheckResponseValue,
  isVehicleCheckResponseIssue,
} from "@/lib/vehicle-checks-types";
import { vehicleCheckTypeLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

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

function issueCount(check: VehicleCheckWithDetails) {
  return check.responses.filter((r) => isVehicleCheckResponseIssue(r)).length;
}

function typesLabel(check: VehicleCheckWithDetails) {
  const parts: string[] = [];
  if (check.includes_daily) parts.push(vehicleCheckTypeLabel("daily"));
  if (check.includes_weekly) parts.push(vehicleCheckTypeLabel("weekly"));
  return parts.join(" + ") || "—";
}

export function VehicleCheckHistory({ checks }: { checks: VehicleCheckWithDetails[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                  const issues = issueCount(check);
                  const expanded = expandedId === check.id;
                  return (
                    <Fragment key={check.id}>
                      <tr className="border-b last:border-0">
                        <td className="px-2 py-2 align-top whitespace-nowrap">
                          {formatTimestamp(check.checked_at)}
                        </td>
                        <td className="px-2 py-2 align-top">{typesLabel(check)}</td>
                        <td className="px-2 py-2 align-top">
                          {issues > 0 ? (
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
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedId(expanded ? null : check.id)}
                          >
                            {expanded ? "Hide" : "Details"}
                          </Button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-b bg-muted/30 last:border-0">
                          <td colSpan={6} className="px-2 py-3">
                            <div className="space-y-4">
                              {(() => {
                                const sorted = check.responses
                                  .slice()
                                  .sort((a, b) => a.sort_order - b.sort_order);
                                const groups: Array<{
                                  title: string | null;
                                  items: typeof sorted;
                                }> = [];
                                for (const response of sorted) {
                                  const title = response.section_title ?? null;
                                  const last = groups[groups.length - 1];
                                  if (!last || last.title !== title) {
                                    groups.push({ title, items: [response] });
                                  } else {
                                    last.items.push(response);
                                  }
                                }
                                return groups.map((group, index) => (
                                  <div key={`${group.title ?? "none"}-${index}`} className="space-y-2">
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
                                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                              {vehicleCheckTypeLabel(response.check_type)}
                                            </span>
                                            <p className="font-medium">{response.label}</p>
                                            {response.notes ? (
                                              <p className="text-muted-foreground">{response.notes}</p>
                                            ) : null}
                                          </div>
                                          <Badge
                                            variant={
                                              isVehicleCheckResponseIssue(response)
                                                ? "destructive"
                                                : response.field_type === "pass_fail" &&
                                                    response.result === "pass"
                                                  ? "secondary"
                                                  : "outline"
                                            }
                                          >
                                            {formatVehicleCheckResponseValue(response)}
                                          </Badge>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ));
                              })()}
                            </div>
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
