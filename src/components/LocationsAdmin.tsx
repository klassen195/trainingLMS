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
  createLocation,
  deleteLocation,
  reorderLocations,
  updateLocation,
} from "@/app/admin/locations/actions";
import type { Location } from "@/lib/locations-types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";

export function CreateLocationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
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
            await createLocation({ name, notes });
            setName("");
            setNotes("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create location");
          }
        });
      }}
    >
      <p className="text-sm font-medium">New location</p>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-location-name">Name</FieldLabel>
        <Input
          id="new-location-name"
          required
          value={name}
          disabled={pending}
          placeholder="e.g. Station 6"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-location-notes">Notes</FieldLabel>
        <Textarea
          id="new-location-notes"
          value={notes}
          disabled={pending}
          rows={2}
          placeholder="Optional"
          className="min-h-0"
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {pending ? "Adding…" : "Add location"}
      </Button>
    </form>
  );
}

function SortableLocationRow({ location }: { location: Location }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(location.name);
  const [notes, setNotes] = useState(location.notes);
  const [isActive, setIsActive] = useState(location.is_active);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: location.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function reset() {
    setName(location.name);
    setNotes(location.notes);
    setIsActive(location.is_active);
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
            aria-label={`Reorder ${location.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{location.name}</span>
              {!location.is_active ? (
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
              setName(location.name);
              setNotes(location.notes);
              setIsActive(location.is_active);
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
                await updateLocation(location.id, {
                  name,
                  sort_order: location.sort_order,
                  is_active: isActive,
                  notes,
                });
                setEditing(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to update location");
              }
            });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <FieldLabel htmlFor={`location-name-${location.id}`}>Name</FieldLabel>
              <Input
                id={`location-name-${location.id}`}
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
          <div className="space-y-1">
            <FieldLabel htmlFor={`location-notes-${location.id}`}>Notes</FieldLabel>
            <Textarea
              id={`location-notes-${location.id}`}
              value={notes}
              disabled={pending}
              rows={2}
              className="min-h-0"
              onChange={(e) => setNotes(e.target.value)}
            />
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
                    `Delete "${location.name}"? This cannot be undone if no assets use it.`
                  )
                ) {
                  return;
                }
                setError(null);
                startTransition(async () => {
                  try {
                    await deleteLocation(location.id);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to delete location");
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

export function LocationsAdmin({ locations }: { locations: Location[] }) {
  const [orderedLocations, setOrderedLocations] = useState(locations);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrderedLocations(locations);
  }, [locations]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedLocations.findIndex((location) => location.id === active.id);
    const newIndex = orderedLocations.findIndex((location) => location.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(orderedLocations, oldIndex, newIndex);
    setOrderedLocations(next);
    setError(null);

    startTransition(async () => {
      try {
        await reorderLocations({
          locationIds: next.map((location) => location.id),
        });
      } catch (err) {
        setOrderedLocations(locations);
        setError(err instanceof Error ? err.message : "Failed to reorder locations");
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-2">
        {orderedLocations.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No locations yet. Add one on the right.
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
                items={orderedLocations.map((location) => location.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="overflow-hidden rounded-md border">
                  {orderedLocations.map((location) => (
                    <SortableLocationRow key={location.id} location={location} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
      <CreateLocationForm />
    </div>
  );
}
