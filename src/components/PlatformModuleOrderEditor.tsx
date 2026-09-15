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
import { reorderPlatformModules } from "@/app/admin/clients/actions";
import {
  clientModuleLabel,
  type ClientModuleKey,
  type PlatformModuleOrderItem,
} from "@/lib/client-modules";
import { cn } from "@/lib/cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

function SortableMasterRow({ item }: { item: PlatformModuleOrderItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.module_key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-0",
        isDragging && "z-10 bg-background opacity-90 shadow-md"
      )}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab touch-none items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${clientModuleLabel(item.module_key)}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 text-sm font-medium">{clientModuleLabel(item.module_key)}</span>
      <span className="text-xs text-muted-foreground">{item.sort_order}</span>
    </li>
  );
}

export function PlatformModuleOrderEditor({
  items: initialItems,
}: {
  items: PlatformModuleOrderItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((row) => row.module_key === active.id);
    const newIndex = items.findIndex((row) => row.module_key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex).map((row, index) => ({
      ...row,
      sort_order: index + 1,
    }));
    setItems(next);
    setError(null);

    startTransition(async () => {
      try {
        await reorderPlatformModules({
          moduleKeys: next.map((row) => row.module_key as ClientModuleKey),
        });
        router.refresh();
      } catch (err) {
        setItems(initialItems);
        setError(err instanceof Error ? err.message : "Failed to reorder modules");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Master module order</CardTitle>
        <CardDescription>
          Platform-wide default order for new clients. Changing this does not overwrite a client that
          already has a custom order.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Drag to set the default navigation order.</p>
          {pending ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={items.map((row) => row.module_key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="overflow-hidden rounded-md border bg-background">
              {items.map((item) => (
                <SortableMasterRow key={item.module_key} item={item} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
