"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteShiftPlanItem, setShiftPlanItemCompleted } from "@/app/shift-plan/actions";
import { cn } from "@/lib/cn";
import {
  addShiftBlocks,
  formatDate,
  formatShiftDayRange,
  formatTime,
} from "@/lib/dates";
import { shiftColorForShiftDay } from "@/lib/shift-rotation";
import type { Location } from "@/lib/locations-types";
import {
  compareShiftPlanItems,
  shiftColorBadgeClass,
  shiftPlanCreatorName,
  type ShiftPlanFilter,
  type ShiftPlanItem,
} from "@/lib/shift-plan-types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { ShiftPlanItemForm } from "@/components/ShiftPlanItemForm";

function itemWhen(item: ShiftPlanItem) {
  const parts: string[] = [];
  if (item.item_date) parts.push(formatDate(item.item_date));
  if (item.start_time) {
    const start = formatTime(item.start_time);
    parts.push(item.end_time ? `${start}–${formatTime(item.end_time)}` : start);
  }
  return parts.join(" · ");
}

export function ShiftPlanAgenda({
  shiftDate,
  currentShiftDate,
  items,
  locations,
}: {
  shiftDate: string;
  currentShiftDate: string;
  items: ShiftPlanItem[];
  locations: Location[];
}) {
  const [filter, setFilter] = useState<ShiftPlanFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftPlanItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const color = shiftColorForShiftDay(shiftDate);
  const isCurrent = shiftDate === currentShiftDate;
  const prevShift = addShiftBlocks(shiftDate, -1);
  const nextShift = addShiftBlocks(shiftDate, 1);

  const sortedItems = useMemo(() => items.slice().sort(compareShiftPlanItems), [items]);
  const battalionItems =
    filter === "all" || filter === "battalion"
      ? sortedItems.filter((item) => item.scope === "battalion")
      : [];
  const shownStationGroups =
    filter === "battalion"
      ? []
      : locations
          .filter((location) => filter === "all" || filter === location.id)
          .map((location) => ({
            location,
            items: sortedItems.filter(
              (item) => item.scope === "station" && item.location_id === location.id
            ),
          }));

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(item: ShiftPlanItem) {
    setEditing(item);
    setSheetOpen(true);
  }

  async function onToggleComplete(item: ShiftPlanItem) {
    setCompletingId(item.id);
    try {
      await setShiftPlanItemCompleted({
        id: item.id,
        shiftDate,
        completed: !item.completed,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setCompletingId(null);
    }
  }

  async function onDelete(item: ShiftPlanItem) {
    if (!window.confirm(`Remove "${item.title}" from this shift plan?`)) return;
    setDeletingId(item.id);
    try {
      await deleteShiftPlanItem({ id: item.id, shiftDate });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">
                {color} · {formatShiftDayRange(shiftDate)}
              </CardTitle>
              <Badge className={shiftColorBadgeClass(color)}>{color}</Badge>
              {isCurrent ? <Badge>Current shift</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">48-hour block starting 08:00.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/shift-plan/${prevShift}`} aria-label="Previous shift">
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Link>
            </Button>
            {isCurrent ? null : (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/shift-plan/${currentShiftDate}`}>Today</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/shift-plan/${nextShift}`} aria-label="Next shift">
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip
            label="Battalion"
            active={filter === "battalion"}
            onClick={() => setFilter("battalion")}
          />
          {locations.map((location) => (
            <FilterChip
              key={location.id}
              label={location.name}
              active={filter === location.id}
              onClick={() => setFilter(location.id)}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {filter !== "all" && filter !== "battalion" ? null : (
          <Section title="Battalion" empty={battalionItems.length === 0}>
            {battalionItems.map((item) => (
              <PlanItemRow
                key={item.id}
                item={item}
                deleting={deletingId === item.id}
                completing={completingId === item.id}
                onToggleComplete={() => onToggleComplete(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => onDelete(item)}
              />
            ))}
          </Section>
        )}

        {shownStationGroups.map((group) => (
          <Section
            key={group.location.id}
            title={group.location.name}
            empty={group.items.length === 0}
          >
            {group.items.map((item) => (
              <PlanItemRow
                key={item.id}
                item={item}
                deleting={deletingId === item.id}
                completing={completingId === item.id}
                onToggleComplete={() => onToggleComplete(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => onDelete(item)}
              />
            ))}
          </Section>
        ))}
      </CardContent>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit plan item" : "Add plan item"}</SheetTitle>
            <SheetDescription>
              {color} · {formatShiftDayRange(shiftDate)}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {sheetOpen ? (
              <ShiftPlanItemForm
                key={editing?.id ?? "create"}
                shiftDate={shiftDate}
                locations={locations}
                item={editing}
                onDone={() => {
                  setSheetOpen(false);
                  setEditing(null);
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold tracking-tight">{title}</h3>
      {empty ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Nothing on the plan.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">{children}</ul>
      )}
    </section>
  );
}

function PlanItemRow({
  item,
  deleting,
  completing,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  item: ShiftPlanItem;
  deleting: boolean;
  completing: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const when = itemWhen(item);
  const creator = shiftPlanCreatorName(item.creator);
  const checkboxId = `shift-plan-complete-${item.id}`;
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={item.completed}
          disabled={completing}
          onChange={onToggleComplete}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          aria-label={`Mark ${item.title} complete`}
        />
        <div className="min-w-0">
          <label
            htmlFor={checkboxId}
            className={cn("font-medium", item.completed && "text-muted-foreground line-through")}
          >
            {item.title}
          </label>
          {when ? <p className="text-xs text-muted-foreground">{when}</p> : null}
          {item.notes.trim() ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>
          ) : null}
          {creator ? <p className="mt-1 text-xs text-muted-foreground">Added by {creator}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label="Edit item">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
