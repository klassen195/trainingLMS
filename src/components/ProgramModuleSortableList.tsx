"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
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
import { ChevronRight, GripVertical, Pencil } from "lucide-react";
import { reorderProgramModules } from "@/app/actions";
import type { ProgramModuleEntry } from "@/lib/training-lms-types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

function SortableModuleRow({
  moduleItem,
  index,
  programId,
  isShared,
}: {
  moduleItem: ProgramModuleEntry;
  index: number;
  programId: string;
  isShared: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: moduleItem.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2 rounded-lg border bg-card", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab touch-none items-center self-stretch px-3 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${moduleItem.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <Link
        href={`/instructor/programs/${programId}/modules/${moduleItem.id}/edit`}
        className="flex min-w-0 flex-1 items-center gap-4 py-4 pr-4 transition-colors hover:bg-muted/50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{moduleItem.title}</span>
            {isShared ? (
              <Badge variant="outline" className="text-xs">
                Shared
              </Badge>
            ) : null}
          </div>
          {moduleItem.content ? (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{moduleItem.content}</p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
          <Pencil className="h-4 w-4" />
          Edit
          <ChevronRight className="h-4 w-4" />
        </span>
      </Link>
    </li>
  );
}

export function ProgramModuleSortableList({
  programId,
  modules,
  editableModuleIds,
}: {
  programId: string;
  modules: ProgramModuleEntry[];
  editableModuleIds: string[];
}) {
  const editableSet = new Set(editableModuleIds);
  const [orderedModules, setOrderedModules] = useState(modules);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrderedModules(modules);
  }, [modules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedModules.findIndex((moduleItem) => moduleItem.id === active.id);
    const newIndex = orderedModules.findIndex((moduleItem) => moduleItem.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(orderedModules, oldIndex, newIndex);
    setOrderedModules(next);

    startTransition(async () => {
      await reorderProgramModules({
        programId,
        moduleIds: next.map((moduleItem) => moduleItem.id),
      });
    });
  }

  if (orderedModules.length === 0) {
    return <p className="text-sm text-muted-foreground">No modules yet. Create one below.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {pending ? "Saving order..." : "Drag modules to reorder."}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedModules.map((moduleItem) => moduleItem.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {orderedModules.map((moduleItem, index) => (
              <SortableModuleRow
                key={moduleItem.id}
                moduleItem={moduleItem}
                index={index}
                programId={programId}
                isShared={!editableSet.has(moduleItem.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
