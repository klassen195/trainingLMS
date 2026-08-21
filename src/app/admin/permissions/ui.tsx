"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
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
  createPermissionLevel,
  deletePermissionLevel,
  renameCapability,
  reorderCapabilities,
  reorderPermissionLevels,
  updateLevelCapabilities,
  updatePermissionLevel,
} from "@/app/admin/permissions/actions";
import {
  APP_CAPABILITIES,
  DEFAULT_CAPABILITY_GROUPS,
  capabilityGroupNames,
  capabilityGroups,
  capabilityMeta,
  emptyCapabilityRow,
  normalizeCapabilityPlacements,
  type AppCapability,
  type CapabilityMatrix,
  type CapabilityPlacement,
} from "@/lib/capabilities";
import type { PermissionLevel } from "@/lib/permission-levels-types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel, FieldSuccess } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

function groupDropId(group: string) {
  return `group:${group}`;
}

function parseGroupDropId(id: string) {
  return id.startsWith("group:") ? id.slice("group:".length) : null;
}

function SortablePermissionLevelRow({
  level,
  selected,
  onSelect,
}: {
  level: PermissionLevel;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: level.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-10 bg-background opacity-90 shadow-md")}
    >
      <div
        className={cn(
          "flex items-center rounded-lg",
          selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        )}
      >
        <button
          type="button"
          className={cn(
            "flex shrink-0 cursor-grab touch-none items-center rounded-lg p-2 active:cursor-grabbing",
            selected
              ? "text-primary-foreground/80 hover:bg-primary/80 hover:text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-label={`Reorder ${level.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between py-2 pr-3 text-left text-sm"
          onClick={onSelect}
        >
          <span className="truncate font-medium">{level.name}</span>
          {level.is_default ? (
            <span
              className={cn(
                "ml-2 shrink-0 text-[10px] uppercase tracking-wide",
                selected ? "opacity-80" : "text-muted-foreground"
              )}
            >
              Default
            </span>
          ) : null}
        </button>
      </div>
    </li>
  );
}

function SortableCapabilityRow({
  capability,
  label,
  description,
  enabled,
  levelName,
  pending,
  onToggle,
  onRename,
}: {
  capability: AppCapability;
  label: string;
  description: string;
  enabled: boolean;
  levelName: string;
  pending: boolean;
  onToggle: () => void;
  onRename: (label: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [renamePending, startRename] = useTransition();
  const [renameError, setRenameError] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: capability,
    disabled: editing,
  });

  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function saveRename() {
    const next = draft.trim();
    if (!next) {
      setRenameError("Enter a capability name.");
      return;
    }
    if (next === label) {
      setEditing(false);
      setRenameError(null);
      return;
    }
    setRenameError(null);
    startRename(async () => {
      try {
        await onRename(next);
        setEditing(false);
      } catch (err) {
        setRenameError(err instanceof Error ? err.message : "Failed to rename capability");
      }
    });
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-border last:border-b-0",
        isDragging && "relative z-10 bg-background opacity-90 shadow-md"
      )}
    >
      <td className="px-2 py-3 align-top sm:px-4">
        <div className="flex items-start gap-1">
          <button
            type="button"
            className="mt-0.5 flex shrink-0 cursor-grab touch-none items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
            aria-label={`Reorder ${label}`}
            disabled={editing}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 space-y-1">
            {editing ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={draft}
                  disabled={renamePending || pending}
                  className="h-8 max-w-xs"
                  aria-label="Capability name"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveRename();
                    }
                    if (e.key === "Escape") {
                      setDraft(label);
                      setEditing(false);
                      setRenameError(null);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={renamePending || pending || !draft.trim()}
                  onClick={saveRename}
                >
                  {renamePending ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={renamePending}
                  onClick={() => {
                    setDraft(label);
                    setEditing(false);
                    setRenameError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="rounded text-left font-medium text-foreground hover:underline"
                onClick={() => {
                  setDraft(label);
                  setRenameError(null);
                  setEditing(true);
                }}
              >
                {label}
              </button>
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
            {renameError ? <FieldError>{renameError}</FieldError> : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center align-middle">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={enabled}
          disabled={pending || editing}
          onChange={onToggle}
          aria-label={`${label} for ${levelName}`}
        />
      </td>
    </tr>
  );
}

function CapabilityGroupHeader({ group, empty }: { group: string; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(group) });

  return (
    <tr ref={setNodeRef} className="border-b border-border">
      <td
        colSpan={2}
        className={cn(
          "bg-muted/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          isOver && "bg-primary/15 text-foreground"
        )}
      >
        {group}
        {empty ? (
          <span className="ml-2 font-normal normal-case tracking-normal">
            (drop capabilities here)
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export function PermissionMatrixEditor({
  levels,
  initialMatrix,
  capabilityPlacements,
}: {
  levels: PermissionLevel[];
  initialMatrix: CapabilityMatrix;
  capabilityPlacements: CapabilityPlacement[];
}) {
  const router = useRouter();
  const [placements, setPlacements] = useState(() =>
    normalizeCapabilityPlacements(capabilityPlacements)
  );
  const groups = useMemo(() => capabilityGroups(placements), [placements]);
  const groupNames = useMemo(() => capabilityGroupNames(placements), [placements]);
  const [ordered, setOrdered] = useState(levels);
  const [selectedId, setSelectedId] = useState(levels[0]?.id ?? "");
  const selected = ordered.find((level) => level.id === selectedId) ?? ordered[0] ?? null;

  const [name, setName] = useState(selected?.name ?? "");
  const [newName, setNewName] = useState("");
  const [row, setRow] = useState<Record<AppCapability, boolean>>(
    () => (selected ? (initialMatrix[selected.id] ?? emptyCapabilityRow()) : emptyCapabilityRow())
  );
  const [pending, startTransition] = useTransition();
  const [reorderPending, startReorder] = useTransition();
  const [capabilityReorderPending, startCapabilityReorder] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelError, setLevelError] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [capabilityReorderError, setCapabilityReorderError] = useState<string | null>(null);

  useEffect(() => {
    setOrdered(levels);
  }, [levels]);

  useEffect(() => {
    setPlacements(normalizeCapabilityPlacements(capabilityPlacements));
  }, [capabilityPlacements]);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setRow(initialMatrix[selected.id] ?? emptyCapabilityRow());
    setSaved(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when switching levels
  }, [selected?.id]);

  useEffect(() => {
    if (!selectedId && ordered[0]) setSelectedId(ordered[0].id);
  }, [ordered, selectedId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function persistPlacements(next: CapabilityPlacement[]) {
    setPlacements(next);
    setCapabilityReorderError(null);
    startCapabilityReorder(async () => {
      try {
        await reorderCapabilities({
          items: next.map((item) => ({
            capability: item.capability,
            group: item.group,
            label: item.label,
          })),
        });
      } catch (err) {
        setPlacements(normalizeCapabilityPlacements(capabilityPlacements));
        setCapabilityReorderError(
          err instanceof Error ? err.message : "Failed to reorder capabilities"
        );
      }
    });
  }

  async function handleRename(capability: AppCapability, label: string) {
    await renameCapability({ capability, label });
    setPlacements((current) =>
      current.map((row) => (row.capability === capability ? { ...row, label } : row))
    );
    router.refresh();
  }

  function handleLevelDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((level) => level.id === active.id);
    const newIndex = ordered.findIndex((level) => level.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    setReorderError(null);

    startReorder(async () => {
      try {
        await reorderPermissionLevels({
          permissionLevelIds: next.map((level) => level.id),
        });
      } catch (err) {
        setOrdered(levels);
        setReorderError(err instanceof Error ? err.message : "Failed to reorder permission levels");
      }
    });
  }

  function handleCapabilityDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeCap = String(active.id) as AppCapability;
    if (!(APP_CAPABILITIES as readonly string[]).includes(activeCap)) return;

    const overId = String(over.id);
    const overGroup = parseGroupDropId(overId);
    const overCap = (APP_CAPABILITIES as readonly string[]).includes(overId)
      ? (overId as AppCapability)
      : null;

    const current = [...placements];
    const fromIndex = current.findIndex((row) => row.capability === activeCap);
    if (fromIndex === -1) return;

    const [moved] = current.splice(fromIndex, 1);
    if (!moved) return;

    if (overGroup) {
      const lastInGroup = [...current]
        .map((row, index) => ({ row, index }))
        .filter((entry) => entry.row.group === overGroup)
        .at(-1);
      const insertAt = lastInGroup ? lastInGroup.index + 1 : current.length;
      current.splice(insertAt, 0, {
        capability: activeCap,
        group: overGroup,
        label: moved.label,
      });
      persistPlacements(current);
      return;
    }

    if (!overCap) return;
    const toIndex = current.findIndex((row) => row.capability === overCap);
    if (toIndex === -1) return;
    const targetGroup = current[toIndex]?.group ?? moved.group;
    current.splice(toIndex, 0, {
      capability: activeCap,
      group: targetGroup,
      label: moved.label,
    });
    persistPlacements(current);
  }

  const initialRow = selected ? (initialMatrix[selected.id] ?? emptyCapabilityRow()) : emptyCapabilityRow();
  const dirtyCapabilities = JSON.stringify(row) !== JSON.stringify(initialRow);
  const dirtyName = Boolean(selected && name.trim() !== selected.name);

  function toggle(capability: AppCapability) {
    setSaved(false);
    setError(null);
    setRow((current) => ({ ...current, [capability]: !current[capability] }));
  }

  function run(action: () => Promise<void>) {
    setError(null);
    setLevelError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const groupsByName = useMemo(() => new Map(groups), [groups]);
  const labelsByCapability = useMemo(() => {
    const map = new Map<AppCapability, string>();
    for (const row of placements) map.set(row.capability, row.label);
    return map;
  }, [placements]);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Permission levels</p>
            <p className="text-xs text-muted-foreground">
              {reorderPending ? "Saving order…" : "Select a level to edit. Drag to reorder."}
            </p>
          </div>
          {ordered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No permission levels yet.</p>
          ) : (
            <>
              {reorderError ? (
                <div className="px-3 pt-2">
                  <FieldError>{reorderError}</FieldError>
                </div>
              ) : null}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleLevelDragEnd}
              >
                <SortableContext
                  items={ordered.map((level) => level.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="p-1">
                    {ordered.map((level) => (
                      <SortablePermissionLevelRow
                        key={level.id}
                        level={level}
                        selected={selected?.id === level.id}
                        onSelect={() => {
                          if (
                            dirtyCapabilities &&
                            !window.confirm("Discard unsaved capability changes for this level?")
                          ) {
                            return;
                          }
                          setSelectedId(level.id);
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>

        <form
          className="space-y-3 rounded-xl border border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setLevelError(null);
            startTransition(async () => {
              try {
                const created = await createPermissionLevel({ name: newName });
                setNewName("");
                setSelectedId(created.id);
                router.refresh();
              } catch (err) {
                setLevelError(err instanceof Error ? err.message : "Failed to create permission level");
              }
            });
          }}
        >
          <p className="text-sm font-medium">New permission level</p>
          <div className="space-y-2">
            <FieldLabel htmlFor="new-permission-level-name">Name</FieldLabel>
            <Input
              id="new-permission-level-name"
              required
              value={newName}
              disabled={pending}
              placeholder="e.g. Lieutenant"
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          {levelError ? <FieldError>{levelError}</FieldError> : null}
          <Button type="submit" size="sm" disabled={pending || !newName.trim()}>
            {pending ? "Adding…" : "Add level"}
          </Button>
        </form>
      </aside>

      {selected ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1 space-y-2">
                <FieldLabel htmlFor="permission-level-name">Level name</FieldLabel>
                <Input
                  id="permission-level-name"
                  value={name}
                  disabled={pending}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !dirtyName}
                onClick={() =>
                  run(async () => {
                    await updatePermissionLevel({ id: selected.id, name });
                  })
                }
              >
                Rename
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selected.is_default}
                  disabled={pending || selected.is_default}
                  onChange={() =>
                    run(async () => {
                      await updatePermissionLevel({ id: selected.id, isDefault: true });
                    })
                  }
                />
                Use for new members
              </label>
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={pending || levels.length <= 1}
                onClick={() => {
                  if (!window.confirm(`Delete permission level "${selected.name}"?`)) return;
                  run(async () => {
                    await deletePermissionLevel({ id: selected.id });
                  });
                }}
              >
                Delete level
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-4 py-2">
              <p className="text-xs text-muted-foreground">
                {capabilityReorderPending
                  ? "Saving capability order…"
                  : "Drag capabilities within or between groups. Click a name to rename it. Modules toggles show or hide whole app areas."}
              </p>
              {capabilityReorderError ? (
                <div className="mt-1">
                  <FieldError>{capabilityReorderError}</FieldError>
                </div>
              ) : null}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCapabilityDragEnd}
            >
              <SortableContext
                items={placements.map((item) => item.capability)}
                strategy={verticalListSortingStrategy}
              >
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="px-4 py-3 text-left font-semibold text-foreground">
                        Capability
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-foreground">
                        {selected.name}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupNames.map((group) => {
                      const capabilities = groupsByName.get(group) ?? [];
                      const showEmptyDrop =
                        capabilities.length === 0 &&
                        (DEFAULT_CAPABILITY_GROUPS as readonly string[]).includes(group);
                      if (capabilities.length === 0 && !showEmptyDrop) return null;
                      return (
                        <CapabilityGroupSection
                          key={group}
                          group={group}
                          capabilities={capabilities}
                          labelsByCapability={labelsByCapability}
                          selectedName={selected.name}
                          row={row}
                          pending={pending}
                          onToggle={toggle}
                          onRename={handleRename}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </SortableContext>
            </DndContext>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              disabled={pending || !dirtyCapabilities}
              onClick={() =>
                run(async () => {
                  await updateLevelCapabilities({
                    permissionLevelId: selected.id,
                    rows: APP_CAPABILITIES.map((capability) => ({
                      capability,
                      enabled: row[capability],
                    })),
                  });
                  setSaved(true);
                })
              }
            >
              {pending ? "Saving..." : "Save capabilities"}
            </Button>
            {saved ? <FieldSuccess>Capabilities saved.</FieldSuccess> : null}
            {error ? <FieldError>{error}</FieldError> : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Create a permission level to configure its capabilities.</p>
      )}
    </div>
  );
}

function CapabilityGroupSection({
  group,
  capabilities,
  labelsByCapability,
  selectedName,
  row,
  pending,
  onToggle,
  onRename,
}: {
  group: string;
  capabilities: AppCapability[];
  labelsByCapability: Map<AppCapability, string>;
  selectedName: string;
  row: Record<AppCapability, boolean>;
  pending: boolean;
  onToggle: (capability: AppCapability) => void;
  onRename: (capability: AppCapability, label: string) => Promise<void>;
}) {
  return (
    <>
      <CapabilityGroupHeader group={group} empty={capabilities.length === 0} />
      {capabilities.map((capability) => (
        <SortableCapabilityRow
          key={capability}
          capability={capability}
          label={labelsByCapability.get(capability) ?? capabilityMeta[capability].label}
          description={capabilityMeta[capability].description}
          enabled={row[capability]}
          levelName={selectedName}
          pending={pending}
          onToggle={() => onToggle(capability)}
          onRename={(label) => onRename(capability, label)}
        />
      ))}
    </>
  );
}
