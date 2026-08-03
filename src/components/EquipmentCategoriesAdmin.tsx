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
import { GripVertical } from "lucide-react";
import {
  createEquipmentCategory,
  deleteEquipmentCategory,
  reorderEquipmentCategories,
  updateEquipmentCategory,
} from "@/app/admin/equipment-categories/actions";
import type { EquipmentCategory } from "@/lib/equipment-categories-types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function CreateEquipmentCategoryForm() {
  const router = useRouter();
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
            await createEquipmentCategory({ name });
            setName("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create category");
          }
        });
      }}
    >
      <p className="text-sm font-medium">New category</p>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-equipment-category-name">Name</FieldLabel>
        <Input
          id="new-equipment-category-name"
          required
          value={name}
          disabled={pending}
          placeholder="e.g. Radio"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {pending ? "Adding…" : "Add category"}
      </Button>
    </form>
  );
}

function SortableCategoryRow({ category }: { category: EquipmentCategory }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [isActive, setIsActive] = useState(category.is_active);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function reset() {
    setName(category.name);
    setIsActive(category.is_active);
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
            aria-label={`Reorder ${category.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{category.name}</span>
              {!category.is_active ? (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  Inactive
                </Badge>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={() => {
              setName(category.name);
              setIsActive(category.is_active);
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
                await updateEquipmentCategory(category.id, {
                  name,
                  sort_order: category.sort_order,
                  is_active: isActive,
                });
                setEditing(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to update category");
              }
            });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <FieldLabel htmlFor={`equipment-category-name-${category.id}`}>Name</FieldLabel>
              <Input
                id={`equipment-category-name-${category.id}`}
                required
                value={name}
                disabled={pending}
                className="h-8"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <label className="flex h-8 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                disabled={pending}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
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
                    `Delete "${category.name}"? This cannot be undone if equipment still uses it.`
                  )
                ) {
                  return;
                }
                setError(null);
                startTransition(async () => {
                  try {
                    await deleteEquipmentCategory(category.id);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to delete category");
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

export function EquipmentCategoriesAdmin({
  categories,
}: {
  categories: EquipmentCategory[];
}) {
  const [orderedCategories, setOrderedCategories] = useState(categories);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrderedCategories(categories);
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedCategories.findIndex((category) => category.id === active.id);
    const newIndex = orderedCategories.findIndex((category) => category.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(orderedCategories, oldIndex, newIndex);
    setOrderedCategories(next);
    setError(null);

    startTransition(async () => {
      try {
        await reorderEquipmentCategories({
          categoryIds: next.map((category) => category.id),
        });
      } catch (err) {
        setOrderedCategories(categories);
        setError(err instanceof Error ? err.message : "Failed to reorder categories");
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-2">
        {orderedCategories.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No categories yet. Add one on the right.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {pending ? "Saving order..." : "Drag to reorder."}
            </p>
            {error ? <FieldError>{error}</FieldError> : null}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedCategories.map((category) => category.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="overflow-hidden rounded-md border">
                  {orderedCategories.map((category) => (
                    <SortableCategoryRow key={category.id} category={category} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
      <CreateEquipmentCategoryForm />
    </div>
  );
}
