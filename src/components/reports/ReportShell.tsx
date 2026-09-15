"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileText } from "lucide-react";
import { buildCsv, downloadCsv } from "@/lib/reports/csv";
import { downloadReportPdf } from "@/components/reports/ReportPdfDocument";
import type { ReportBranding, ReportColumn } from "@/lib/reports/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ReportShell({
  title,
  description,
  branding,
  columns,
  rows,
  filterSummary,
  filenameBase,
  filters,
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
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((column) => String(row[column.key] ?? "").toLowerCase().includes(q))
    );
  }, [columns, query, rows]);

  function onCsv() {
    setError(null);
    const csv = buildCsv(columns, filteredRows);
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
          columns,
          rows: filteredRows,
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this report…"
          className="max-w-sm"
        />
        <p className="text-sm text-muted-foreground">
          {filteredRows.length} row{filteredRows.length === 1 ? "" : "s"}
          {pending ? " · Preparing PDF…" : null}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {children ?? null}

      <ReportDataTable columns={columns} rows={filteredRows} />
    </div>
  );
}

export function ReportDataTable({
  columns,
  rows,
}: {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}) {
  const [sortKey, setSortKey] = useState<string | null>(columns[0]?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const as = av == null ? "" : String(av);
      const bs = bv == null ? "" : String(bv);
      const cmp = as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortDir, sortKey]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

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
                  onClick={() => toggleSort(column.key)}
                >
                  {column.header}
                  {sortKey === column.key ? (sortDir === "asc" ? " ↑" : " ↓") : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={index} className="border-b last:border-0 odd:bg-muted/20">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2 align-top">
                  {row[column.key] == null ? "—" : String(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
