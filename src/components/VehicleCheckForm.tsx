"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitVehicleCheck } from "@/app/assets/vehicle-check-actions";
import { apparatusOptionLabel } from "@/lib/assets-types";
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
import { ChevronDown, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export type SwapDestinationOption = {
  id: string;
  name: string | null;
  unit_number: string | null;
  build_number: string | null;
};

function swapOptionLabel(unit: SwapDestinationOption) {
  return apparatusOptionLabel(unit);
}

type ItemState = {
  result: VehicleCheckItemResult | null;
  levelValue: VehicleCheckLevel | null;
  textValue: string;
  notes: string;
};

type AdhocItem = {
  id: string;
  label: string;
  sectionTitle: string | null;
  fieldType: VehicleCheckFieldType;
};

function emptyItemState(_fieldType: VehicleCheckFieldType | null): ItemState {
  return {
    result: null,
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

function itemComplete(
  fieldType: VehicleCheckFieldType | null,
  state: ItemState | undefined
): boolean {
  if (!state || !fieldType) return false;
  if (fieldType === "pass_fail") return state.result === "pass" || state.result === "fail";
  if (fieldType === "moved_status") {
    return (
      state.result === "moved" ||
      state.result === "not_moved" ||
      state.result === "not_applicable"
    );
  }
  if (fieldType === "level") return Boolean(state.levelValue);
  if (fieldType === "short_answer") return Boolean(state.textValue.trim());
  return false;
}

function templateItemComplete(item: VehicleCheckTemplateItem, state: ItemState | undefined) {
  return itemComplete(item.field_type, state);
}

/** Group consecutive short-answer items so they can share a multi-column row. */
function chunkChecklistItems(items: VehicleCheckTemplateItem[]) {
  const chunks: Array<{ kind: "short_row" | "block"; items: VehicleCheckTemplateItem[] }> = [];
  for (const item of items) {
    if (item.field_type === "short_answer") {
      const last = chunks[chunks.length - 1];
      if (last?.kind === "short_row") last.items.push(item);
      else chunks.push({ kind: "short_row", items: [item] });
    } else {
      chunks.push({ kind: "block", items: [item] });
    }
  }
  return chunks;
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
    <div
      className="inline-flex w-28 flex-col overflow-hidden rounded-md border"
      role="group"
      aria-label="Level"
    >
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

function StatusButtons({
  fieldType,
  value,
  disabled,
  onChange,
}: {
  fieldType: "pass_fail" | "moved_status";
  value: VehicleCheckItemResult | null;
  disabled: boolean;
  onChange: (result: VehicleCheckItemResult) => void;
}) {
  const options =
    fieldType === "moved_status"
      ? ([
          { value: "not_applicable", label: "N/A", activeClass: "bg-muted text-foreground" },
          { value: "not_moved", label: "Not moved", activeClass: "bg-[#C11B2B] text-white" },
          {
            value: "moved",
            label: "Moved",
            activeClass: "bg-emerald-700 text-white hover:bg-emerald-700",
          },
        ] as const)
      : ([
          { value: "fail", label: "Fail", activeClass: "bg-[#C11B2B] text-white" },
          {
            value: "pass",
            label: "Pass",
            activeClass: "bg-emerald-700 text-white hover:bg-emerald-700",
          },
        ] as const);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "primary" : "outline"}
          className={cn(value === option.value && option.activeClass)}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function VehicleCheckForm({
  assetId,
  templateId,
  templateName,
  usesDailyWeekly,
  templateItems,
  swapDestinations = [],
}: {
  assetId: string;
  templateId: string;
  templateName: string;
  usesDailyWeekly: boolean;
  templateItems: VehicleCheckTemplateItem[];
  swapDestinations?: SwapDestinationOption[];
}) {
  const router = useRouter();
  const [includesDaily, setIncludesDaily] = useState(usesDailyWeekly);
  const [includesWeekly, setIncludesWeekly] = useState(false);
  const [swapDestinationAssetId, setSwapDestinationAssetId] = useState("");
  const [checkedAt, setCheckedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [itemState, setItemState] = useState<Record<string, ItemState>>(() =>
    emptyState(templateItems)
  );
  const [adhocItems, setAdhocItems] = useState<AdhocItem[]>([]);
  const [addingSectionKey, setAddingSectionKey] = useState<string | null>(null);
  const [newAdhocLabel, setNewAdhocLabel] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultAdhocFieldType: VehicleCheckFieldType = usesDailyWeekly
    ? "pass_fail"
    : "moved_status";

  const includeTypes = useMemo(() => {
    if (!usesDailyWeekly) return undefined;
    const types: VehicleCheckType[] = [];
    if (includesDaily) types.push("daily");
    if (includesWeekly) types.push("weekly");
    return types;
  }, [usesDailyWeekly, includesDaily, includesWeekly]);

  const baseGroups = useMemo(
    () =>
      groupTemplateItemsBySection(templateItems, {
        includeTypes,
        activeOnly: true,
      }),
    [templateItems, includeTypes]
  );

  const groups = useMemo(() => {
    const next = baseGroups.map((group) => ({
      sectionTitle: group.sectionTitle,
      items: [...group.items],
      adhoc: [] as AdhocItem[],
    }));

    // Ensure every adhoc section has a group bucket (including untitled).
    for (const adhoc of adhocItems) {
      let group = next.find((g) => g.sectionTitle === adhoc.sectionTitle);
      if (!group) {
        group = { sectionTitle: adhoc.sectionTitle, items: [], adhoc: [] };
        next.push(group);
      }
      group.adhoc.push(adhoc);
    }
    return next;
  }, [baseGroups, adhocItems]);

  const visibleTemplateItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );

  const frequencyReady = !usesDailyWeekly || includesDaily || includesWeekly;
  const destinationReady = usesDailyWeekly || Boolean(swapDestinationAssetId);
  const mandatoryItems = visibleTemplateItems.filter((item) => item.is_mandatory);
  const allMandatoryComplete = mandatoryItems.every((item) =>
    templateItemComplete(item, itemState[item.id])
  );
  const hasAnyAnswer =
    visibleTemplateItems.some((item) => templateItemComplete(item, itemState[item.id])) ||
    adhocItems.some((item) => itemComplete(item.fieldType, itemState[item.id]));
  const canSubmit =
    frequencyReady &&
    destinationReady &&
    (visibleTemplateItems.length > 0 || adhocItems.length > 0) &&
    allMandatoryComplete &&
    (mandatoryItems.length > 0 || hasAnyAnswer);

  function updateItem(id: string, patch: Partial<ItemState>) {
    setItemState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? emptyItemState(null)),
        ...patch,
      },
    }));
  }

  function toggleSection(key: string) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function sectionProgress(items: VehicleCheckTemplateItem[], adhoc: AdhocItem[]) {
    const templateDone = items.filter((item) =>
      templateItemComplete(item, itemState[item.id])
    ).length;
    const adhocDone = adhoc.filter((item) =>
      itemComplete(item.fieldType, itemState[item.id])
    ).length;
    return `${templateDone + adhocDone}/${items.length + adhoc.length}`;
  }

  function addAdhocItem(sectionTitle: string | null, sectionKey: string) {
    const label = newAdhocLabel.trim();
    if (!label) return;
    const id = `adhoc:${crypto.randomUUID()}`;
    setAdhocItems((prev) => [
      ...prev,
      {
        id,
        label,
        sectionTitle,
        fieldType: defaultAdhocFieldType,
      },
    ]);
    setItemState((prev) => ({
      ...prev,
      [id]: emptyItemState(defaultAdhocFieldType),
    }));
    setNewAdhocLabel("");
    setAddingSectionKey(null);
    setCollapsedSections((prev) => ({ ...prev, [sectionKey]: false }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{templateName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                const responsePayload = [
                  ...visibleTemplateItems.map((item) => ({
                    templateItemId: item.id,
                    result: itemState[item.id]?.result ?? null,
                    levelValue: itemState[item.id]?.levelValue ?? null,
                    textValue: itemState[item.id]?.textValue ?? "",
                    notes: itemState[item.id]?.notes ?? "",
                  })),
                  ...adhocItems.map((item) => ({
                    templateItemId: item.id,
                    adhocLabel: item.label,
                    adhocSectionTitle: item.sectionTitle,
                    adhocFieldType: item.fieldType,
                    result: itemState[item.id]?.result ?? null,
                    levelValue: itemState[item.id]?.levelValue ?? null,
                    textValue: itemState[item.id]?.textValue ?? "",
                    notes: itemState[item.id]?.notes ?? "",
                  })),
                ];

                const { checkId } = await submitVehicleCheck({
                  assetId,
                  templateId,
                  includesDaily: usesDailyWeekly ? includesDaily : false,
                  includesWeekly: usesDailyWeekly ? includesWeekly : false,
                  checkedAt,
                  notes,
                  swapDestinationAssetId: usesDailyWeekly
                    ? null
                    : swapDestinationAssetId || null,
                  responses: responsePayload,
                });

                const hasPassFailFail =
                  visibleTemplateItems.some(
                    (item) =>
                      item.field_type === "pass_fail" &&
                      itemState[item.id]?.result === "fail"
                  ) ||
                  adhocItems.some(
                    (item) =>
                      item.fieldType === "pass_fail" &&
                      itemState[item.id]?.result === "fail"
                  );

                setNotes("");
                setAdhocItems([]);
                setItemState(emptyState(templateItems));

                if (hasPassFailFail) {
                  const startMaintenance = window.confirm(
                    "One or more checklist items failed. Submit a maintenance request?"
                  );
                  if (startMaintenance) {
                    router.push(`/assets/${assetId}/maintenance/new?checkId=${checkId}`);
                    router.refresh();
                    return;
                  }
                }

                router.push(`/assets/${assetId}`);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong.");
              }
            });
          }}
        >
          {usesDailyWeekly ? (
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
          ) : (
            <div className="space-y-2">
              <FieldLabel htmlFor="swap_destination">Swap destination</FieldLabel>
              <Select
                id="swap_destination"
                required
                value={swapDestinationAssetId}
                disabled={pending || swapDestinations.length === 0}
                onChange={(e) => setSwapDestinationAssetId(e.target.value)}
              >
                <option value="">
                  {swapDestinations.length === 0
                    ? "No matching units available"
                    : "Select destination unit"}
                </option>
                {swapDestinations.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {swapOptionLabel(unit)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Units of the same apparatus type as this one.
              </p>
            </div>
          )}

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

          {!frequencyReady ? (
            <p className="text-sm text-muted-foreground">
              Choose Daily Check and/or Weekly Check to continue.
            </p>
          ) : !destinationReady ? (
            <p className="text-sm text-muted-foreground">
              {swapDestinations.length === 0
                ? "No other units of this type are available to select as a destination."
                : "Select a swap destination to continue."}
            </p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No checklist items configured—ask an admin.
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map((group, groupIndex) => {
                const sectionKey = `${group.sectionTitle ?? "none"}-${groupIndex}`;
                const hasSection = Boolean(group.sectionTitle);
                const collapsed = hasSection && Boolean(collapsedSections[sectionKey]);

                return (
                  <div key={sectionKey} className="space-y-3">
                    {hasSection ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 border-b pb-1 text-left"
                        aria-expanded={!collapsed}
                        onClick={() => toggleSection(sectionKey)}
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            collapsed && "-rotate-90"
                          )}
                        />
                        <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                          {group.sectionTitle}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {sectionProgress(group.items, group.adhoc)}
                        </span>
                      </button>
                    ) : null}
                    {!collapsed ? (
                      <div className="space-y-3">
                        {chunkChecklistItems(group.items).map((chunk, chunkIndex) => {
                          if (chunk.kind === "short_row") {
                            return (
                              <ul
                                key={`short-${sectionKey}-${chunkIndex}`}
                                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                              >
                                {chunk.items.map((item) => {
                                  const state =
                                    itemState[item.id] ?? emptyItemState(item.field_type);
                                  return (
                                    <li
                                      key={item.id}
                                      className="space-y-2 rounded-md border p-3"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="min-w-0 text-sm font-medium">{item.label}</p>
                                        {item.check_type ? (
                                          <Badge variant="outline">
                                            {vehicleCheckTypeLabel(item.check_type)}
                                          </Badge>
                                        ) : null}
                                        {item.is_mandatory ? (
                                          <Badge variant="secondary">Required</Badge>
                                        ) : null}
                                      </div>
                                      {item.help_text ? (
                                        <p className="text-xs text-muted-foreground">
                                          {item.help_text}
                                        </p>
                                      ) : null}
                                      <Input
                                        id={`answer-${item.id}`}
                                        aria-label={item.label}
                                        inputMode="numeric"
                                        maxLength={7}
                                        value={state.textValue}
                                        disabled={pending}
                                        className="w-[7.5ch] px-2"
                                        onChange={(e) =>
                                          updateItem(item.id, { textValue: e.target.value })
                                        }
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            );
                          }

                          const item = chunk.items[0]!;
                          const state = itemState[item.id] ?? emptyItemState(item.field_type);
                          return (
                            <div
                              key={item.id}
                              className="space-y-3 rounded-md border p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium">{item.label}</p>
                                  {item.check_type ? (
                                    <Badge variant="outline">
                                      {vehicleCheckTypeLabel(item.check_type)}
                                    </Badge>
                                  ) : null}
                                  {item.is_mandatory ? (
                                    <Badge variant="secondary">Required</Badge>
                                  ) : null}
                                </div>
                                {item.field_type === "pass_fail" ||
                                item.field_type === "moved_status" ? (
                                  <StatusButtons
                                    fieldType={item.field_type}
                                    value={state.result}
                                    disabled={pending}
                                    onChange={(result) => updateItem(item.id, { result })}
                                  />
                                ) : null}
                                {item.field_type === "level" ? (
                                  <LevelGauge
                                    value={state.levelValue}
                                    disabled={pending}
                                    onChange={(level) =>
                                      updateItem(item.id, { levelValue: level })
                                    }
                                  />
                                ) : null}
                              </div>
                              {item.help_text ? (
                                <p className="text-sm text-muted-foreground">{item.help_text}</p>
                              ) : null}

                              {item.field_type !== "short_answer" ? (
                                <div className="space-y-1">
                                  <FieldLabel htmlFor={`notes-${item.id}`}>Notes</FieldLabel>
                                  <Input
                                    id={`notes-${item.id}`}
                                    value={state.notes}
                                    disabled={pending}
                                    placeholder="Optional"
                                    onChange={(e) =>
                                      updateItem(item.id, { notes: e.target.value })
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        {group.adhoc.map((item) => {
                          const state = itemState[item.id] ?? emptyItemState(item.fieldType);
                          return (
                            <div
                              key={item.id}
                              className="space-y-3 rounded-md border border-dashed p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="text-sm font-medium">{item.label}</p>
                                {item.fieldType === "pass_fail" ||
                                item.fieldType === "moved_status" ? (
                                  <StatusButtons
                                    fieldType={item.fieldType}
                                    value={state.result}
                                    disabled={pending}
                                    onChange={(result) => updateItem(item.id, { result })}
                                  />
                                ) : null}
                              </div>
                            </div>
                          );
                        })}

                        {addingSectionKey === sectionKey ? (
                          <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
                            <div className="min-w-[12rem] flex-1 space-y-1">
                              <FieldLabel htmlFor={`adhoc-${sectionKey}`}>New item</FieldLabel>
                              <Input
                                id={`adhoc-${sectionKey}`}
                                value={newAdhocLabel}
                                disabled={pending}
                                autoFocus
                                placeholder="e.g. Extra tool bag"
                                onChange={(e) => setNewAdhocLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addAdhocItem(group.sectionTitle, sectionKey);
                                  }
                                  if (e.key === "Escape") {
                                    setAddingSectionKey(null);
                                    setNewAdhocLabel("");
                                  }
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={pending || !newAdhocLabel.trim()}
                              onClick={() => addAdhocItem(group.sectionTitle, sectionKey)}
                            >
                              Add
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => {
                                setAddingSectionKey(null);
                                setNewAdhocLabel("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => {
                              setAddingSectionKey(sectionKey);
                              setNewAdhocLabel("");
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            Add item
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
            disabled={pending || !canSubmit}
            className="bg-[#C11B2B] text-white"
          >
            {pending ? "Saving..." : "Submit vehicle check"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
