"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVehicleCheckResponseReturnStatus } from "@/app/assets/vehicle-check-actions";
import { apparatusOptionLabel } from "@/lib/assets-types";
import type {
  VehicleCheckDestination,
  VehicleCheckResponse,
  VehicleCheckWithDetails,
} from "@/lib/vehicle-checks-types";
import {
  formatVehicleCheckResponseValue,
  isUnresolvedVehicleCheckIssue,
} from "@/lib/vehicle-checks-types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export type SwapReturnUnitOption = {
  id: string;
  name: string | null;
  unit_number: string | null;
  build_number: string | null;
};

type SwapResponse = VehicleCheckResponse & {
  return_destination?: VehicleCheckDestination | null;
};

function groupAllResponses(responses: SwapResponse[]) {
  const sorted = [...responses].sort((a, b) => a.sort_order - b.sort_order);
  const groups: Array<{ title: string | null; items: SwapResponse[] }> = [];
  for (const response of sorted) {
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

function statusBadgeVariant(
  response: SwapResponse
): "destructive" | "secondary" | "outline" {
  if (response.field_type === "moved_status") {
    if (response.result === "moved") return "secondary";
    if (response.result === "not_moved") return "destructive";
    return "outline";
  }
  if (isUnresolvedVehicleCheckIssue(response)) return "destructive";
  return "outline";
}

export function VehicleCheckSwapDetail({
  assetId,
  check,
  returnUnits,
  defaultReturnUnitId,
}: {
  assetId: string;
  check: VehicleCheckWithDetails & { responses: SwapResponse[] };
  returnUnits: SwapReturnUnitOption[];
  defaultReturnUnitId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const initialReturnUnitId = useMemo(() => {
    const movedBack = check.responses.find(
      (response) =>
        response.result === "moved" &&
        response.return_status === "moved_back" &&
        response.return_destination_asset_id
    );
    return movedBack?.return_destination_asset_id ?? defaultReturnUnitId;
  }, [check.responses, defaultReturnUnitId]);

  const [returnUnitId, setReturnUnitId] = useState(initialReturnUnitId);

  const groups = useMemo(() => groupAllResponses(check.responses), [check.responses]);
  const hasMovedItems = check.responses.some(
    (response) =>
      response.field_type === "moved_status" && response.result === "moved"
  );

  function setReturnStatus(
    responseId: string,
    returnStatus: "moved_back" | "not_moved_back"
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await setVehicleCheckResponseReturnStatus({
          responseId,
          assetId,
          returnStatus,
          returnDestinationAssetId:
            returnStatus === "moved_back" ? returnUnitId || defaultReturnUnitId : null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update return status");
      }
    });
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {hasMovedItems ? (
        <div className="space-y-2 rounded-md border p-3">
          <FieldLabel htmlFor="return-unit">Moved back to</FieldLabel>
          <Select
            id="return-unit"
            value={returnUnitId}
            disabled={pending || returnUnits.length === 0}
            className="max-w-md"
            onChange={(event) => setReturnUnitId(event.target.value)}
          >
            {returnUnits.length === 0 ? (
              <option value="">No units available</option>
            ) : (
              returnUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {apparatusOptionLabel(unit)}
                </option>
              ))
            )}
          </Select>
          <p className="text-xs text-muted-foreground">
            Applies to every Moved back action on this list.
          </p>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No checklist responses on this swap.</p>
      ) : (
        groups.map((group, index) => (
          <div key={`${group.title ?? "none"}-${index}`} className="space-y-3">
            {group.title ? (
              <h2 className="border-b pb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h2>
            ) : null}
            <ul className="space-y-3">
              {group.items.map((response) => {
                const isMoved =
                  response.field_type === "moved_status" && response.result === "moved";

                return (
                  <li
                    key={response.id}
                    className="space-y-2 rounded-md border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{response.label}</p>
                      {response.notes ? (
                        <p className="text-sm text-muted-foreground">{response.notes}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant={statusBadgeVariant(response)}>
                          {formatVehicleCheckResponseValue(response)}
                        </Badge>
                        {isMoved && response.return_status === "moved_back" ? (
                          <>
                            <Badge variant="secondary">Moved back</Badge>
                            {response.return_destination ? (
                              <span className="text-sm text-muted-foreground">
                                to {apparatusOptionLabel(response.return_destination)}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                        {isMoved && response.return_status === "not_moved_back" ? (
                          <Badge variant="destructive">Not moved back</Badge>
                        ) : null}
                      </div>

                      {isMoved && response.return_status !== "moved_back" ? (
                        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-[#C11B2B] text-white hover:bg-[#C11B2B] hover:text-white"
                            disabled={pending}
                            onClick={() =>
                              setReturnStatus(response.id, "not_moved_back")
                            }
                          >
                            Not moved back
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn(
                              "bg-emerald-700 text-white hover:bg-emerald-700 hover:text-white"
                            )}
                            disabled={pending || !returnUnitId}
                            onClick={() => setReturnStatus(response.id, "moved_back")}
                          >
                            Moved back
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
