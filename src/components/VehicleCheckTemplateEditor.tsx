"use client";

import { useEffect, useState, useTransition } from "react";
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
import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  createVehicleCheckTemplateItem,
  createVehicleCheckTemplateSection,
  deleteVehicleCheckTemplateItem,
  reorderVehicleCheckTemplateItems,
  setVehicleCheckTemplateItemActive,
  updateVehicleCheckTemplateItem,
} from "@/app/assets/vehicle-check-actions";
import type {
  VehicleCheckFieldType,
  VehicleCheckTemplateItem,
  VehicleCheckType,
} from "@/lib/vehicle-checks-types";
import {
  vehicleCheckFieldTypeLabel,
  vehicleCheckFieldTypes,
  vehicleCheckTypeLabel,
  vehicleCheckTypes,
} from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

function SortableTemplateRow({
  item,
  pending,
  startTransition,
  onError,
}: {
  item: VehicleCheckTemplateItem;
  pending: boolean;
  startTransition: (action: () => void) => void;
  onError: (message: string | null) => void;
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
                      checkType: item.check_type ?? "daily",
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
                      checkType: item.check_type ?? "daily",
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
          <Select
            value={item.field_type ?? "pass_fail"}
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
                    checkType: item.check_type ?? "daily",
                    fieldType,
                  });
                  router.refresh();
                } catch (err) {
                  onError(err instanceof Error ? err.message : "Failed to update field type");
                }
              });
            }}
          >
            {vehicleCheckFieldTypes.map((type) => (
              <option key={type} value={type}>
                {vehicleCheckFieldTypeLabel(type)}
              </option>
            ))}
          </Select>
        </div>
      )}

      {!item.is_active ? <Badge variant="outline">Inactive</Badge> : null}

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
    </li>
  );
}

export function VehicleCheckTemplateEditor({
  templateId,
  items,
}: {
  templateId: string;
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
  const [newItemFieldType, setNewItemFieldType] = useState<VehicleCheckFieldType>("pass_fail");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrderedItems([...items].sort((a, b) => a.sort_order - b.sort_order));
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedItems.findIndex((item) => item.id === active.id);
    const newIndex = orderedItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(orderedItems, oldIndex, newIndex);
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
                  items={orderedItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-3">
                    {orderedItems.map((item) => (
                      <SortableTemplateRow
                        key={item.id}
                        item={item}
                        pending={pending}
                        startTransition={startTransition}
                        onError={setError}
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
                {vehicleCheckFieldTypes.map((type) => (
                  <option key={type} value={type}>
                    {vehicleCheckFieldTypeLabel(type)}
                  </option>
                ))}
              </Select>
            </div>
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
                      checkType: newItemType,
                      fieldType: newItemFieldType,
                      label: newItemLabel.trim(),
                      helpText: newItemHelpText,
                    });
                    setNewItemLabel("");
                    setNewItemHelpText("");
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
