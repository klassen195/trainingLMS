"use client";

import {
  assignmentRemainingMs,
  formatRemaining,
  incidentUnitKindLabel,
  unitDisplayLabel,
  type IncidentAssignment,
  type IncidentOrgNode,
  type IncidentUnit,
} from "@/lib/incident-types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function IncidentAssignmentClock({
  now,
  assignments,
  unitsById,
  orgById,
  pending,
  onRenew,
  onRelease,
}: {
  now: number | null;
  assignments: IncidentAssignment[];
  unitsById: Map<string, IncidentUnit>;
  orgById: Map<string, IncidentOrgNode>;
  pending: boolean;
  onRenew: (assignmentId: string) => void;
  onRelease: (assignmentId: string) => void;
}) {
  const clock = now ?? 0;
  const sorted = [...assignments].sort((a, b) => {
    return assignmentRemainingMs(a, clock) - assignmentRemainingMs(b, clock);
  });

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-l bg-muted/20 p-3">
      <h2 className="mb-2 text-sm font-semibold">Assignment clock</h2>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Sorted by time remaining. Overdue units show in red.
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active assignments.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((assignment) => {
            const unit = unitsById.get(assignment.unit_id);
            const org = orgById.get(assignment.org_node_id);
            const remaining = now == null ? null : assignmentRemainingMs(assignment, now);
            const overdue = remaining != null && remaining < 0;
            const warn = remaining != null && !overdue && remaining < 5 * 60_000;

            return (
              <li
                key={assignment.id}
                className={cn(
                  "rounded-md border bg-background p-2",
                  overdue && "border-destructive/60 bg-destructive/5",
                  warn && "border-amber-500/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {unit ? unitDisplayLabel(unit) : "Unit"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {[org?.name, unit ? incidentUnitKindLabel(unit.unit_type) : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 font-mono text-sm font-bold tabular-nums",
                      overdue ? "text-destructive" : warn ? "text-amber-700" : "text-foreground"
                    )}
                    suppressHydrationWarning
                  >
                    {remaining == null ? "--:--" : formatRemaining(remaining)}
                  </p>
                </div>
                <div className="mt-2 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                    disabled={pending}
                    onClick={() => onRenew(assignment.id)}
                  >
                    Renew
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 flex-1 text-xs"
                    disabled={pending}
                    onClick={() => onRelease(assignment.id)}
                  >
                    Release
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
