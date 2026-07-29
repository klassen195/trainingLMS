"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  createVehicleCheckTemplateItem,
  createVehicleCheckTemplateSection,
  deleteVehicleCheckTemplateItem,
  reorderVehicleCheckTemplateItems,
  setVehicleCheckTemplateItemActive,
  setVehicleCheckTemplateItemMandatory,
  updateVehicleCheckTemplateItem,
} from "@/app/assets/vehicle-check-actions";
import type {
  VehicleCheckFieldType,
  VehicleCheckTemplateItem,
  VehicleCheckType,
} from "@/lib/vehicle-checks-types";
import {
  defaultFieldTypeForChecklistKind,
  fieldTypesForChecklistKind,
  vehicleCheckFieldTypeLabel,
  vehicleCheckTypeLabel,
  vehicleCheckTypes,
} from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

function visibleTemplateRows(
  items: VehicleCheckTemplateItem[],
  collapsedSectionIds: Record<string, boolean>
): VehicleCheckTemplateItem[] {
  const visible: VehicleCheckTemplateItem[] = [];
  let hideItems = false;
  for (const item of items) {
    if (item.row_kind === "section") {
      hideItems = Boolean(collapsedSectionIds[item.id]);
      visible.push(item);
      continue;
    }
    if (!hideItems) visible.push(item);
  }
  return visible;
}

function applyVisibleReorder(
  full: VehicleCheckTemplateItem[],
  reorderedVisible: VehicleCheckTemplateItem[]
): VehicleCheckTemplateItem[] {
  const visibleIds = new Set(reorderedVisible.map((item) => item.id));
  const queue = [...reorderedVisible];
  return full.map((item) => {
    if (!visibleIds.has(item.id)) return item;
    return queue.shift()!;
  });
}

function sectionItemCount(items: VehicleCheckTemplateItem[], sectionId: string): number {
  const start = items.findIndex((item) => item.id === sectionId);
  if (start === -1) return 0;
  let count = 0;
  for (let i = start + 1; i < items.length; i += 1) {
    if (items[i].row_kind === "section") break;
    count += 1;
  }
  return count;
}

function SortableTemplateRow({
  item,
  checklistIsCheck,
  collapsed,
  itemCount,
  pending,
  startTransition,
  onError,
  onToggleCollapse,
}: {
  item: VehicleCheckTemplateItem;
  checklistIsCheck: boolean;
  collapsed?: boolean;
  itemCount?: number;
  pending: boolean;
  startTransition: (action: () => void) => void;
  onError: (message: string | null) => void;
  onToggleCollapse?: () => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const isSection = item.row_kind === "section";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border p-3",
        isSection
          ? "border-emerald-600/30 bg-emerald-600/10 shadow-sm"
          : "border-border bg-card",
        isDragging && "z-10 opacity-80 shadow-lg"
      )}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab touch-none items-center self-stretch px-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${item.label}`}
        disabled={pending}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {isSection ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex shrink-0 items-center text-muted-foreground hover:text-foreground"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand section" : "Collapse section"}
            disabled={pending}
            onClick={onToggleCollapse}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                collapsed && "-rotate-90"
              )}
            />
          </button>
          <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">Section</Badge>
          <Input
            defaultValue={item.label}
            disabled={pending}
            className={cn("min-w-[12rem] flex-1 font-semibold", !item.is_active && "opacity-60")}
            onBlur={(event) => {
              const nextLabel = event.target.value.trim();
              if (!nextLabel || nextLabel === item.label) return;
              startTransition(async () => {
                onError(null);
                try {
                  await updateVehicleCheckTemplateItem({
                    id: item.id,
                    label: nextLabel,
                  });
                  router.refresh();
                } catch (err) {
                  onError(err instanceof Error ? err.message : "Failed to update section");
                }
              });
            }}
          />
          {typeof itemCount === "number" ? (
            <span className="text-xs text-muted-foreground">{itemCount} items</span>
          ) : null}
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
          <div className="min-w-[12rem] flex-1 space-y-2">
            <Input
              defaultValue={item.label}
              disabled={pending}
              className={cn(!item.is_active && "opacity-60")}
              onBlur={(event) => {
                const nextLabel = event.target.value.trim();
                if (!nextLabel || nextLabel === item.label) return;
                startTransition(async () => {
                  onError(null);
                  try {
                    await updateVehicleCheckTemplateItem({
                      id: item.id,
                      label: nextLabel,
                      helpText: item.help_text,
                      checkType: checklistIsCheck ? (item.check_type ?? "daily") : null,
                      fieldType: item.field_type ?? "pass_fail",
                    });
                    router.refresh();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : "Failed to update item");
                  }
                });
              }}
            />
            <Input
              defaultValue={item.help_text}
              disabled={pending}
              placeholder="Optional help text"
              className={cn("text-muted-foreground", !item.is_active && "opacity-60")}
              onBlur={(event) => {
                const nextHelp = event.target.value.trim();
                if (nextHelp === (item.help_text ?? "").trim()) return;
                startTransition(async () => {
                  onError(null);
                  try {
                    await updateVehicleCheckTemplateItem({
                      id: item.id,
                      label: item.label,
                      helpText: nextHelp,
                      checkType: checklistIsCheck ? (item.check_type ?? "daily") : null,
                      fieldType: item.field_type ?? "pass_fail",
                    });
                    router.refresh();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : "Failed to update help text");
                  }
                });
              }}
            />
          </div>
          {checklistIsCheck ? (
            <Select
              value={item.check_type ?? "daily"}
              disabled={pending}
              className="w-[8.5rem]"
              onChange={(event) => {
                const checkType = event.target.value as VehicleCheckType;
                if (checkType === item.check_type) return;
                startTransition(async () => {
                  onError(null);
                  try {
                    await updateVehicleCheckTemplateItem({
                      id: item.id,
                      label: item.label,
                      helpText: item.help_text,
                      checkType,
                      fieldType: item.field_type ?? "pass_fail",
                    });
                    router.refresh();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : "Failed to update type");
                  }
                });
              }}
            >
              {vehicleCheckTypes.map((type) => (
                <option key={type} value={type}>
                  {vehicleCheckTypeLabel(type)}
                </option>
              ))}
            </Select>
          ) : null}
          <Select
            value={
              item.field_type ??
              (checklistIsCheck ? "pass_fail" : "moved_status")
            }
            disabled={pending}
            className="w-[9.5rem]"
            onChange={(event) => {
              const fieldType = event.target.value as VehicleCheckFieldType;
              if (fieldType === item.field_type) return;
              startTransition(async () => {
                onError(null);
                try {
                  await updateVehicleCheckTemplateItem({
                    id: item.id,
                    label: item.label,
                    helpText: item.help_text,
                    checkType: checklistIsCheck ? (item.check_type ?? "daily") : null,
                    fieldType,
                  });
                  router.refresh();
                } catch (err) {
                  onError(err instanceof Error ? err.message : "Failed to update field type");
                }
              });
            }}
          >
            {fieldTypesForChecklistKind(checklistIsCheck ? "check" : "swap").map((type) => (
              <option key={type} value={type}>
                {vehicleCheckFieldTypeLabel(type)}
              </option>
            ))}
          </Select>
        </div>
      )}

      {!item.is_active ? <Badge variant="outline">Inactive</Badge> : null}

      <div className="flex flex-wrap items-center gap-2">
        {!isSection ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.is_mandatory}
              disabled={pending}
              onChange={(event) =>
                startTransition(async () => {
                  onError(null);
                  try {
                    await setVehicleCheckTemplateItemMandatory({
                      id: item.id,
                      isMandatory: event.target.checked,
                    });
                    router.refresh();
                  } catch (err) {
                    onError(
                      err instanceof Error ? err.message : "Failed to update mandatory setting"
                    );
                  }
                })
              }
            />
            Mandatory
          </label>
        ) : null}
        <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              onError(null);
              try {
                await setVehicleCheckTemplateItemActive({
                  id: item.id,
                  isActive: !item.is_active,
                });
                router.refresh();
              } catch (err) {
                onError(err instanceof Error ? err.message : "Failed to update status");
              }
            })
          }
        >
          {item.is_active ? (
            "Deactivate"
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />
              Reactivate
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              onError(null);
              try {
                await deleteVehicleCheckTemplateItem(item.id);
                router.refresh();
              } catch (err) {
                onError(err instanceof Error ? err.message : "Failed to delete");
              }
            })
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        </div>
      </div>
    </li>
  );
}

export function VehicleCheckTemplateEditor({
  templateId,
  checklistIsCheck,
  items,
}: {
  templateId: string;
  checklistIsCheck: boolean;
  items: VehicleCheckTemplateItem[];
}) {
  const router = useRouter();
  const [orderedItems, setOrderedItems] = useState(() =>
    [...items].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemHelpText, setNewItemHelpText] = useState("");
  const [newItemType, setNewItemType] = useState<VehicleCheckType>("daily");
  const [newItemFieldType, setNewItemFieldType] = useState<VehicleCheckFieldType>(
    defaultFieldTypeForChecklistKind(checklistIsCheck ? "check" : "swap")
  );
  const [newItemMandatory, setNewItemMandatory] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrderedItems([...items].sort((a, b) => a.sort_order - b.sort_order));
  }, [items]);

  useEffect(() => {
    setNewItemFieldType(defaultFieldTypeForChecklistKind(checklistIsCheck ? "check" : "swap"));
  }, [checklistIsCheck]);

  const visibleItems = useMemo(
    () => visibleTemplateRows(orderedItems, collapsedSections),
    [orderedItems, collapsedSections]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleItems.findIndex((item) => item.id === active.id);
    const newIndex = visibleItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextVisible = arrayMove(visibleItems, oldIndex, newIndex);
    const next = applyVisibleReorder(orderedItems, nextVisible);
    setOrderedItems(next);

    startTransition(async () => {
      setError(null);
      try {
        await reorderVehicleCheckTemplateItems({
          templateId,
          orderedIds: next.map((item) => item.id),
        });
        router.refresh();
      } catch (err) {
        setOrderedItems([...items].sort((a, b) => a.sort_order - b.sort_order));
        setError(err instanceof Error ? err.message : "Failed to reorder");
      }
    });
  }

  function toggleSectionCollapsed(sectionId: string) {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Checklist template</h2>
        <p className="text-sm text-muted-foreground">
          Build the list on the left. Add sections inline, and use the card on the right for new
          checklist items. Drag handles to reorder.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {orderedItems.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No rows yet. Add a section below or a checklist item on the right.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {pending ? "Saving order..." : "Drag rows to reorder."}
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={visibleItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-3">
                    {visibleItems.map((item) => (
                      <SortableTemplateRow
                        key={item.id}
                        item={item}
                        checklistIsCheck={checklistIsCheck}
                        collapsed={
                          item.row_kind === "section"
                            ? Boolean(collapsedSections[item.id])
                            : undefined
                        }
                        itemCount={
                          item.row_kind === "section"
                            ? sectionItemCount(orderedItems, item.id)
                            : undefined
                        }
                        pending={pending}
                        startTransition={startTransition}
                        onError={setError}
                        onToggleCollapse={
                          item.row_kind === "section"
                            ? () => toggleSectionCollapsed(item.id)
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {addingSection ? (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newSectionTitle.trim()) return;
                startTransition(async () => {
                  setError(null);
                  try {
                    await createVehicleCheckTemplateSection({
                      templateId,
                      label: newSectionTitle.trim(),
                    });
                    setNewSectionTitle("");
                    setAddingSection(false);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to add section");
                  }
                });
              }}
            >
              <div className="min-w-[12rem] flex-1 space-y-1">
                <FieldLabel htmlFor="new-section-title">Section title</FieldLabel>
                <Input
                  id="new-section-title"
                  placeholder="e.g. Exterior"
                  value={newSectionTitle}
                  disabled={pending}
                  autoFocus
                  onChange={(event) => setNewSectionTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setAddingSection(false);
                      setNewSectionTitle("");
                    }
                  }}
                />
              </div>
              <Button type="submit" size="sm" disabled={pending || !newSectionTitle.trim()}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setAddingSection(false);
                  setNewSectionTitle("");
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              onClick={() => setAddingSection(true)}
            >
              <Plus className="h-4 w-4" />
              Add section
            </button>
          )}

          {error ? <FieldError>{error}</FieldError> : null}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start lg:z-10">
          <Card>
          <CardHeader>
            <CardTitle className="text-base">Add checklist item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <FieldLabel htmlFor="new-item-label">Item</FieldLabel>
              <Input
                id="new-item-label"
                placeholder="e.g. Coolant Level (Sight glass checked)"
                value={newItemLabel}
                disabled={pending}
                onChange={(event) => setNewItemLabel(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="new-item-help-text">Help text</FieldLabel>
              <Input
                id="new-item-help-text"
                placeholder="Optional guidance shown during the check"
                value={newItemHelpText}
                disabled={pending}
                onChange={(event) => setNewItemHelpText(event.target.value)}
              />
            </div>
            {checklistIsCheck ? (
              <div className="space-y-2">
                <FieldLabel htmlFor="new-item-type">Frequency</FieldLabel>
                <Select
                  id="new-item-type"
                  value={newItemType}
                  disabled={pending}
                  onChange={(event) => setNewItemType(event.target.value as VehicleCheckType)}
                >
                  {vehicleCheckTypes.map((type) => (
                    <option key={type} value={type}>
                      {vehicleCheckTypeLabel(type)}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <FieldLabel htmlFor="new-item-field-type">Response type</FieldLabel>
              <Select
                id="new-item-field-type"
                value={newItemFieldType}
                disabled={pending}
                onChange={(event) =>
                  setNewItemFieldType(event.target.value as VehicleCheckFieldType)
                }
              >
                {fieldTypesForChecklistKind(checklistIsCheck ? "check" : "swap").map((type) => (
                  <option key={type} value={type}>
                    {vehicleCheckFieldTypeLabel(type)}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newItemMandatory}
                disabled={pending}
                onChange={(event) => setNewItemMandatory(event.target.checked)}
              />
              Mandatory
            </label>
            <Button
              type="button"
              className="w-full"
              disabled={pending || !newItemLabel.trim()}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  try {
                    await createVehicleCheckTemplateItem({
                      templateId,
                      checkType: checklistIsCheck ? newItemType : null,
                      fieldType: newItemFieldType,
                      label: newItemLabel.trim(),
                      helpText: newItemHelpText,
                      isMandatory: newItemMandatory,
                    });
                    setNewItemLabel("");
                    setNewItemHelpText("");
                    setNewItemMandatory(false);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to add item");
                  }
                })
              }
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
