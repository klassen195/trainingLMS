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
import { setClientModuleEnabled } from "@/app/admin/clients/actions";
import {
  reorderClientModules,
  resetClientModulesToMaster,
} from "@/app/admin/modules/actions";
import { clientModuleLabel, type ClientModule, type ClientModuleKey } from "@/lib/client-modules";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

function SortableModuleRow({
  clientId,
  module,
  allowToggle,
  onToggleError,
}: {
  clientId: string;
  module: ClientModule;
  allowToggle: boolean;
  onToggleError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.module_key,
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
        isDragging && "z-10 bg-background opacity-90 shadow-md",
        !module.enabled && "opacity-60"
      )}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab touch-none items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${clientModuleLabel(module.module_key)}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 text-sm font-medium">{clientModuleLabel(module.module_key)}</span>
      {allowToggle ? (
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={module.enabled}
            disabled={pending}
            onChange={(event) => {
              const enabled = event.target.checked;
              onToggleError(null);
              startTransition(async () => {
                try {
                  await setClientModuleEnabled({
                    clientId,
                    moduleKey: module.module_key,
                    enabled,
                  });
                  router.refresh();
                } catch (err) {
                  onToggleError(err instanceof Error ? err.message : "Failed to update module");
                }
              });
            }}
          />
          {module.enabled ? "On" : "Off"}
        </label>
      ) : (
        <span className="text-xs text-muted-foreground">{module.enabled ? "On" : "Off"}</span>
      )}
    </li>
  );
}

export function ClientModulesEditor({
  clientId,
  modules: initialModules,
  allowToggle = false,
  title = "Module order",
  description = "Drag to set this department’s main navigation order.",
}: {
  clientId: string;
  modules: ClientModule[];
  allowToggle?: boolean;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((row) => row.module_key === active.id);
    const newIndex = modules.findIndex((row) => row.module_key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(modules, oldIndex, newIndex).map((row, index) => ({
      ...row,
      sort_order: index + 1,
    }));
    setModules(next);
    setError(null);

    startTransition(async () => {
      try {
        await reorderClientModules({
          clientId,
          moduleKeys: next.map((row) => row.module_key as ClientModuleKey),
        });
        router.refresh();
      } catch (err) {
        setModules(initialModules);
        setError(err instanceof Error ? err.message : "Failed to reorder modules");
      }
    });
  }

  function onResetToMaster() {
    setError(null);
    startTransition(async () => {
      try {
        await resetClientModulesToMaster({ clientId });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reset module order");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <div className="flex items-center gap-2">
          {pending ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onResetToMaster}>
            Use master order
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={modules.map((row) => row.module_key)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="overflow-hidden rounded-md border bg-background">
            {modules.map((module) => (
              <SortableModuleRow
                key={module.module_key}
                clientId={clientId}
                module={module}
                allowToggle={allowToggle}
                onToggleError={setError}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
