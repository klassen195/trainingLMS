"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Wrench } from "lucide-react";
import type { AssetListRow, AssetStatus } from "@/lib/assets-types";
import { assetDisplayLabel } from "@/lib/assets-types";
import type { MaintenanceRequest, MaintenanceShopStatus } from "@/lib/maintenance-types";
import type { AssetMaintenanceSchedule } from "@/lib/maintenance-schedules";
import {
  isScheduleDueSoon,
  isScheduleOverdue,
  nextDueSchedule,
} from "@/lib/maintenance-schedules";
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
  updateFleetWorkOrder,
} from "@/app/fleet/actions";

type Mechanic = { id: string; display_name: string | null; email: string | null };
type StatusFilter = "all" | AssetStatus;
type ShopFilter = "all" | "needs_shop";
type Panel =
  | { kind: "workorder"; requestId: string }
  | { kind: "create-wo"; assetId?: string }
  | { kind: "schedules"; assetId: string }
  | null;

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
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);

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
        <Button size="sm" className="h-8" onClick={() => setPanel({ kind: "create-wo" })}>
          <Plus className="h-3.5 w-3.5" />
          New work order
        </Button>
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      {filteredRows.length === 0 ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0 ? "No apparatus recorded yet." : "No units match those filters."}
          </p>
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
              {filteredRows.map((asset) => {
                const requests = openRequestsByAssetId[asset.id] ?? [];
                const schedules = schedulesByAssetId[asset.id] ?? [];
                const nextPm = nextDueSchedule(schedules);
                const assignees = [
                  ...new Set(requests.map((request) => request.assigned_to).filter(Boolean)),
                ] as string[];
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
                      {requests.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {requests.map((request) => (
                            <button
                              key={request.id}
                              type="button"
                              onClick={() => setPanel({ kind: "workorder", requestId: request.id })}
                              className="inline-flex max-w-[14rem] items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-left text-[10px] text-amber-950 hover:bg-amber-100"
                            >
                              <Wrench className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{request.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {assignees.length === 0
                        ? "—"
                        : assignees
                            .map((id) => personLabel(mechanicById(mechanics, id)))
                            .join(", ")}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {nextPm ? (
                        <button
                          type="button"
                          onClick={() => setPanel({ kind: "schedules", assetId: asset.id })}
                          className={cn(
                            "text-left hover:underline",
                            isScheduleOverdue(nextPm.next_due_on, today) && "font-medium text-destructive"
                          )}
                        >
                          <span className="block">{nextPm.title}</span>
                          <span className="text-muted-foreground">{formatDate(nextPm.next_due_on)}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPanel({ kind: "schedules", assetId: asset.id })}
                          className="text-muted-foreground hover:underline"
                        >
                          Add
                        </button>
                      )}
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
