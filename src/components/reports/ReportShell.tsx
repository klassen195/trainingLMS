"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Columns3, Download, FileText } from "lucide-react";
import { buildCsv, downloadCsv } from "@/lib/reports/csv";
import { downloadReportPdf } from "@/components/reports/ReportPdfDocument";
import type { ReportBranding, ReportColumn } from "@/lib/reports/types";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { ReportHoursByCategorySummary } from "@/components/reports/ReportHoursByCategorySummary";

export type ReportFacetFilter = {
  key: string;
  label: string;
};

export function ReportShell({
  title,
  description,
  branding,
  columns,
  rows,
  filterSummary,
  filenameBase,
  filters,
  facetFilters,
  hoursByCategorySummary = false,
  children,
}: {
  title: string;
  description: string;
  branding: ReportBranding;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  filterSummary?: string;
  filenameBase: string;
  filters?: React.ReactNode;
  facetFilters?: ReportFacetFilter[];
  hoursByCategorySummary?: boolean;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((column) => [column.key, true]))
  );
  const [sortKey, setSortKey] = useState<string | null>(columns[0]?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const visibleColumns = useMemo(
    () => columns.filter((column) => visibility[column.key] !== false),
    [columns, visibility]
  );

  const facetOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    for (const facet of facetFilters ?? []) {
      const values = new Set<string>();
      for (const row of rows) {
        const raw = row[facet.key];
        const value = raw == null ? "" : String(raw).trim();
        if (value) values.add(value);
      }
      options[facet.key] = [...values].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );
    }
    return options;
  }, [facetFilters, rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      for (const facet of facetFilters ?? []) {
        const selected = facetValues[facet.key] ?? "";
        if (!selected) continue;
        const value = row[facet.key] == null ? "" : String(row[facet.key]).trim();
        if (value !== selected) return false;
      }
      if (!q) return true;
      return columns.some((column) =>
        String(row[column.key] ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [columns, facetFilters, facetValues, query, rows]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const as = av == null ? "" : String(av);
      const bs = bv == null ? "" : String(bv);
      const cmp = as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sortDir, sortKey]);

  const filteredHoursTotal = useMemo(() => {
    if (!columns.some((column) => column.key === "hours")) return null;
    let total = 0;
    let hasHours = false;
    for (const row of filteredRows) {
      const value = Number(row.hours);
      if (!Number.isFinite(value)) continue;
      hasHours = true;
      total += value;
    }
    return hasHours ? Math.round(total * 100) / 100 : null;
  }, [columns, filteredRows]);

  function setColumnVisible(key: string, visible: boolean) {
    setVisibility((current) => {
      const next = { ...current, [key]: visible };
      const visibleCount = columns.filter((column) => next[column.key] !== false).length;
      if (visibleCount === 0) return current;
      return next;
    });
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function onCsv() {
    setError(null);
    const csv = buildCsv(visibleColumns, sortedRows);
    downloadCsv(`${filenameBase}.csv`, csv);
  }

  function onPdf() {
    setError(null);
    startTransition(async () => {
      try {
        await downloadReportPdf({
          filename: `${filenameBase}.pdf`,
          branding,
          meta: { title, filterSummary, generatedAt: new Date() },
          columns: visibleColumns,
          rows: sortedRows,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "PDF export failed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-muted-foreground">{description}</p>
          {filterSummary ? (
            <p className="mt-2 text-sm text-muted-foreground">{filterSummary}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCsv} disabled={pending}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button type="button" onClick={onPdf} disabled={pending}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {filters ? <div className="flex flex-wrap items-end gap-3">{filters}</div> : null}

      {hoursByCategorySummary ? <ReportHoursByCategorySummary rows={rows} /> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <FieldLabel htmlFor="report-search">Search</FieldLabel>
          <Input
            id="report-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this report…"
            className="max-w-sm"
          />
        </div>
        {(facetFilters ?? []).map((facet) => (
          <div key={facet.key} className="min-w-[12rem]">
            <FieldLabel htmlFor={`facet-${facet.key}`}>{facet.label}</FieldLabel>
            <Select
              id={`facet-${facet.key}`}
              value={facetValues[facet.key] ?? ""}
              onChange={(event) =>
                setFacetValues((current) => ({
                  ...current,
                  [facet.key]: event.target.value,
                }))
              }
            >
              <option value="">All</option>
              {(facetOptions[facet.key] ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        ))}
        <div className="min-w-[10rem]">
          <FieldLabel htmlFor="report-sort">Sort by</FieldLabel>
          <Select
            id="report-sort"
            value={sortKey ? `${sortKey}:${sortDir}` : ""}
            onChange={(event) => {
              const [key, dir] = event.target.value.split(":");
              if (!key) return;
              setSortKey(key);
              setSortDir(dir === "desc" ? "desc" : "asc");
            }}
          >
            {columns.map((column) => (
              <optgroup key={column.key} label={column.header}>
                <option value={`${column.key}:asc`}>{column.header} ↑</option>
                <option value={`${column.key}:desc`}>{column.header} ↓</option>
              </optgroup>
            ))}
          </Select>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9">
              <Columns3 className="mr-2 h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={visibility[column.key] !== false}
                onCheckedChange={(checked) => setColumnVisible(column.key, checked === true)}
                onSelect={(event) => event.preventDefault()}
              >
                {column.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="pb-2 text-sm text-muted-foreground">
          {filteredRows.length} row{filteredRows.length === 1 ? "" : "s"}
          {filteredHoursTotal != null ? ` · ${filteredHoursTotal} hours` : null}
          {pending ? " · Preparing PDF…" : null}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {children ?? null}

      <ReportDataTable
        columns={visibleColumns}
        rows={sortedRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggleSort}
      />
    </div>
  );
}

export function ReportDataTable({
  columns,
  rows,
  sortKey,
  sortDir,
  onToggleSort,
}: {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onToggleSort: (key: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No rows match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => onToggleSort(column.key)}
                >
                  {column.header}
                  {sortKey === column.key ? (
                    sortDir === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )
                  ) : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b last:border-0 odd:bg-muted/20">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2 align-top">
                  {row[column.key] == null || row[column.key] === ""
                    ? "—"
                    : String(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
