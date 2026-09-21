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
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  createTaskbookType,
  deleteTaskbookType,
  reorderTaskbookTypes,
  updateTaskbookType,
} from "@/app/admin/taskbooks/actions";
import {
  TASKBOOK_GROUP_OPTIONS,
  taskbookGroupLabelForKey,
  type TaskbookTypeWithPrerequisites,
} from "@/lib/taskbook-types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

type PrereqDraft = { code?: string; label: string };

function CreateTaskbookTypeForm({ pdipEnabled = false }: { pdipEnabled?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [groupKey, setGroupKey] = useState("rank");
  const [autoIssued, setAutoIssued] = useState(false);
  const [requestable, setRequestable] = useState(true);
  const [pdipEligible, setPdipEligible] = useState(false);
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
            await createTaskbookType({
              name,
              group_key: groupKey,
              group_label: taskbookGroupLabelForKey(groupKey),
              auto_issued: autoIssued,
              requestable: autoIssued ? false : requestable,
              pdip_eligible: pdipEnabled ? pdipEligible : false,
              prerequisites: [],
            });
            setName("");
            setAutoIssued(false);
            setRequestable(true);
            setPdipEligible(false);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create taskbook");
          }
        });
      }}
    >
      <p className="text-sm font-medium">New taskbook</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="new-taskbook-name">Name</FieldLabel>
          <Input
            id="new-taskbook-name"
            required
            value={name}
            disabled={pending}
            placeholder="e.g. Lieutenant"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="new-taskbook-group">Group</FieldLabel>
          <Select
            id="new-taskbook-group"
            value={groupKey}
            disabled={pending}
            onChange={(e) => setGroupKey(e.target.value)}
          >
            {TASKBOOK_GROUP_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoIssued}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              setAutoIssued(next);
              if (next) setRequestable(false);
            }}
          />
          Auto-issued on hire
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requestable && !autoIssued}
            disabled={pending || autoIssued}
            onChange={(e) => setRequestable(e.target.checked)}
          />
          Members can request
        </label>
        {pdipEnabled ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pdipEligible}
              disabled={pending}
              onChange={(e) => setPdipEligible(e.target.checked)}
            />
            Counts for PDIP
          </label>
        ) : null}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {pending ? "Adding…" : "Add taskbook"}
      </Button>
    </form>
  );
}

function SortableTaskbookRow({
  taskbook,
  pdipEnabled,
}: {
  taskbook: TaskbookTypeWithPrerequisites;
  pdipEnabled: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(taskbook.name);
  const [groupKey, setGroupKey] = useState(taskbook.group_key);
  const [isActive, setIsActive] = useState(taskbook.is_active);
  const [autoIssued, setAutoIssued] = useState(taskbook.auto_issued);
  const [requestable, setRequestable] = useState(taskbook.requestable);
  const [pdipEligible, setPdipEligible] = useState(taskbook.pdip_eligible);
  const [notes, setNotes] = useState(taskbook.notes);
  const [prerequisites, setPrerequisites] = useState<PrereqDraft[]>(
    taskbook.prerequisites.map((item) => ({ code: item.code, label: item.label }))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskbook.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function reset() {
    setName(taskbook.name);
    setGroupKey(taskbook.group_key);
    setIsActive(taskbook.is_active);
    setAutoIssued(taskbook.auto_issued);
    setRequestable(taskbook.requestable);
    setPdipEligible(taskbook.pdip_eligible);
    setNotes(taskbook.notes);
    setPrerequisites(
      taskbook.prerequisites.map((item) => ({ code: item.code, label: item.label }))
    );
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
            aria-label={`Reorder ${taskbook.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{taskbook.name}</span>
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                {taskbook.group_label}
              </Badge>
              {!taskbook.is_active ? (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  Inactive
                </Badge>
              ) : null}
              {taskbook.auto_issued ? (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  Auto-issued
                </Badge>
              ) : null}
              {taskbook.requestable && !taskbook.auto_issued ? (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  Requestable
                </Badge>
              ) : null}
              {pdipEnabled && taskbook.pdip_eligible ? (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  PDIP
                </Badge>
              ) : null}
              {taskbook.prerequisites.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {taskbook.prerequisites.length} prereq
                  {taskbook.prerequisites.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={() => {
              reset();
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
      ) : (
        <form
          className="space-y-3 px-2 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await updateTaskbookType(taskbook.id, {
                  name,
                  group_key: groupKey,
                  group_label: taskbookGroupLabelForKey(groupKey),
                  sort_order: taskbook.sort_order,
                  is_active: isActive,
                  auto_issued: autoIssued,
                  requestable: autoIssued ? false : requestable,
                  pdip_eligible: pdipEnabled ? pdipEligible : taskbook.pdip_eligible,
                  notes,
                  prerequisites,
                });
                setEditing(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to update taskbook");
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <FieldLabel htmlFor={`taskbook-name-${taskbook.id}`}>Name</FieldLabel>
              <Input
                id={`taskbook-name-${taskbook.id}`}
                required
                value={name}
                disabled={pending}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor={`taskbook-group-${taskbook.id}`}>Group</FieldLabel>
              <Select
                id={`taskbook-group-${taskbook.id}`}
                value={groupKey}
                disabled={pending}
                onChange={(e) => setGroupKey(e.target.value)}
              >
                {TASKBOOK_GROUP_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                disabled={pending}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoIssued}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAutoIssued(next);
                  if (next) setRequestable(false);
                }}
              />
              Auto-issued on hire
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requestable && !autoIssued}
                disabled={pending || autoIssued}
                onChange={(e) => setRequestable(e.target.checked)}
              />
              Members can request
            </label>
            {pdipEnabled ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pdipEligible}
                  disabled={pending}
                  onChange={(e) => setPdipEligible(e.target.checked)}
                />
                Counts for PDIP
              </label>
            ) : null}
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor={`taskbook-notes-${taskbook.id}`}>Notes</FieldLabel>
            <Textarea
              id={`taskbook-notes-${taskbook.id}`}
              rows={2}
              value={notes}
              disabled={pending}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>Prerequisites</FieldLabel>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => setPrerequisites((prev) => [...prev, { label: "" }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {prerequisites.length === 0 ? (
              <p className="text-xs text-muted-foreground">No prerequisites.</p>
            ) : (
              <ul className="space-y-2">
                {prerequisites.map((item, index) => (
                  <li key={`${item.code ?? "new"}-${index}`} className="flex items-start gap-2">
                    <Input
                      value={item.label}
                      disabled={pending}
                      placeholder="Prerequisite label"
                      onChange={(e) => {
                        const value = e.target.value;
                        setPrerequisites((prev) =>
                          prev.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, label: value } : row
                          )
                        );
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={pending}
                      onClick={() =>
                        setPrerequisites((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={reset}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Delete "${taskbook.name}"?`)) return;
                setError(null);
                startTransition(async () => {
                  try {
                    await deleteTaskbookType(taskbook.id);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to delete taskbook");
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

export function TaskbooksAdmin({
  taskbooks,
  pdipEnabled = false,
}: {
  taskbooks: TaskbookTypeWithPrerequisites[];
  pdipEnabled?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(taskbooks);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setItems(taskbooks);
  }, [taskbooks]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setError(null);
    startTransition(async () => {
      try {
        await reorderTaskbookTypes({ taskbookTypeIds: next.map((item) => item.id) });
        router.refresh();
      } catch (err) {
        setItems(taskbooks);
        setError(err instanceof Error ? err.message : "Failed to reorder");
      }
    });
  }

  return (
    <div className="space-y-6">
      <CreateTaskbookTypeForm pdipEnabled={pdipEnabled} />
      <div className="rounded-lg border">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Available taskbooks</p>
          <p className="text-xs text-muted-foreground">
            Drag to reorder. Inactive taskbooks stay on existing records but cannot be newly
            requested or issued.
            {pdipEnabled
              ? " Use “Counts for PDIP” so completed assignments of that taskbook appear on the PDIP report."
              : ""}
          </p>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">No taskbooks yet.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className={cn(pending && "pointer-events-none opacity-70")}>
                {items.map((taskbook) => (
                  <SortableTaskbookRow
                    key={taskbook.id}
                    taskbook={taskbook}
                    pdipEnabled={pdipEnabled}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        {error ? <p className="px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
