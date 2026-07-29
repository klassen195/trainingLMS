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
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
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
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? "Adding…" : "Add location"}
      </Button>
    </form>
  );
}

function SortableLocationCard({ location }: { location: Location }) {
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
      className={cn(isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <Card>
        <CardHeader className="flex flex-row items-start gap-2 space-y-0">
          <button
            type="button"
            className={cn(
              "mt-1 flex shrink-0 cursor-grab touch-none items-center self-start rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing",
              editing && "pointer-events-none opacity-40"
            )}
            aria-label={`Reorder ${location.name}`}
            disabled={editing}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          {!editing ? (
            <>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {location.is_active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{location.name}</CardTitle>
                {location.notes ? (
                  <p className="text-sm text-muted-foreground">{location.notes}</p>
                ) : null}
              </div>
              <Button
                variant="outline"
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
            </>
          ) : (
            <div className="min-w-0 flex-1 space-y-4">
              <CardTitle className="text-xl">Edit location</CardTitle>
              <form
                className="space-y-3"
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
                      setError(
                        err instanceof Error ? err.message : "Failed to update location"
                      );
                    }
                  });
                }}
              >
                <div className="space-y-2">
                  <FieldLabel htmlFor={`location-name-${location.id}`}>Name</FieldLabel>
                  <Input
                    id={`location-name-${location.id}`}
                    required
                    value={name}
                    disabled={pending}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor={`location-notes-${location.id}`}>Notes</FieldLabel>
                  <Textarea
                    id={`location-notes-${location.id}`}
                    value={notes}
                    disabled={pending}
                    rows={2}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    disabled={pending}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Active (shown in asset forms)
                </label>
                {error ? <FieldError>{error}</FieldError> : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={pending || !name.trim()}>
                    {pending ? "Saving…" : "Save"}
                  </Button>
                  <Button type="button" variant="outline" disabled={pending} onClick={reset}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
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
                          setError(
                            err instanceof Error ? err.message : "Failed to delete location"
                          );
                        }
                      });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardHeader>
      </Card>
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
      <div className="space-y-3">
        {orderedLocations.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No locations yet. Add one on the right.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {pending ? "Saving order..." : "Drag locations to reorder."}
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
                <ul className="space-y-3">
                  {orderedLocations.map((location) => (
                    <SortableLocationCard key={location.id} location={location} />
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
