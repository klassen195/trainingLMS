"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitVehicleCheck } from "@/app/assets/vehicle-check-actions";
import type {
  VehicleCheckFieldType,
  VehicleCheckItemResult,
  VehicleCheckLevel,
  VehicleCheckTemplateItem,
  VehicleCheckType,
} from "@/lib/vehicle-checks-types";
import {
  groupTemplateItemsBySection,
  VEHICLE_CHECK_LEVELS,
} from "@/lib/vehicle-checks-types";
import {
  vehicleCheckLevelLabel,
  vehicleCheckTypeLabel,
} from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type ItemState = {
  result: VehicleCheckItemResult | null;
  levelValue: VehicleCheckLevel | null;
  textValue: string;
  notes: string;
};

function emptyItemState(fieldType: VehicleCheckFieldType | null): ItemState {
  return {
    result: fieldType === "pass_fail" ? null : null,
    levelValue: null,
    textValue: "",
    notes: "",
  };
}

function emptyState(items: VehicleCheckTemplateItem[]): Record<string, ItemState> {
  const next: Record<string, ItemState> = {};
  for (const item of items) {
    if (item.row_kind === "item") {
      next[item.id] = emptyItemState(item.field_type);
    }
  }
  return next;
}

function itemComplete(item: VehicleCheckTemplateItem, state: ItemState | undefined): boolean {
  if (!state) return false;
  if (item.field_type === "pass_fail") return state.result === "pass" || state.result === "fail";
  if (item.field_type === "level") return Boolean(state.levelValue);
  if (item.field_type === "short_answer") return Boolean(state.textValue.trim());
  return false;
}

function LevelGauge({
  value,
  disabled,
  onChange,
}: {
  value: VehicleCheckLevel | null;
  disabled: boolean;
  onChange: (level: VehicleCheckLevel) => void;
}) {
  return (
    <div className="inline-flex w-28 flex-col overflow-hidden rounded-md border" role="group" aria-label="Level">
      {VEHICLE_CHECK_LEVELS.map((level, index) => {
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level)}
            className={cn(
              "px-3 py-2 text-center text-sm font-medium transition-colors",
              index > 0 && "border-t",
              selected
                ? "bg-[#C11B2B] text-white"
                : "bg-background text-foreground hover:bg-muted",
              disabled && "opacity-50"
            )}
          >
            {vehicleCheckLevelLabel(level)}
          </button>
        );
      })}
    </div>
  );
}

export function VehicleCheckForm({
  assetId,
  templateItems,
}: {
  assetId: string;
  templateItems: VehicleCheckTemplateItem[];
}) {
  const router = useRouter();
  const [includesDaily, setIncludesDaily] = useState(true);
  const [includesWeekly, setIncludesWeekly] = useState(false);
  const [checkedAt, setCheckedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [itemState, setItemState] = useState<Record<string, ItemState>>(() =>
    emptyState(templateItems)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const includeTypes = useMemo(() => {
    const types: VehicleCheckType[] = [];
    if (includesDaily) types.push("daily");
    if (includesWeekly) types.push("weekly");
    return types;
  }, [includesDaily, includesWeekly]);

  const groups = useMemo(
    () =>
      groupTemplateItemsBySection(templateItems, {
        includeTypes,
        activeOnly: true,
      }),
    [templateItems, includeTypes]
  );

  const visibleItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );

  const allComplete = visibleItems.every((item) => itemComplete(item, itemState[item.id]));

  function updateItem(id: string, patch: Partial<ItemState>) {
    setItemState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? emptyItemState(null)),
        ...patch,
      },
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Start vehicle check</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await submitVehicleCheck({
                  assetId,
                  includesDaily,
                  includesWeekly,
                  checkedAt,
                  notes,
                  responses: visibleItems.map((item) => ({
                    templateItemId: item.id,
                    result: itemState[item.id]?.result ?? null,
                    levelValue: itemState[item.id]?.levelValue ?? null,
                    textValue: itemState[item.id]?.textValue ?? "",
                    notes: itemState[item.id]?.notes ?? "",
                  })),
                });
                setNotes("");
                setItemState(emptyState(templateItems));
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong.");
              }
            });
          }}
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">Check type</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={includesDaily ? "primary" : "outline"}
                className={cn(includesDaily && "bg-[#C11B2B] text-white")}
                disabled={pending}
                onClick={() => setIncludesDaily((v) => !v)}
              >
                Daily Check
              </Button>
              <Button
                type="button"
                variant={includesWeekly ? "primary" : "outline"}
                className={cn(includesWeekly && "bg-[#C11B2B] text-white")}
                disabled={pending}
                onClick={() => setIncludesWeekly((v) => !v)}
              >
                Weekly Check
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Select Daily, Weekly, or both. Matching items appear under their sections.
            </p>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="checked_at">Check date</FieldLabel>
            <Input
              id="checked_at"
              type="date"
              required
              value={checkedAt}
              disabled={pending}
              onChange={(e) => setCheckedAt(e.target.value)}
            />
          </div>

          {!includesDaily && !includesWeekly ? (
            <p className="text-sm text-muted-foreground">
              Choose Daily Check and/or Weekly Check to continue.
            </p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No checklist items configured for the selected type(s)—ask an admin.
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map((group, groupIndex) => (
                <div key={`${group.sectionTitle ?? "none"}-${groupIndex}`} className="space-y-3">
                  {group.sectionTitle ? (
                    <h3 className="border-b pb-1 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                      {group.sectionTitle}
                    </h3>
                  ) : null}
                  <ul className="space-y-3">
                    {group.items.map((item) => {
                      const state = itemState[item.id] ?? emptyItemState(item.field_type);
                      return (
                        <li key={item.id} className="space-y-3 rounded-md border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.check_type ? (
                              <Badge variant="outline">
                                {vehicleCheckTypeLabel(item.check_type)}
                              </Badge>
                            ) : null}
                          </div>
                          {item.help_text ? (
                            <p className="text-sm text-muted-foreground">{item.help_text}</p>
                          ) : null}

                          {item.field_type === "pass_fail" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={state.result === "pass" ? "primary" : "outline"}
                                className={cn(
                                  state.result === "pass" && "bg-emerald-700 text-white hover:bg-emerald-700"
                                )}
                                disabled={pending}
                                onClick={() => updateItem(item.id, { result: "pass" })}
                              >
                                Pass
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={state.result === "fail" ? "primary" : "outline"}
                                className={cn(
                                  state.result === "fail" && "bg-[#C11B2B] text-white"
                                )}
                                disabled={pending}
                                onClick={() => updateItem(item.id, { result: "fail" })}
                              >
                                Fail
                              </Button>
                            </div>
                          ) : null}

                          {item.field_type === "level" ? (
                            <LevelGauge
                              value={state.levelValue}
                              disabled={pending}
                              onChange={(level) => updateItem(item.id, { levelValue: level })}
                            />
                          ) : null}

                          {item.field_type === "short_answer" ? (
                            <div className="space-y-1">
                              <FieldLabel htmlFor={`answer-${item.id}`}>Answer</FieldLabel>
                              <Input
                                id={`answer-${item.id}`}
                                value={state.textValue}
                                disabled={pending}
                                required
                                onChange={(e) =>
                                  updateItem(item.id, { textValue: e.target.value })
                                }
                              />
                            </div>
                          ) : null}

                          {item.field_type !== "short_answer" ? (
                            <div className="space-y-1">
                              <FieldLabel htmlFor={`notes-${item.id}`}>Notes</FieldLabel>
                              <Input
                                id={`notes-${item.id}`}
                                value={state.notes}
                                disabled={pending}
                                placeholder="Optional"
                                onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <FieldLabel htmlFor="vehicle_check_notes">Overall notes</FieldLabel>
            <Textarea
              id="vehicle_check_notes"
              rows={3}
              value={notes}
              disabled={pending}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error ? <FieldError>{error}</FieldError> : null}

          <Button
            type="submit"
            variant="primary"
            disabled={
              pending ||
              (!includesDaily && !includesWeekly) ||
              visibleItems.length === 0 ||
              !allComplete
            }
            className="bg-[#C11B2B] text-white"
          >
            {pending ? "Saving..." : "Submit vehicle check"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
