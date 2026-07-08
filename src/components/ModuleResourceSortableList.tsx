"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
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
import { reorderModuleResources } from "@/app/actions";
import { buildModuleResourceOrder } from "@/lib/module-resources";
import type { ModuleResource } from "@/lib/training-lms-types";
import { cn } from "@/lib/cn";

function SortableResourceRow({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "rounded-lg border border-border bg-muted/20 text-sm",
        isDragging && "z-10 opacity-80 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2 px-2 py-3">
        <button
          type="button"
          className="mt-0.5 flex shrink-0 cursor-grab touch-none items-center self-start px-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Reorder resource"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </li>
  );
}

export function ModuleResourceSortableList({
  programId,
  moduleId,
  allResources,
  items,
  group,
  renderItem,
  emptyMessage,
}: {
  programId: string;
  moduleId: string;
  allResources: ModuleResource[];
  items: ModuleResource[];
  group: "linked" | "checklist";
  renderItem: (resource: ModuleResource, index: number) => ReactNode;
  emptyMessage?: string;
}) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedItems.findIndex((resource) => resource.id === active.id);
    const newIndex = orderedItems.findIndex((resource) => resource.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextItems = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(nextItems);

    startTransition(async () => {
      await reorderModuleResources({
        programId,
        moduleId,
        resourceIds: buildModuleResourceOrder(
          allResources,
          nextItems.map((resource) => resource.id),
          group
        ),
      });
    });
  }

  if (orderedItems.length === 0) {
    return emptyMessage ? <p className="text-xs text-muted-foreground">{emptyMessage}</p> : null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {pending ? "Saving order..." : "Drag resources to reorder."}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedItems.map((resource) => resource.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">
            {orderedItems.map((resource, index) => (
              <SortableResourceRow key={resource.id} id={resource.id}>
                {renderItem(resource, index)}
              </SortableResourceRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
