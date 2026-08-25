"use client";

import { useEffect, useMemo, useState, useTransition, Fragment, type HTMLAttributes } from "react";
import Link from "next/link";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, LayoutGrid, LayoutList, Plus, Wrench } from "lucide-react";
import type { AssetListRow, AssetStatus } from "@/lib/assets-types";
import { assetDisplayLabel } from "@/lib/assets-types";
import type { MaintenanceRequest, MaintenanceShopStatus } from "@/lib/maintenance-types";
import type { AssetMaintenanceSchedule } from "@/lib/maintenance-schedules";
import {
  isScheduleDueSoon,
  isScheduleOverdue,
  nextDueSchedule,
} from "@/lib/maintenance-schedules";
import { groupFleetRows } from "@/lib/fleet-groups";
import {
  apparatusTypeLabel,
  assetStatusBadgeClass,
  assetStatusLabel,
  maintenanceRequestTypeLabel,
  maintenanceServiceStatusLabel,
  maintenanceShopStatusBadgeClass,
  maintenanceShopStatusLabel,
  maintenanceRequestTypes,
} from "@/lib/labels";
import { cn } from "@/lib/cn";
import { formatDate, isoDateLocal } from "@/lib/dates";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import {
  completeMaintenanceSchedule,
  createFleetWorkOrder,
  createMaintenanceSchedule,
  deleteMaintenanceSchedule,
  resolveFleetWorkOrder,
  setFleetCardVisibility,
  reorderFleetCards,
  updateFleetWorkOrder,
} from "@/app/fleet/actions";

type Mechanic = { id: string; display_name: string | null; email: string | null };
type StatusFilter = "all" | AssetStatus;
type ShopFilter = "all" | "needs_shop";
type BoardView = "table" | "cards";
type Panel =
  | { kind: "workorder"; requestId: string }
  | { kind: "create-wo"; assetId?: string }
  | { kind: "schedules"; assetId: string }
  | null;

const VIEW_STORAGE_KEY = "fleet-board-view-v1";

function loadBoardView(): BoardView {
  if (typeof window === "undefined") return "table";
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === "table" || raw === "cards") return raw;
  } catch {
    // Ignore storage errors and keep the table default.
  }
  return "table";
}

function personLabel(person: Mechanic | null | undefined) {
  return person?.display_name || person?.email || "Unassigned";
}

function mechanicById(mechanics: Mechanic[], id: string | null) {
  if (!id) return null;
  return mechanics.find((mechanic) => mechanic.id === id) ?? null;
}

function lastOpenOos(request: MaintenanceRequest, open: MaintenanceRequest[]) {
  return !open.some(
    (other) =>
      other.id !== request.id &&
      other.service_status === "out_of_service"
  );
}

function assetShopMeta(
  asset: AssetListRow,
  openRequestsByAssetId: Record<string, MaintenanceRequest[]>,
  schedulesByAssetId: Record<string, AssetMaintenanceSchedule[]>
) {
  const requests = openRequestsByAssetId[asset.id] ?? [];
  const schedules = schedulesByAssetId[asset.id] ?? [];
  const nextPm = nextDueSchedule(schedules);
  const assignees = [
    ...new Set(requests.map((request) => request.assigned_to).filter(Boolean)),
  ] as string[];
  return { requests, nextPm, assignees };
}

export function FleetBoard({
  rows,
  openRequestsByAssetId,
  schedulesByAssetId,
  locations,
  station,
  mechanics,
  currentUserId,
}: {
  rows: AssetListRow[];
  openRequestsByAssetId: Record<string, MaintenanceRequest[]>;
  schedulesByAssetId: Record<string, AssetMaintenanceSchedule[]>;
  locations: string[];
  station?: string;
  mechanics: Mechanic[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [shopFilter, setShopFilter] = useState<ShopFilter>("all");
  const [view, setView] = useState<BoardView>("table");
  const [viewHydrated, setViewHydrated] = useState(false);
  const [customizingCards, setCustomizingCards] = useState(false);
  const [sortOverride, setSortOverride] = useState<Record<string, number>>({});
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setView(loadBoardView());
    setViewHydrated(true);
  }, []);

  useEffect(() => {
    if (!viewHydrated) return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view, viewHydrated]);

  const today = isoDateLocal(new Date());

  const summary = useMemo(() => {
    let inService = 0;
    let outOfService = 0;
    let reserve = 0;
    let openWork = 0;
    let overduePm = 0;
    let dueSoon = 0;
    for (const asset of rows) {
      if (asset.status === "in_service") inService += 1;
      if (asset.status === "out_of_service") outOfService += 1;
      if (asset.status === "reserve") reserve += 1;
      openWork += (openRequestsByAssetId[asset.id] ?? []).length;
      for (const schedule of schedulesByAssetId[asset.id] ?? []) {
        if (isScheduleOverdue(schedule.next_due_on, today)) overduePm += 1;
        else if (isScheduleDueSoon(schedule.next_due_on, 7, today)) dueSoon += 1;
      }
    }
    return { inService, outOfService, reserve, openWork, overduePm, dueSoon };
  }, [openRequestsByAssetId, rows, schedulesByAssetId, today]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((asset) => {
      if (statusFilter !== "all" && asset.status !== statusFilter) return false;
      const requests = openRequestsByAssetId[asset.id] ?? [];
      const schedules = schedulesByAssetId[asset.id] ?? [];
      const needsShop =
        requests.length > 0 ||
        schedules.some(
          (schedule) =>
            isScheduleOverdue(schedule.next_due_on, today) ||
            isScheduleDueSoon(schedule.next_due_on, 7, today)
        );
      if (shopFilter === "needs_shop" && !needsShop) return false;
      if (!q) return true;
      const unit = assetDisplayLabel(asset).toLowerCase();
      const type = asset.apparatus_type ? apparatusTypeLabel(asset.apparatus_type).toLowerCase() : "";
      const loc = (asset.station ?? "").toLowerCase();
      const requestMatch = requests.some((request) => request.title.toLowerCase().includes(q));
      const scheduleMatch = schedules.some((schedule) => schedule.title.toLowerCase().includes(q));
      return unit.includes(q) || type.includes(q) || loc.includes(q) || requestMatch || scheduleMatch;
    });
  }, [openRequestsByAssetId, query, rows, schedulesByAssetId, shopFilter, statusFilter, today]);

  const groupedRows = useMemo(() => {
    const source =
      view === "cards" && !customizingCards
        ? filteredRows.filter((asset) => asset.show_on_fleet_cards !== false)
        : filteredRows;
    return groupFleetRows(source, sortOverride);
  }, [customizingCards, filteredRows, sortOverride, view]);

  const canReorderCards =
    view === "cards" &&
    !query.trim() &&
    statusFilter === "all" &&
    shopFilter === "all" &&
    !station;

  useEffect(() => {
    setSortOverride({});
  }, [rows]);

  const selectedRequest = useMemo(() => {
    if (panel?.kind !== "workorder") return null;
    for (const list of Object.values(openRequestsByAssetId)) {
      const found = list.find((request) => request.id === panel.requestId);
      if (found) return found;
    }
    return null;
  }, [openRequestsByAssetId, panel]);

  const selectedAsset = useMemo(() => {
    if (!panel) return null;
    if (panel.kind === "workorder") {
      if (!selectedRequest) return null;
      return rows.find((asset) => asset.id === selectedRequest.asset_id) ?? null;
    }
    if (panel.kind === "create-wo") {
      return panel.assetId ? rows.find((asset) => asset.id === panel.assetId) ?? null : null;
    }
    return rows.find((asset) => asset.id === panel.assetId) ?? null;
  }, [panel, rows, selectedRequest]);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleCardDragEnd(groupRows: AssetListRow[], event: DragEndEvent) {
    if (!canReorderCards) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = groupRows.map((asset) => asset.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextIds = arrayMove(ids, oldIndex, newIndex);
    const previous = sortOverride;
    const nextOverride = { ...sortOverride };
    nextIds.forEach((id, index) => {
      nextOverride[id] = index + 1;
    });
    setSortOverride(nextOverride);
    setError(null);
    startTransition(async () => {
      try {
        await reorderFleetCards({ assetIds: nextIds });
        router.refresh();
      } catch (err) {
        setSortOverride(previous);
        setError(err instanceof Error ? err.message : "Could not save card order.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="In service" value={summary.inService} />
        <SummaryCard label="Out of service" value={summary.outOfService} tone="danger" />
        <SummaryCard label="Reserve" value={summary.reserve} />
        <SummaryCard label="Open work" value={summary.openWork} tone="warn" />
        <SummaryCard label="Overdue PM" value={summary.overduePm} tone="danger" />
        <SummaryCard label="Due in 7 days" value={summary.dueSoon} tone="warn" />
      </div>

      <div className="mb-1 flex flex-wrap gap-1.5">
        <Link
          href="/fleet"
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            !station
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:bg-accent"
          )}
        >
          All locations
        </Link>
        {locations.map((location) => (
          <Link
            key={location}
            href={`/fleet?station=${encodeURIComponent(location)}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              station === location
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-accent"
            )}
          >
            {location}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Unit, type, work, or schedule…"
            className="h-8 max-w-xs text-sm"
            aria-label="Search fleet"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-8 w-auto max-w-[10rem] py-1 text-sm"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="in_service">In service</option>
            <option value="out_of_service">Out of service</option>
            <option value="reserve">Reserve</option>
            <option value="retired">Retired</option>
          </Select>
          <Select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value as ShopFilter)}
            className="h-8 w-auto max-w-[11rem] py-1 text-sm"
            aria-label="Filter shop work"
          >
            <option value="all">All units</option>
            <option value="needs_shop">Needs shop</option>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <ViewToggle
            view={view}
            onChange={(next) => {
              setView(next);
              if (next !== "cards") setCustomizingCards(false);
            }}
          />
          {view === "cards" ? (
            <Button
              size="sm"
              variant={customizingCards ? "default" : "outline"}
              className="h-8"
              onClick={() => setCustomizingCards((open) => !open)}
            >
              {customizingCards ? "Done" : "Customize"}
            </Button>
          ) : null}
          <Button size="sm" className="h-8" onClick={() => setPanel({ kind: "create-wo" })}>
            <Plus className="h-3.5 w-3.5" />
            New work order
          </Button>
        </div>
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      {view === "cards" && customizingCards ? (
        <p className="text-sm text-muted-foreground">
          Choose which units appear on the card board. Hidden units stay on the table.
        </p>
      ) : null}

      {view === "cards" && !canReorderCards && groupedRows.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Clear search, filters, and location to drag cards into a new order.
        </p>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0 ? "No apparatus recorded yet." : "No units match those filters."}
          </p>
        </div>
      ) : groupedRows.length === 0 ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No units are set to show on the card board.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-8"
            onClick={() => setCustomizingCards(true)}
          >
            Customize
          </Button>
        </div>
      ) : view === "cards" ? (
        <div className="space-y-6">
          {groupedRows.map((group) => (
            <section key={group.id} className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                {group.label}
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                  {group.rows.length}
                </Badge>
              </h2>
              <DndContext
                id={`fleet-cards-${group.id}`}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleCardDragEnd(group.rows, event)}
              >
                <SortableContext
                  items={group.rows.map((asset) => asset.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.rows.map((asset) => {
                      const meta = assetShopMeta(asset, openRequestsByAssetId, schedulesByAssetId);
                      return (
                        <SortableFleetUnitCard
                          key={asset.id}
                          asset={asset}
                          requests={meta.requests}
                          nextPm={meta.nextPm}
                          assignees={meta.assignees}
                          mechanics={mechanics}
                          today={today}
                          customizing={customizingCards}
                          pending={pending}
                          sortable={canReorderCards}
                          onOpenWorkOrder={(requestId) => setPanel({ kind: "workorder", requestId })}
                          onOpenSchedules={() => setPanel({ kind: "schedules", assetId: asset.id })}
                          onCreateWorkOrder={() => setPanel({ kind: "create-wo", assetId: asset.id })}
                          onToggleVisible={() =>
                            run(() =>
                              setFleetCardVisibility({
                                assetId: asset.id,
                                visible: asset.show_on_fleet_cards === false,
                              })
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="border-b bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Unit</th>
                <th className="px-2 py-1.5 font-medium">Type</th>
                <th className="px-2 py-1.5 font-medium">Location</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
                <th className="px-2 py-1.5 font-medium">Open work</th>
                <th className="px-2 py-1.5 font-medium">Assignee</th>
                <th className="px-2 py-1.5 font-medium">Next PM</th>
                <th className="px-2 py-1.5 font-medium">Last daily</th>
                <th className="px-2 py-1.5 font-medium">Last weekly</th>
                <th className="px-2 py-1.5 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((group) => (
                <Fragment key={group.id}>
                  <tr>
                    <th
                      colSpan={10}
                      scope="colgroup"
                      className="border-b bg-muted/40 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {group.label}
                      <span className="ml-1.5 font-normal">({group.rows.length})</span>
                    </th>
                  </tr>
                  {group.rows.map((asset) => {
                    const { requests, nextPm, assignees } = assetShopMeta(
                      asset,
                      openRequestsByAssetId,
                      schedulesByAssetId
                    );
                    return (
                      <tr key={asset.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20">
                        <td className="px-2 py-1.5 align-top">
                          <Link href={`/assets/${asset.id}`} className="font-medium hover:underline">
                            {assetDisplayLabel(asset)}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          {asset.apparatus_type ? apparatusTypeLabel(asset.apparatus_type) : "—"}
                        </td>
                        <td className="px-2 py-1.5 align-top">{asset.station || "—"}</td>
                        <td className="px-2 py-1.5 align-top">
                          <Badge className={cn(assetStatusBadgeClass(asset.status), "px-1.5 py-0 text-[10px]")}>
                            {assetStatusLabel(asset.status)}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <WorkOrderChips
                            requests={requests}
                            onOpen={(requestId) => setPanel({ kind: "workorder", requestId })}
                          />
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          {assignees.length === 0
                            ? "—"
                            : assignees
                                .map((id) => personLabel(mechanicById(mechanics, id)))
                                .join(", ")}
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <NextPmControl
                            nextPm={nextPm}
                            today={today}
                            onOpen={() => setPanel({ kind: "schedules", assetId: asset.id })}
                          />
                        </td>
                        <td className="px-2 py-1.5 align-top">{formatDate(asset.latest_daily_checked_at)}</td>
                        <td className="px-2 py-1.5 align-top">{formatDate(asset.latest_weekly_checked_at)}</td>
                        <td className="px-2 py-1.5 align-top text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => setPanel({ kind: "create-wo", assetId: asset.id })}
                            >
                              WO
                            </button>
                            <Link
                              href={`/assets/${asset.id}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={panel != null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {panel?.kind === "workorder" && selectedRequest && selectedAsset ? (
            <WorkOrderPanel
              key={selectedRequest.id}
              request={selectedRequest}
              asset={selectedAsset}
              openRequests={openRequestsByAssetId[selectedAsset.id] ?? []}
              mechanics={mechanics}
              currentUserId={currentUserId}
              pending={pending}
              error={error}
              onAssign={(assignedTo) =>
                run(() => updateFleetWorkOrder({ requestId: selectedRequest.id, assignedTo }))
              }
              onShopStatus={(shopStatus) =>
                run(() => updateFleetWorkOrder({ requestId: selectedRequest.id, shopStatus }))
              }
              onSaveNotes={(shopNotes) =>
                run(() => updateFleetWorkOrder({ requestId: selectedRequest.id, shopNotes }))
              }
              onResolve={(resolvedNote, returnToService) =>
                run(async () => {
                  await resolveFleetWorkOrder({
                    requestId: selectedRequest.id,
                    resolvedNote,
                    returnToService,
                  });
                  setPanel(null);
                })
              }
            />
          ) : null}
          {panel?.kind === "create-wo" ? (
            <CreateWorkOrderForm
              rows={rows}
              defaultAssetId={panel.assetId}
              mechanics={mechanics}
              currentUserId={currentUserId}
              pending={pending}
              error={error}
              onSubmit={(values) =>
                run(async () => {
                  await createFleetWorkOrder(values);
                  setPanel(null);
                })
              }
            />
          ) : null}
          {panel?.kind === "schedules" && selectedAsset ? (
            <SchedulesPanel
              asset={selectedAsset}
              schedules={schedulesByAssetId[selectedAsset.id] ?? []}
              pending={pending}
              error={error}
              onCreate={(values) =>
                run(() =>
                  createMaintenanceSchedule({
                    assetId: selectedAsset.id,
                    ...values,
                  })
                )
              }
              onComplete={(scheduleId) =>
                run(() => completeMaintenanceSchedule({ scheduleId }))
              }
              onDelete={(scheduleId) =>
                run(() => deleteMaintenanceSchedule({ scheduleId }))
              }
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: BoardView;
  onChange: (view: BoardView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Fleet layout"
      className="inline-flex h-8 overflow-hidden rounded-md border"
    >
      <button
        type="button"
        aria-pressed={view === "table"}
        onClick={() => onChange("table")}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 text-sm font-medium transition-colors",
          view === "table"
            ? "bg-primary text-primary-foreground"
            : "bg-background hover:bg-accent"
        )}
      >
        <LayoutList className="h-3.5 w-3.5" />
        Table
      </button>
      <button
        type="button"
        aria-pressed={view === "cards"}
        onClick={() => onChange("cards")}
        className={cn(
          "inline-flex items-center gap-1.5 border-l px-2.5 text-sm font-medium transition-colors",
          view === "cards"
            ? "bg-primary text-primary-foreground"
            : "bg-background hover:bg-accent"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Cards
      </button>
    </div>
  );
}

function WorkOrderChips({
  requests,
  onOpen,
  emptyLabel = "—",
}: {
  requests: MaintenanceRequest[];
  onOpen: (requestId: string) => void;
  emptyLabel?: string;
}) {
  if (requests.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {requests.map((request) => (
        <button
          key={request.id}
          type="button"
          onClick={() => onOpen(request.id)}
          className="inline-flex max-w-[14rem] items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-left text-[10px] text-amber-950 hover:bg-amber-100"
        >
          <Wrench className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{request.title}</span>
        </button>
      ))}
    </div>
  );
}

function NextPmControl({
  nextPm,
  today,
  onOpen,
}: {
  nextPm: AssetMaintenanceSchedule | null;
  today: string;
  onOpen: () => void;
}) {
  if (!nextPm) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="text-muted-foreground hover:underline"
      >
        Add
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "text-left hover:underline",
        isScheduleOverdue(nextPm.next_due_on, today) && "font-medium text-destructive"
      )}
    >
      <span className="block">{nextPm.title}</span>
      <span className="text-muted-foreground">{formatDate(nextPm.next_due_on)}</span>
    </button>
  );
}

function statusAccentClass(status: AssetStatus) {
  switch (status) {
    case "out_of_service":
      return "border-l-red-500";
    case "reserve":
      return "border-l-amber-400";
    case "retired":
      return "border-l-slate-400";
    default:
      return "border-l-emerald-500";
  }
}

function SortableFleetUnitCard({
  sortable,
  ...props
}: {
  asset: AssetListRow;
  requests: MaintenanceRequest[];
  nextPm: AssetMaintenanceSchedule | null;
  assignees: string[];
  mechanics: Mechanic[];
  today: string;
  customizing: boolean;
  pending: boolean;
  sortable: boolean;
  onOpenWorkOrder: (requestId: string) => void;
  onOpenSchedules: () => void;
  onCreateWorkOrder: () => void;
  onToggleVisible: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.asset.id,
    disabled: !sortable,
  });
  const style = {
    transform: CSS.Transform.toString(transform) || undefined,
    transition: transition || undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-10 opacity-80")}>
      <FleetUnitCard
        {...props}
        dragHandle={
          sortable ? { attributes, listeners, disabled: props.pending } : undefined
        }
      />
    </div>
  );
}

function FleetUnitCard({
  asset,
  requests,
  nextPm,
  assignees,
  mechanics,
  today,
  customizing,
  pending,
  dragHandle,
  onOpenWorkOrder,
  onOpenSchedules,
  onCreateWorkOrder,
  onToggleVisible,
}: {
  asset: AssetListRow;
  requests: MaintenanceRequest[];
  nextPm: AssetMaintenanceSchedule | null;
  assignees: string[];
  mechanics: Mechanic[];
  today: string;
  customizing: boolean;
  pending: boolean;
  dragHandle?: {
    attributes: HTMLAttributes<HTMLButtonElement>;
    listeners?: HTMLAttributes<HTMLButtonElement>;
    disabled?: boolean;
  };
  onOpenWorkOrder: (requestId: string) => void;
  onOpenSchedules: () => void;
  onCreateWorkOrder: () => void;
  onToggleVisible: () => void;
}) {
  const typeLabel = asset.apparatus_type ? apparatusTypeLabel(asset.apparatus_type) : null;
  const location = asset.station || "—";
  const overduePm = nextPm ? isScheduleOverdue(nextPm.next_due_on, today) : false;
  const dueSoonPm = nextPm ? isScheduleDueSoon(nextPm.next_due_on, 7, today) : false;
  const hidden = asset.show_on_fleet_cards === false;

  return (
    <Card
      className={cn(
        "flex h-full flex-col border-l-4",
        statusAccentClass(asset.status),
        customizing && hidden && "opacity-60"
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 p-4 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg leading-snug">
            <Link
              href={`/assets/${asset.id}`}
              className="hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {assetDisplayLabel(asset)}
            </Link>
          </CardTitle>
          <CardDescription>
            {[typeLabel, location].filter(Boolean).join(" · ")}
            {customizing && hidden ? " · Hidden from cards" : ""}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          {dragHandle ? (
            <button
              type="button"
              disabled={dragHandle.disabled}
              className="inline-flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing disabled:opacity-50"
              aria-label={`Reorder ${assetDisplayLabel(asset)}`}
              {...dragHandle.attributes}
              {...dragHandle.listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {customizing ? (
            <button
              type="button"
              disabled={pending}
              onClick={onToggleVisible}
              aria-pressed={!hidden}
              aria-label={hidden ? "Show on card board" : "Hide from card board"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          ) : null}
          <Badge className={cn(assetStatusBadgeClass(asset.status), "px-1.5 py-0 text-[10px]")}>
            {assetStatusLabel(asset.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Open work</p>
          <div className="mt-1">
            <WorkOrderChips
              requests={requests}
              onOpen={onOpenWorkOrder}
              emptyLabel="No open work"
            />
          </div>
          {assignees.length > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {assignees.map((id) => personLabel(mechanicById(mechanics, id))).join(", ")}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Next PM</p>
          <div className="mt-0.5">
            {nextPm ? (
              <button
                type="button"
                onClick={onOpenSchedules}
                className={cn(
                  "text-left text-sm hover:underline",
                  overduePm && "font-medium text-destructive",
                  dueSoonPm && !overduePm && "font-medium text-amber-800"
                )}
              >
                <span className="block">{nextPm.title}</span>
                <span className={cn(!overduePm && !dueSoonPm && "text-muted-foreground")}>
                  {formatDate(nextPm.next_due_on)}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSchedules}
                className="text-sm text-muted-foreground hover:underline"
              >
                Add schedule
              </button>
            )}
          </div>
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Last daily</dt>
            <dd className="mt-0.5 font-medium">{formatDate(asset.latest_daily_checked_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last weekly</dt>
            <dd className="mt-0.5 font-medium">{formatDate(asset.latest_weekly_checked_at)}</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="justify-end gap-3 p-4 pt-0">
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={onCreateWorkOrder}
        >
          WO
        </button>
        <Link href={`/assets/${asset.id}`} className="text-xs font-medium text-primary hover:underline">
          View
        </Link>
      </CardFooter>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger" | "warn";
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold",
          tone === "danger" && value > 0 && "text-destructive",
          tone === "warn" && value > 0 && "text-amber-800"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function WorkOrderPanel({
  request,
  asset,
  openRequests,
  mechanics,
  currentUserId,
  pending,
  error,
  onAssign,
  onShopStatus,
  onSaveNotes,
  onResolve,
}: {
  request: MaintenanceRequest;
  asset: AssetListRow;
  openRequests: MaintenanceRequest[];
  mechanics: Mechanic[];
  currentUserId: string;
  pending: boolean;
  error: string | null;
  onAssign: (assignedTo: string | null) => void;
  onShopStatus: (status: MaintenanceShopStatus) => void;
  onSaveNotes: (notes: string) => void;
  onResolve: (resolvedNote: string, returnToService: boolean) => void;
}) {
  const [notes, setNotes] = useState(request.shop_notes ?? "");
  const [resolvedNote, setResolvedNote] = useState("");
  const defaultReturn =
    asset.status === "out_of_service" && lastOpenOos(request, openRequests);
  const [returnToService, setReturnToService] = useState(defaultReturn);

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>{request.title}</SheetTitle>
        <SheetDescription>
          {assetDisplayLabel(asset)}
          {asset.station ? ` · ${asset.station}` : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-wrap gap-1.5">
        <Badge className={cn(maintenanceShopStatusBadgeClass(request.shop_status ?? "new"), "text-[10px]")}>
          {maintenanceShopStatusLabel(request.shop_status ?? "new")}
        </Badge>
        <Badge variant="outline">{maintenanceRequestTypeLabel(request.request_type)}</Badge>
        <Badge variant="outline">{maintenanceServiceStatusLabel(request.service_status)}</Badge>
      </div>
      {request.description.trim() ? (
        <p className="whitespace-pre-wrap text-sm">{request.description}</p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}

      <div className="space-y-1.5">
        <FieldLabel htmlFor="fleet-assignee">Assignee</FieldLabel>
        <Select
          id="fleet-assignee"
          value={request.assigned_to ?? ""}
          disabled={pending}
          onChange={(e) => onAssign(e.target.value || null)}
        >
          <option value="">Unassigned</option>
          <option value={currentUserId}>Assign to me</option>
          {mechanics
            .filter((mechanic) => mechanic.id !== currentUserId)
            .map((mechanic) => (
              <option key={mechanic.id} value={mechanic.id}>
                {personLabel(mechanic)}
              </option>
            ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="fleet-shop-status">Shop status</FieldLabel>
        <Select
          id="fleet-shop-status"
          value={request.shop_status ?? "new"}
          disabled={pending}
          onChange={(e) => onShopStatus(e.target.value as MaintenanceShopStatus)}
        >
          <option value="new">New</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
          <option value="on_hold">On hold</option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="fleet-shop-notes">Shop notes</FieldLabel>
        <Textarea
          id="fleet-shop-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onSaveNotes(notes)}
        >
          Save notes
        </Button>
      </div>

      <div className="space-y-2 border-t pt-3">
        <FieldLabel htmlFor="fleet-resolved-note">Resolve</FieldLabel>
        <Textarea
          id="fleet-resolved-note"
          rows={3}
          value={resolvedNote}
          onChange={(e) => setResolvedNote(e.target.value)}
          placeholder="Resolution note (optional)"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={returnToService}
            onChange={(e) => setReturnToService(e.target.checked)}
          />
          Return unit to in service
        </label>
        <Button
          size="sm"
          disabled={pending}
          onClick={() => onResolve(resolvedNote, returnToService)}
        >
          {pending ? "Saving…" : "Resolve work order"}
        </Button>
      </div>

      <Button asChild variant="outline" size="sm">
        <Link href={`/assets/${asset.id}`}>Open unit page</Link>
      </Button>
    </div>
  );
}

function CreateWorkOrderForm({
  rows,
  defaultAssetId,
  mechanics,
  currentUserId,
  pending,
  error,
  onSubmit,
}: {
  rows: AssetListRow[];
  defaultAssetId?: string;
  mechanics: Mechanic[];
  currentUserId: string;
  pending: boolean;
  error: string | null;
  onSubmit: (values: {
    assetId: string;
    title: string;
    requestType: MaintenanceRequest["request_type"];
    serviceStatus: MaintenanceRequest["service_status"];
    description?: string;
    assignedTo?: string | null;
  }) => void;
}) {
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [title, setTitle] = useState("");
  const [requestType, setRequestType] = useState<MaintenanceRequest["request_type"]>("minor");
  const [serviceStatus, setServiceStatus] =
    useState<MaintenanceRequest["service_status"]>("in_service");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          assetId,
          title,
          requestType,
          serviceStatus,
          description,
          assignedTo: assignedTo || null,
        });
      }}
    >
      <SheetHeader>
        <SheetTitle>New work order</SheetTitle>
        <SheetDescription>Create shop work against an apparatus unit.</SheetDescription>
      </SheetHeader>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="space-y-1.5">
        <FieldLabel htmlFor="fleet-wo-unit">Unit</FieldLabel>
        <Select
          id="fleet-wo-unit"
          required
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
        >
          <option value="">Select unit…</option>
          {rows.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {assetDisplayLabel(asset)}
              {asset.station ? ` · ${asset.station}` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="fleet-wo-title">Title</FieldLabel>
        <Input
          id="fleet-wo-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fleet-wo-type">Type</FieldLabel>
          <Select
            id="fleet-wo-type"
            value={requestType}
            onChange={(e) =>
              setRequestType(e.target.value as MaintenanceRequest["request_type"])
            }
          >
            {maintenanceRequestTypes.map((type) => (
              <option key={type} value={type}>
                {maintenanceRequestTypeLabel(type)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fleet-wo-service">Service</FieldLabel>
          <Select
            id="fleet-wo-service"
            value={serviceStatus}
            onChange={(e) =>
              setServiceStatus(e.target.value as MaintenanceRequest["service_status"])
            }
          >
            <option value="in_service">Remain in service</option>
            <option value="out_of_service">Out of service</option>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="fleet-wo-assignee">Assignee</FieldLabel>
        <Select
          id="fleet-wo-assignee"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        >
          <option value="">Unassigned</option>
          <option value={currentUserId}>Assign to me</option>
          {mechanics
            .filter((mechanic) => mechanic.id !== currentUserId)
            .map((mechanic) => (
              <option key={mechanic.id} value={mechanic.id}>
                {personLabel(mechanic)}
              </option>
            ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="fleet-wo-desc">Description</FieldLabel>
        <Textarea
          id="fleet-wo-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending || !assetId}>
        {pending ? "Creating…" : "Create work order"}
      </Button>
    </form>
  );
}

function SchedulesPanel({
  asset,
  schedules,
  pending,
  error,
  onCreate,
  onComplete,
  onDelete,
}: {
  asset: AssetListRow;
  schedules: AssetMaintenanceSchedule[];
  pending: boolean;
  error: string | null;
  onCreate: (values: { title: string; intervalDays: number; nextDueOn?: string; notes?: string }) => void;
  onComplete: (scheduleId: string) => void;
  onDelete: (scheduleId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [intervalDays, setIntervalDays] = useState("90");
  const [nextDueOn, setNextDueOn] = useState("");
  const [notes, setNotes] = useState("");
  const today = isoDateLocal(new Date());

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>Maintenance schedules</SheetTitle>
        <SheetDescription>{assetDisplayLabel(asset)}</SheetDescription>
      </SheetHeader>
      {error ? <FieldError>{error}</FieldError> : null}

      {schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schedules on this unit yet.</p>
      ) : (
        <ul className="space-y-2">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="rounded-md border px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{schedule.title}</p>
                  <p
                    className={cn(
                      "text-xs",
                      isScheduleOverdue(schedule.next_due_on, today)
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    Next due {formatDate(schedule.next_due_on)} · every {schedule.interval_days} days
                    {schedule.last_completed_on
                      ? ` · last ${formatDate(schedule.last_completed_on)}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => onComplete(schedule.id)}
                >
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onDelete(schedule.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-2 border-t pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({
            title,
            intervalDays: Number(intervalDays),
            nextDueOn: nextDueOn || undefined,
            notes,
          });
          setTitle("");
          setNotes("");
        }}
      >
        <p className="text-sm font-medium">Add schedule</p>
        <Input
          required
          placeholder="Title (e.g. Pump test)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={1}
            required
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)}
            aria-label="Interval days"
          />
          <Input
            type="date"
            value={nextDueOn}
            onChange={(e) => setNextDueOn(e.target.value)}
            aria-label="Next due"
          />
        </div>
        <Textarea
          rows={2}
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add schedule"}
        </Button>
      </form>
    </div>
  );
}
