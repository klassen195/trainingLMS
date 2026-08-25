"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns3,
  Wrench,
} from "lucide-react";
import type { AssetListRow } from "@/lib/assets-types";
import { assetDisplayLabel } from "@/lib/assets-types";
import type { MaintenanceRequest } from "@/lib/maintenance-types";
import {
  apparatusTypeLabel,
  assetStatusBadgeClass,
  assetStatusLabel,
  maintenanceRequestTypeLabel,
  maintenanceServiceStatusLabel,
} from "@/lib/labels";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

type ColumnId =
  | "unit"
  | "buildNumber"
  | "type"
  | "station"
  | "status"
  | "year"
  | "manufacturer"
  | "model"
  | "lastDaily"
  | "lastWeekly"
  | "notes";

type SortDir = "asc" | "desc";

const STORAGE_KEY = "apparatus-table-columns-v2";
const NO_LOCATION = "No location";

const COLUMN_DEFS: {
  id: ColumnId;
  label: string;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
}[] = [
  { id: "unit", label: "Unit", defaultVisible: true, alwaysVisible: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "buildNumber", label: "Build", defaultVisible: true },
  { id: "station", label: "Location", defaultVisible: false },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "year", label: "Year", defaultVisible: true },
  { id: "manufacturer", label: "Manufacturer", defaultVisible: false },
  { id: "model", label: "Model", defaultVisible: false },
  { id: "lastDaily", label: "Last daily", defaultVisible: true },
  { id: "lastWeekly", label: "Last weekly", defaultVisible: true },
  { id: "notes", label: "Notes", defaultVisible: false },
];

type StationGroup = {
  key: string;
  label: string;
  rows: AssetListRow[];
};

function stationName(asset: AssetListRow) {
  return asset.station?.trim() || "";
}

function typeName(asset: AssetListRow) {
  return asset.apparatus_type ? apparatusTypeLabel(asset.apparatus_type) : "";
}

function stationKey(asset: AssetListRow) {
  return stationName(asset) || NO_LOCATION;
}

function defaultVisibility(): Record<ColumnId, boolean> {
  const visibility = {} as Record<ColumnId, boolean>;
  for (const col of COLUMN_DEFS) {
    visibility[col.id] = col.defaultVisible;
  }
  return visibility;
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function compareDate(a: string | null | undefined, b: string | null | undefined) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function compareNumber(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function sortValue(asset: AssetListRow, column: ColumnId): string | number | null {
  switch (column) {
    case "unit":
      return assetDisplayLabel(asset);
    case "buildNumber":
      return asset.build_number ?? "";
    case "type":
      return typeName(asset);
    case "station":
      return stationName(asset);
    case "status":
      return assetStatusLabel(asset.status);
    case "year":
      return asset.year;
    case "manufacturer":
      return asset.manufacturer ?? "";
    case "model":
      return asset.model ?? "";
    case "lastDaily":
      return asset.latest_daily_checked_at ?? "";
    case "lastWeekly":
      return asset.latest_weekly_checked_at ?? "";
    case "notes":
      return asset.notes ?? "";
  }
}

function sortRows(rows: AssetListRow[], sortBy: ColumnId, sortDir: SortDir) {
  const dir = sortDir === "asc" ? 1 : -1;
  const withIndex = rows.map((row, idx) => ({ row, idx }));
  withIndex.sort((a, b) => {
    const av = sortValue(a.row, sortBy);
    const bv = sortValue(b.row, sortBy);
    let cmp = 0;
    if (sortBy === "year") {
      cmp = compareNumber(
        typeof av === "number" ? av : null,
        typeof bv === "number" ? bv : null
      );
    } else if (sortBy === "lastDaily" || sortBy === "lastWeekly") {
      cmp = compareDate(
        typeof av === "string" ? av || null : null,
        typeof bv === "string" ? bv || null : null
      );
    } else {
      cmp = compareText(String(av ?? ""), String(bv ?? ""));
    }
    if (cmp !== 0) return cmp * dir;
    return a.idx - b.idx;
  });
  return withIndex.map((item) => item.row);
}

function loadVisibility(): Record<ColumnId, boolean> {
  const defaults = defaultVisibility();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<ColumnId, boolean>>;
    const next = { ...defaults };
    for (const col of COLUMN_DEFS) {
      if (col.alwaysVisible) {
        next[col.id] = true;
        continue;
      }
      if (typeof parsed[col.id] === "boolean") {
        next[col.id] = parsed[col.id]!;
      }
    }
    return next;
  } catch {
    return defaults;
  }
}

function groupRows(rows: AssetListRow[], sortBy: ColumnId, sortDir: SortDir): StationGroup[] {
  const stationMap = new Map<string, { label: string; rows: AssetListRow[] }>();

  for (const asset of rows) {
    const key = stationKey(asset);
    const label = stationName(asset) || NO_LOCATION;
    let station = stationMap.get(key);
    if (!station) {
      station = { label, rows: [] };
      stationMap.set(key, station);
    }
    station.rows.push(asset);
  }

  return [...stationMap.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      rows: sortRows(value.rows, sortBy, sortDir),
    }))
    .sort((a, b) => {
      if (a.label === NO_LOCATION) return 1;
      if (b.label === NO_LOCATION) return -1;
      return compareText(a.label, b.label);
    });
}

export function ApparatusTable({
  rows,
  openRequestsByAssetId,
  emptyMessage,
  canRequestMaintenance = false,
}: {
  rows: AssetListRow[];
  openRequestsByAssetId: Record<string, MaintenanceRequest[]>;
  emptyMessage: string;
  canRequestMaintenance?: boolean;
}) {
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<ColumnId>("unit");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openStations, setOpenStations] = useState<string[]>([]);
  const [sectionsInitialized, setSectionsInitialized] = useState(false);

  useEffect(() => {
    setVisibility(loadVisibility());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  }, [hydrated, visibility]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((asset) => {
      const unit = assetDisplayLabel(asset).toLowerCase();
      const build = (asset.build_number ?? "").toLowerCase();
      const type = typeName(asset).toLowerCase();
      const station = stationName(asset).toLowerCase();
      const requests = openRequestsByAssetId[asset.id] ?? [];
      const requestMatch = requests.some((request) => request.title.toLowerCase().includes(q));
      return (
        unit.includes(q) ||
        build.includes(q) ||
        type.includes(q) ||
        station.includes(q) ||
        requestMatch
      );
    });
  }, [openRequestsByAssetId, query, rows]);

  const groups = useMemo(
    () => groupRows(filteredRows, sortBy, sortDir),
    [filteredRows, sortBy, sortDir]
  );

  useEffect(() => {
    if (sectionsInitialized || groups.length === 0) return;
    setOpenStations(groups.map((g) => g.key));
    setSectionsInitialized(true);
  }, [groups, sectionsInitialized]);

  useEffect(() => {
    if (!query.trim()) return;
    setOpenStations(groupRows(filteredRows, "unit", "asc").map((g) => g.key));
  }, [query, filteredRows]);

  const toggleableColumns = useMemo(
    () => COLUMN_DEFS.filter((col) => !col.alwaysVisible),
    []
  );

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((col) => visibility[col.id]),
    [visibility]
  );

  function toggleSort(column: ColumnId) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  }

  function sortIcon(column: ColumnId) {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  }

  function setColumnVisible(id: ColumnId, visible: boolean) {
    setVisibility((prev) => ({ ...prev, [id]: visible }));
  }

  function expandAll() {
    setOpenStations(groups.map((g) => g.key));
  }

  function collapseAll() {
    setOpenStations([]);
  }

  function renderCell(asset: AssetListRow, column: ColumnId) {
    switch (column) {
      case "unit":
        return (
          <Link href={`/assets/${asset.id}`} className="font-medium hover:underline">
            {assetDisplayLabel(asset)}
          </Link>
        );
      case "buildNumber":
        return asset.build_number || "—";
      case "type":
        return typeName(asset) || "—";
      case "station":
        return stationName(asset) || "—";
      case "status":
        return (
          <Badge className={cn(assetStatusBadgeClass(asset.status), "px-1.5 py-0 text-[10px]")}>
            {assetStatusLabel(asset.status)}
          </Badge>
        );
      case "year":
        return asset.year ?? "—";
      case "manufacturer":
        return asset.manufacturer || "—";
      case "model":
        return asset.model || "—";
      case "lastDaily":
        return formatDate(asset.latest_daily_checked_at);
      case "lastWeekly":
        return formatDate(asset.latest_weekly_checked_at);
      case "notes":
        return asset.notes ? (
          <span className="line-clamp-1 max-w-[12rem]">{asset.notes}</span>
        ) : (
          "—"
        );
    }
  }

  function renderTable(groupRowsList: AssetListRow[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-b bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  className="px-2 py-1 font-medium"
                  aria-sort={
                    sortBy === col.id
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.id)}
                    className="inline-flex items-center gap-1 rounded px-0.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
                  >
                    {col.label}
                    {sortIcon(col.id)}
                  </button>
                </th>
              ))}
              <th className="px-2 py-1 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {groupRowsList.map((asset) => {
              const requests = openRequestsByAssetId[asset.id] ?? [];
              return (
                <Fragment key={asset.id}>
                  <tr
                    className={cn(
                      "hover:bg-muted/20",
                      requests.length === 0 && "border-b border-border/70 last:border-0"
                    )}
                  >
                    {visibleColumns.map((col) => (
                      <td key={col.id} className="px-2 py-1 align-middle">
                        {renderCell(asset, col.id)}
                      </td>
                    ))}
                    <td className="px-2 py-1 align-middle text-right">
                      <div className="flex flex-wrap items-center justify-end gap-x-2">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                        {canRequestMaintenance ? (
                          <Link
                            href={`/assets/${asset.id}/maintenance/new`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Request
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {requests.length > 0 ? (
                    <tr className="border-b border-border/70 last:border-0 bg-amber-50/60">
                      <td
                        colSpan={visibleColumns.length + 1}
                        className="px-2 py-1.5 align-top"
                      >
                        <ul className="space-y-0.5">
                          {requests.map((request) => (
                            <li
                              key={request.id}
                              className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-amber-950"
                            >
                              <Wrench className="h-3 w-3 shrink-0 text-amber-800" />
                              <Link
                                href={`/assets/${asset.id}`}
                                className="font-medium hover:underline"
                              >
                                {request.title}
                              </Link>
                              <span className="text-muted-foreground">
                                {maintenanceRequestTypeLabel(request.request_type)}
                                {request.service_status === "out_of_service"
                                  ? ` · ${maintenanceServiceStatusLabel(request.service_status)}`
                                  : ""}
                                {" · "}
                                {formatDate(request.requested_at)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border py-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Unit, build, type, or location…"
            className="h-8 max-w-xs text-sm"
            aria-label="Search apparatus"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={expandAll}>
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Expand
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={collapseAll}>
            <ChevronsDownUp className="h-3.5 w-3.5" />
            Collapse
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 px-2">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {toggleableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={visibility[col.id]}
                  onCheckedChange={(checked) => setColumnVisible(col.id, checked === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">No apparatus matches that search.</p>
        </div>
      ) : (
        <Accordion
          type="multiple"
          value={openStations}
          onValueChange={setOpenStations}
          className="space-y-1"
        >
          {groups.map((station) => (
            <AccordionItem
              key={station.key}
              value={station.key}
              className="overflow-hidden rounded-md border border-border"
            >
              <AccordionTrigger className="bg-muted/30 px-2.5 py-1.5 text-sm hover:no-underline">
                <span className="flex items-center gap-1.5 text-left">
                  <span className="font-semibold">{station.label}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                    {station.rows.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-1.5 pb-1.5 pt-0">
                {renderTable(station.rows)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
