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
  createEmsLevel,
  deleteEmsLevel,
  reorderEmsLevels,
  updateEmsLevel,
} from "@/app/admin/ems-levels/actions";
import type { EmsLevel } from "@/lib/ems-levels-types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function CreateEmsLevelForm() {
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
            await createEmsLevel({ name });
            setName("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create EMS level");
          }
        });
      }}
    >
      <p className="text-sm font-medium">New EMS level</p>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-ems-level-name">Name</FieldLabel>
        <Input
          id="new-ems-level-name"
          required
          value={name}
          disabled={pending}
          placeholder="e.g. Paramedic"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {pending ? "Adding…" : "Add EMS level"}
      </Button>
    </form>
  );
}

function SortableEmsLevelRow({ level }: { level: EmsLevel }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(level.name);
  const [isActive, setIsActive] = useState(level.is_active);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: level.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function reset() {
    setName(level.name);
    setIsActive(level.is_active);
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
            aria-label={`Reorder ${level.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{level.name}</span>
              {!level.is_active ? (
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
              setName(level.name);
              setIsActive(level.is_active);
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
                await updateEmsLevel(level.id, {
                  name,
                  sort_order: level.sort_order,
                  is_active: isActive,
                });
                setEditing(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to update EMS level");
              }
            });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <FieldLabel htmlFor={`ems-level-name-${level.id}`}>Name</FieldLabel>
              <Input
                id={`ems-level-name-${level.id}`}
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
                    `Delete "${level.name}"? This cannot be undone if it is still in use.`
                  )
                ) {
                  return;
                }
                setError(null);
                startTransition(async () => {
                  try {
                    await deleteEmsLevel(level.id);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to delete EMS level");
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

export function EmsLevelsAdmin({ levels }: { levels: EmsLevel[] }) {
  const [ordered, setOrdered] = useState(levels);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrdered(levels);
  }, [levels]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((row) => row.id === active.id);
    const newIndex = ordered.findIndex((row) => row.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    setError(null);

    startTransition(async () => {
      try {
        await reorderEmsLevels({
          emsLevelIds: next.map((row) => row.id),
        });
      } catch (err) {
        setOrdered(levels);
        setError(err instanceof Error ? err.message : "Failed to reorder EMS levels");
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-2">
        {ordered.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No EMS levels yet. Add one on the right.
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
                items={ordered.map((row) => row.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="overflow-hidden rounded-md border">
                  {ordered.map((row) => (
                    <SortableEmsLevelRow key={row.id} level={row} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
      <CreateEmsLevelForm />
    </div>
  );
}
