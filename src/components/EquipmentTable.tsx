"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns3,
} from "lucide-react";
import type { AssetListRow } from "@/lib/assets-types";
import { assetDisplayLabel, equipmentAssignmentLabel } from "@/lib/assets-types";
import {
  assetStatusBadgeClass,
  assetStatusLabel,
  ppeCategoryLabel,
} from "@/lib/labels";
import { cn } from "@/lib/cn";
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
  | "equipmentId"
  | "category"
  | "subcategory"
  | "description"
  | "status"
  | "assignedTo"
  | "size"
  | "manufacturer"
  | "model"
  | "serialNumber"
  | "manufacturedOn"
  | "replacementDate"
  | "purchaseCost"
  | "inServiceOn"
  | "nextInspection"
  | "lastInspected"
  | "notes";

type SortDir = "asc" | "desc";

const STORAGE_KEY = "equipment-table-columns-v4";
const UNCATEGORIZED = "Uncategorized";
const NO_SUBCATEGORY = "No subcategory";

const COLUMN_DEFS: {
  id: ColumnId;
  label: string;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
  adminOnly?: boolean;
}[] = [
  { id: "equipmentId", label: "Equipment ID", defaultVisible: true, alwaysVisible: true },
  { id: "category", label: "Category", defaultVisible: false },
  { id: "subcategory", label: "Subcategory", defaultVisible: false },
  { id: "description", label: "Description", defaultVisible: false },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "assignedTo", label: "Assigned to", defaultVisible: true, adminOnly: true },
  { id: "size", label: "Size", defaultVisible: false },
  { id: "manufacturer", label: "Manufacturer", defaultVisible: false },
  { id: "model", label: "Model number", defaultVisible: false },
  { id: "serialNumber", label: "Serial number", defaultVisible: false },
  { id: "manufacturedOn", label: "Manufacture date", defaultVisible: false },
  { id: "replacementDate", label: "Replacement date", defaultVisible: true },
  { id: "purchaseCost", label: "Purchase cost", defaultVisible: false },
  { id: "inServiceOn", label: "In service date", defaultVisible: false },
  { id: "nextInspection", label: "Next inspection", defaultVisible: true },
  { id: "lastInspected", label: "Last inspected", defaultVisible: false },
  { id: "notes", label: "Notes", defaultVisible: false },
];

type SubcategoryGroup = {
  key: string;
  label: string;
  rows: AssetListRow[];
};

type CategoryGroup = {
  key: string;
  label: string;
  count: number;
  subcategories: SubcategoryGroup[];
};

function categoryName(asset: AssetListRow) {
  if (asset.equipment_category?.name) return asset.equipment_category.name;
  if (asset.ppe_category) return ppeCategoryLabel(asset.ppe_category);
  return "";
}

function subcategoryName(asset: AssetListRow) {
  return asset.equipment_subcategory?.name || asset.subcategory || "";
}

function categoryKey(asset: AssetListRow) {
  return asset.equipment_category_id || categoryName(asset) || UNCATEGORIZED;
}

function subcategoryKey(asset: AssetListRow) {
  return asset.equipment_subcategory_id || subcategoryName(asset) || NO_SUBCATEGORY;
}

function defaultVisibility(showAssignee: boolean): Record<ColumnId, boolean> {
  const visibility = {} as Record<ColumnId, boolean>;
  for (const col of COLUMN_DEFS) {
    if (col.adminOnly && !showAssignee) {
      visibility[col.id] = false;
      continue;
    }
    visibility[col.id] = col.defaultVisible;
  }
  return visibility;
}

function assignmentLabel(asset: AssetListRow) {
  return equipmentAssignmentLabel(asset);
}

function isPast(date: string | null | undefined) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T00:00:00`);
  return due < today;
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
    case "equipmentId":
      return assetDisplayLabel(asset);
    case "category":
      return categoryName(asset);
    case "subcategory":
      return subcategoryName(asset);
    case "description":
      return asset.description ?? "";
    case "status":
      return assetStatusLabel(asset.status);
    case "assignedTo":
      return assignmentLabel(asset);
    case "size":
      return asset.size ?? "";
    case "manufacturer":
      return asset.manufacturer ?? "";
    case "model":
      return asset.model ?? "";
    case "serialNumber":
      return asset.serial_number ?? "";
    case "manufacturedOn":
      return asset.manufactured_on ?? "";
    case "replacementDate":
      return asset.expires_on ?? "";
    case "purchaseCost":
      return asset.purchase_cost;
    case "inServiceOn":
      return asset.in_service_on ?? "";
    case "nextInspection":
      return asset.latest_next_due_on ?? "";
    case "lastInspected":
      return asset.latest_inspected_at?.slice(0, 10) ?? "";
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
    if (sortBy === "purchaseCost") {
      cmp = compareNumber(
        typeof av === "number" ? av : null,
        typeof bv === "number" ? bv : null
      );
    } else if (
      sortBy === "replacementDate" ||
      sortBy === "manufacturedOn" ||
      sortBy === "nextInspection" ||
      sortBy === "lastInspected" ||
      sortBy === "inServiceOn"
    ) {
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

function loadVisibility(showAssignee: boolean): Record<ColumnId, boolean> {
  const defaults = defaultVisibility(showAssignee);
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
      if (col.adminOnly && !showAssignee) {
        next[col.id] = false;
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

function formatCost(value: number | null | undefined) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function groupRows(rows: AssetListRow[], sortBy: ColumnId, sortDir: SortDir): CategoryGroup[] {
  const categoryMap = new Map<
    string,
    { label: string; subMap: Map<string, { label: string; rows: AssetListRow[] }> }
  >();

  for (const asset of rows) {
    const cKey = categoryKey(asset);
    const cLabel = categoryName(asset) || UNCATEGORIZED;
    const sKey = subcategoryKey(asset);
    const sLabel = subcategoryName(asset) || NO_SUBCATEGORY;

    let category = categoryMap.get(cKey);
    if (!category) {
      category = { label: cLabel, subMap: new Map() };
      categoryMap.set(cKey, category);
    }

    let subcategory = category.subMap.get(sKey);
    if (!subcategory) {
      subcategory = { label: sLabel, rows: [] };
      category.subMap.set(sKey, subcategory);
    }
    subcategory.rows.push(asset);
  }

  const groups: CategoryGroup[] = [...categoryMap.entries()].map(([key, value]) => {
    const subcategories: SubcategoryGroup[] = [...value.subMap.entries()]
      .map(([subKey, sub]) => ({
        key: `${key}::${subKey}`,
        label: sub.label,
        rows: sortRows(sub.rows, sortBy, sortDir),
      }))
      .sort((a, b) => {
        if (a.label === NO_SUBCATEGORY) return 1;
        if (b.label === NO_SUBCATEGORY) return -1;
        return compareText(a.label, b.label);
      });

    return {
      key,
      label: value.label,
      count: subcategories.reduce((sum, sub) => sum + sub.rows.length, 0),
      subcategories,
    };
  });

  groups.sort((a, b) => {
    if (a.label === UNCATEGORIZED) return 1;
    if (b.label === UNCATEGORIZED) return -1;
    return compareText(a.label, b.label);
  });

  return groups;
}

export function EquipmentTable({
  rows,
  showAssignee,
  emptyMessage,
}: {
  rows: AssetListRow[];
  showAssignee: boolean;
  emptyMessage: string;
}) {
  const [visibility, setVisibility] = useState(() => defaultVisibility(showAssignee));
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [sortBy, setSortBy] = useState<ColumnId>("equipmentId");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [openSubcategories, setOpenSubcategories] = useState<string[]>([]);
  const [sectionsInitialized, setSectionsInitialized] = useState(false);

  useEffect(() => {
    setVisibility(loadVisibility(showAssignee));
    setHydrated(true);
  }, [showAssignee]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  }, [hydrated, visibility]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const assigneeQ = assigneeQuery.trim().toLowerCase();
    return rows.filter((asset) => {
      if (q) {
        const equipmentId = assetDisplayLabel(asset).toLowerCase();
        const subcategory = subcategoryName(asset).toLowerCase();
        if (!equipmentId.includes(q) && !subcategory.includes(q)) return false;
      }
      if (assigneeQ) {
        if (!assignmentLabel(asset).toLowerCase().includes(assigneeQ)) return false;
      }
      return true;
    });
  }, [assigneeQuery, query, rows]);

  const groups = useMemo(
    () => groupRows(filteredRows, sortBy, sortDir),
    [filteredRows, sortBy, sortDir]
  );

  useEffect(() => {
    if (sectionsInitialized || groups.length === 0) return;
    setOpenCategories(groups.map((g) => g.key));
    setOpenSubcategories(groups.flatMap((g) => g.subcategories.map((s) => s.key)));
    setSectionsInitialized(true);
  }, [groups, sectionsInitialized]);

  useEffect(() => {
    if (!query.trim() && !assigneeQuery.trim()) return;
    const nextGroups = groupRows(filteredRows, "equipmentId", "asc");
    setOpenCategories(nextGroups.map((g) => g.key));
    setOpenSubcategories(nextGroups.flatMap((g) => g.subcategories.map((s) => s.key)));
  }, [query, assigneeQuery, filteredRows]);

  const toggleableColumns = useMemo(
    () => COLUMN_DEFS.filter((col) => !col.alwaysVisible && (!col.adminOnly || showAssignee)),
    [showAssignee]
  );

  const visibleColumns = useMemo(
    () =>
      COLUMN_DEFS.filter((col) => {
        if (col.adminOnly && !showAssignee) return false;
        return visibility[col.id];
      }),
    [showAssignee, visibility]
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
    setOpenCategories(groups.map((g) => g.key));
    setOpenSubcategories(groups.flatMap((g) => g.subcategories.map((s) => s.key)));
  }

  function collapseAll() {
    setOpenCategories([]);
    setOpenSubcategories([]);
  }

  function renderCell(asset: AssetListRow, column: ColumnId) {
    switch (column) {
      case "equipmentId":
        return (
          <Link href={`/assets/${asset.id}`} className="font-medium hover:underline">
            {assetDisplayLabel(asset)}
          </Link>
        );
      case "category":
        return categoryName(asset) || "—";
      case "subcategory":
        return subcategoryName(asset) || "—";
      case "description":
        return asset.description || "—";
      case "status":
        return (
          <Badge className={cn(assetStatusBadgeClass(asset.status), "px-1.5 py-0 text-[10px]")}>
            {assetStatusLabel(asset.status)}
          </Badge>
        );
      case "assignedTo":
        return assignmentLabel(asset);
      case "size":
        return asset.size || "—";
      case "manufacturer":
        return asset.manufacturer || "—";
      case "model":
        return asset.model || "—";
      case "serialNumber":
        return asset.serial_number || "—";
      case "manufacturedOn":
        return asset.manufactured_on || "—";
      case "replacementDate": {
        if (!asset.expires_on) return "—";
        return (
          <span className={cn(isPast(asset.expires_on) && "font-medium text-destructive")}>
            {asset.expires_on}
          </span>
        );
      }
      case "purchaseCost":
        return formatCost(asset.purchase_cost);
      case "inServiceOn":
        return asset.in_service_on || "—";
      case "nextInspection": {
        if (!asset.latest_next_due_on) return "—";
        return (
          <span className={cn(isPast(asset.latest_next_due_on) && "font-medium text-destructive")}>
            {asset.latest_next_due_on}
          </span>
        );
      }
      case "lastInspected":
        return asset.latest_inspected_at?.slice(0, 10) || "—";
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
            {groupRowsList.map((asset) => (
              <tr key={asset.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20">
                {visibleColumns.map((col) => (
                  <td key={col.id} className="px-2 py-1 align-middle">
                    {renderCell(asset, col.id)}
                  </td>
                ))}
                <td className="px-2 py-1 align-middle text-right">
                  <Link
                    href={`/assets/${asset.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
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
            placeholder="Equipment ID or Subcategory…"
            className="h-8 max-w-xs text-sm"
            aria-label="Search by Equipment ID or Subcategory"
          />
          {showAssignee ? (
            <Input
              type="search"
              value={assigneeQuery}
              onChange={(e) => setAssigneeQuery(e.target.value)}
              placeholder="Assigned to…"
              className="h-8 max-w-xs text-sm"
              aria-label="Search by Assigned to"
            />
          ) : null}
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
          <p className="text-sm text-muted-foreground">No equipment matches that search.</p>
        </div>
      ) : (
        <Accordion
          type="multiple"
          value={openCategories}
          onValueChange={setOpenCategories}
          className="space-y-1"
        >
          {groups.map((category) => (
            <AccordionItem
              key={category.key}
              value={category.key}
              className="overflow-hidden rounded-md border border-border"
            >
              <AccordionTrigger className="bg-muted/30 px-2.5 py-1.5 text-sm hover:no-underline">
                <span className="flex items-center gap-1.5 text-left">
                  <span className="font-semibold">{category.label}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                    {category.count}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-1 px-1.5 pb-1.5 pt-0">
                <Accordion
                  type="multiple"
                  value={openSubcategories}
                  onValueChange={setOpenSubcategories}
                  className="space-y-1"
                >
                  {category.subcategories.map((subcategory) => (
                    <AccordionItem
                      key={subcategory.key}
                      value={subcategory.key}
                      className="rounded border border-border/70"
                    >
                      <AccordionTrigger className="px-2 py-1 text-xs hover:no-underline">
                        <span className="flex items-center gap-1.5 text-left">
                          <span className="font-medium">{subcategory.label}</span>
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                            {subcategory.rows.length}
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-1 pb-1">
                        {renderTable(subcategory.rows)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
