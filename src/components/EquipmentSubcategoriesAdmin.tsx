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
import { GripVertical } from "lucide-react";
import {
  createEquipmentSubcategory,
  deleteEquipmentSubcategory,
  reorderEquipmentSubcategories,
  updateEquipmentSubcategory,
} from "@/app/admin/equipment-subcategories/actions";
import type { EquipmentCategory } from "@/lib/equipment-categories-types";
import type { EquipmentSubcategoryWithCategory } from "@/lib/equipment-subcategories-types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

export function CreateEquipmentSubcategoryForm({
  categories,
}: {
  categories: EquipmentCategory[];
}) {
  const router = useRouter();
  const activeCategories = categories.filter((c) => c.is_active);
  const [categoryId, setCategoryId] = useState(activeCategories[0]?.id ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await createEquipmentSubcategory({
              equipment_category_id: categoryId,
              name,
            });
            setName("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create subcategory");
          }
        });
      }}
    >
      <p className="text-sm font-medium">New subcategory</p>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-equipment-subcategory-category">Category</FieldLabel>
        <Select
          id="new-equipment-subcategory-category"
          required
          value={categoryId}
          disabled={pending || activeCategories.length === 0}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {activeCategories.length === 0 ? (
            <option value="">No active categories</option>
          ) : (
            activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </Select>
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-equipment-subcategory-name">Name</FieldLabel>
        <Input
          id="new-equipment-subcategory-name"
          required
          value={name}
          disabled={pending}
          placeholder="e.g. Structural"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button
        type="submit"
        size="sm"
        disabled={pending || !name.trim() || !categoryId}
      >
        {pending ? "Adding…" : "Add subcategory"}
      </Button>
    </form>
  );
}

function SortableSubcategoryRow({
  subcategory,
  categories,
}: {
  subcategory: EquipmentSubcategoryWithCategory;
  categories: EquipmentCategory[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [categoryId, setCategoryId] = useState(subcategory.equipment_category_id);
  const [name, setName] = useState(subcategory.name);
  const [isActive, setIsActive] = useState(subcategory.is_active);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subcategory.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const categoryOptions = categories.filter(
    (c) => c.is_active || c.id === subcategory.equipment_category_id
  );

  function reset() {
    setCategoryId(subcategory.equipment_category_id);
    setName(subcategory.name);
    setIsActive(subcategory.is_active);
    setError(null);
    setEditing(false);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-border last:border-0",
        isDragging && "z-10 bg-background opacity-90 shadow-md"
      )}
    >
      {!editing ? (
        <div className="flex items-center gap-2 px-2 py-1.5">
          <button
            type="button"
            className="flex shrink-0 cursor-grab touch-none items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Reorder ${subcategory.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{subcategory.name}</span>
              {!subcategory.is_active ? (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  Inactive
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {subcategory.equipment_category?.name || "Unknown category"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={() => {
              setCategoryId(subcategory.equipment_category_id);
              setName(subcategory.name);
              setIsActive(subcategory.is_active);
              setError(null);
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
      ) : (
        <form
          className="space-y-2 px-2 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await updateEquipmentSubcategory(subcategory.id, {
                  equipment_category_id: categoryId,
                  name,
                  sort_order: subcategory.sort_order,
                  is_active: isActive,
                });
                setEditing(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to update subcategory");
              }
            });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <FieldLabel htmlFor={`equipment-subcategory-category-${subcategory.id}`}>
                Category
              </FieldLabel>
              <Select
                id={`equipment-subcategory-category-${subcategory.id}`}
                required
                value={categoryId}
                disabled={pending}
                className="h-8"
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.is_active ? " (inactive)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor={`equipment-subcategory-name-${subcategory.id}`}>Name</FieldLabel>
              <Input
                id={`equipment-subcategory-name-${subcategory.id}`}
                required
                value={name}
                disabled={pending}
                className="h-8"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              disabled={pending}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending || !name.trim() || !categoryId}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={reset}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete "${subcategory.name}"? This cannot be undone if equipment still uses it.`
                  )
                ) {
                  return;
                }
                setError(null);
                startTransition(async () => {
                  try {
                    await deleteEquipmentSubcategory(subcategory.id);
                    router.refresh();
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Failed to delete subcategory"
                    );
                  }
                });
              }}
            >
              Delete
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

export function EquipmentSubcategoriesAdmin({
  subcategories,
  categories,
}: {
  subcategories: EquipmentSubcategoryWithCategory[];
  categories: EquipmentCategory[];
}) {
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [orderedSubcategories, setOrderedSubcategories] = useState(subcategories);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrderedSubcategories(subcategories);
  }, [subcategories]);

  const filtered = useMemo(() => {
    if (filterCategoryId === "all") return orderedSubcategories;
    return orderedSubcategories.filter((s) => s.equipment_category_id === filterCategoryId);
  }, [filterCategoryId, orderedSubcategories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((item) => item.id === active.id);
    const newIndex = filtered.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextFiltered = arrayMove(filtered, oldIndex, newIndex);
    const nextFilteredIds = new Set(nextFiltered.map((item) => item.id));
    const rest = orderedSubcategories.filter((item) => !nextFilteredIds.has(item.id));
    const next = [...nextFiltered, ...rest];
    setOrderedSubcategories(next);
    setError(null);

    startTransition(async () => {
      try {
        await reorderEquipmentSubcategories({
          subcategoryIds: nextFiltered.map((item) => item.id),
        });
      } catch (err) {
        setOrderedSubcategories(subcategories);
        setError(err instanceof Error ? err.message : "Failed to reorder subcategories");
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="h-8 max-w-xs"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            {pending ? "Saving order..." : "Drag to reorder within the current filter."}
          </p>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No subcategories yet. Add one on the right.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filtered.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="overflow-hidden rounded-md border">
                {filtered.map((subcategory) => (
                  <SortableSubcategoryRow
                    key={subcategory.id}
                    subcategory={subcategory}
                    categories={categories}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
      <CreateEquipmentSubcategoryForm categories={categories} />
    </div>
  );
}
