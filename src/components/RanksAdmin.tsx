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
  createPersonnelRank,
  deletePersonnelRank,
  reorderPersonnelRanks,
  updatePersonnelRank,
} from "@/app/admin/ranks/actions";
import type { PersonnelRank } from "@/lib/ranks-types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

type RankFlags = {
  has_title: boolean;
  title_only: boolean;
  no_probation: boolean;
  swing_up_eligible: boolean;
};

const EMPTY_FLAGS: RankFlags = {
  has_title: false,
  title_only: false,
  no_probation: false,
  swing_up_eligible: false,
};

function RankFlagFields({
  idPrefix,
  flags,
  disabled,
  onChange,
}: {
  idPrefix: string;
  flags: RankFlags;
  disabled?: boolean;
  onChange: (next: RankFlags) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          id={`${idPrefix}-has-title`}
          type="checkbox"
          checked={flags.has_title || flags.title_only}
          disabled={disabled || flags.title_only}
          onChange={(e) => onChange({ ...flags, has_title: e.target.checked })}
        />
        Has title field
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          id={`${idPrefix}-title-only`}
          type="checkbox"
          checked={flags.title_only}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...flags,
              title_only: e.target.checked,
              has_title: e.target.checked ? true : flags.has_title,
            })
          }
        />
        Title only (hide rank name)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          id={`${idPrefix}-no-probation`}
          type="checkbox"
          checked={flags.no_probation}
          disabled={disabled}
          onChange={(e) => onChange({ ...flags, no_probation: e.target.checked })}
        />
        No probation after promotion
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          id={`${idPrefix}-swing-up`}
          type="checkbox"
          checked={flags.swing_up_eligible}
          disabled={disabled}
          onChange={(e) => onChange({ ...flags, swing_up_eligible: e.target.checked })}
        />
        Swing-up eligible
      </label>
    </div>
  );
}

function flagBadges(rank: PersonnelRank) {
  const badges: string[] = [];
  if (rank.title_only) badges.push("Title only");
  else if (rank.has_title) badges.push("Title");
  if (rank.no_probation) badges.push("No probation");
  if (rank.swing_up_eligible) badges.push("Swing-up");
  return badges;
}

export function CreateRankForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [flags, setFlags] = useState<RankFlags>(EMPTY_FLAGS);
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
            await createPersonnelRank({ name, ...flags });
            setName("");
            setFlags(EMPTY_FLAGS);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create rank");
          }
        });
      }}
    >
      <p className="text-sm font-medium">New rank</p>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-rank-name">Name</FieldLabel>
        <Input
          id="new-rank-name"
          required
          value={name}
          disabled={pending}
          placeholder="e.g. Captain"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <RankFlagFields idPrefix="new-rank" flags={flags} disabled={pending} onChange={setFlags} />
      <FieldHint>Flags control title, probation, and swing-up options on personnel files.</FieldHint>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {pending ? "Adding…" : "Add rank"}
      </Button>
    </form>
  );
}

function SortableRankRow({ rank }: { rank: PersonnelRank }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(rank.name);
  const [isActive, setIsActive] = useState(rank.is_active);
  const [flags, setFlags] = useState<RankFlags>({
    has_title: rank.has_title,
    title_only: rank.title_only,
    no_probation: rank.no_probation,
    swing_up_eligible: rank.swing_up_eligible,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rank.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function reset() {
    setName(rank.name);
    setIsActive(rank.is_active);
    setFlags({
      has_title: rank.has_title,
      title_only: rank.title_only,
      no_probation: rank.no_probation,
      swing_up_eligible: rank.swing_up_eligible,
    });
    setError(null);
    setEditing(false);
  }

  const badges = flagBadges(rank);

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
            aria-label={`Reorder ${rank.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{rank.name}</span>
              {!rank.is_active ? (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  Inactive
                </Badge>
              ) : null}
              {badges.map((label) => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="shrink-0 px-1.5 py-0 text-[10px]"
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={() => {
              setName(rank.name);
              setIsActive(rank.is_active);
              setFlags({
                has_title: rank.has_title,
                title_only: rank.title_only,
                no_probation: rank.no_probation,
                swing_up_eligible: rank.swing_up_eligible,
              });
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
                await updatePersonnelRank(rank.id, {
                  name,
                  sort_order: rank.sort_order,
                  is_active: isActive,
                  ...flags,
                });
                setEditing(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to update rank");
              }
            });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <FieldLabel htmlFor={`rank-name-${rank.id}`}>Name</FieldLabel>
              <Input
                id={`rank-name-${rank.id}`}
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
          <RankFlagFields
            idPrefix={`rank-${rank.id}`}
            flags={flags}
            disabled={pending}
            onChange={setFlags}
          />
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
                    `Delete "${rank.name}"? This cannot be undone if it is still in use.`
                  )
                ) {
                  return;
                }
                setError(null);
                startTransition(async () => {
                  try {
                    await deletePersonnelRank(rank.id);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to delete rank");
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

export function RanksAdmin({ ranks }: { ranks: PersonnelRank[] }) {
  const [ordered, setOrdered] = useState(ranks);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrdered(ranks);
  }, [ranks]);

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
        await reorderPersonnelRanks({
          rankIds: next.map((row) => row.id),
        });
      } catch (err) {
        setOrdered(ranks);
        setError(err instanceof Error ? err.message : "Failed to reorder ranks");
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-2">
        {ordered.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No ranks yet. Add one on the right.
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
                    <SortableRankRow key={row.id} rank={row} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
      <CreateRankForm />
    </div>
  );
}
