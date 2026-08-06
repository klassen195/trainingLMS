"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import {
  trainingSessionDisplayDate,
  type TrainingSessionListItem,
} from "@/lib/document-training-types";
import { formatTrainingHours, personnelDisplayName } from "@/lib/personnel-types";
import { cn } from "@/lib/cn";
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
  | "date"
  | "title"
  | "category"
  | "hours"
  | "attendees"
  | "location"
  | "loggedBy"
  | "notes";

type SortDir = "asc" | "desc";

const STORAGE_KEY = "training-sessions-table-columns-v2";

const COLUMN_DEFS: {
  id: ColumnId;
  label: string;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
}[] = [
  { id: "date", label: "Date", defaultVisible: true, alwaysVisible: true },
  { id: "title", label: "Title", defaultVisible: true, alwaysVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "hours", label: "Hours", defaultVisible: true },
  { id: "attendees", label: "Attendees", defaultVisible: true },
  { id: "location", label: "Location", defaultVisible: false },
  { id: "loggedBy", label: "Logged by", defaultVisible: false },
  { id: "notes", label: "Notes", defaultVisible: false },
];

function sessionDateValue(session: TrainingSessionListItem) {
  return session.occurred_on || session.started_on || "";
}

function categoryLabel(session: TrainingSessionListItem) {
  return session.category?.name?.trim() || "—";
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

function sortValue(session: TrainingSessionListItem, column: ColumnId): string | number | null {
  switch (column) {
    case "date":
      return sessionDateValue(session);
    case "title":
      return session.title;
    case "category":
      return categoryLabel(session);
    case "hours":
      return session.hours;
    case "attendees":
      return session.attendee_count;
    case "location":
      return session.location ?? "";
    case "loggedBy":
      return session.recorder ? personnelDisplayName(session.recorder) : "";
    case "notes":
      return session.notes ?? "";
  }
}

function sortRows(
  rows: TrainingSessionListItem[],
  sortBy: ColumnId,
  sortDir: SortDir
) {
  const dir = sortDir === "asc" ? 1 : -1;
  const withIndex = rows.map((row, idx) => ({ row, idx }));
  withIndex.sort((a, b) => {
    const av = sortValue(a.row, sortBy);
    const bv = sortValue(b.row, sortBy);
    let cmp = 0;
    if (sortBy === "hours" || sortBy === "attendees") {
      cmp = compareNumber(
        typeof av === "number" ? av : null,
        typeof bv === "number" ? bv : null
      );
    } else if (sortBy === "date") {
      cmp = compareDate(
        typeof av === "string" ? av || null : null,
        typeof bv === "string" ? bv || null : null
      );
    } else {
      cmp = compareText(String(av ?? ""), String(bv ?? ""));
    }
    if (cmp !== 0) return cmp * dir;
    // Stable secondary sort by date desc, then title
    const dateCmp = compareDate(sessionDateValue(b.row), sessionDateValue(a.row));
    if (dateCmp !== 0) return dateCmp;
    const titleCmp = compareText(a.row.title, b.row.title);
    if (titleCmp !== 0) return titleCmp;
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

export function TrainingSessionsTable({
  rows,
  emptyMessage,
}: {
  rows: TrainingSessionListItem[];
  emptyMessage: string;
}) {
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<ColumnId>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
    return rows.filter((session) => {
      const haystack = [
        session.title,
        session.category?.name,
        session.location,
        session.provider,
        session.instructor_name,
        session.recorder ? personnelDisplayName(session.recorder) : "",
        session.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows]);

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortBy, sortDir),
    [filteredRows, sortBy, sortDir]
  );

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
    setSortDir(column === "date" || column === "hours" ? "desc" : "asc");
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

  function renderCell(session: TrainingSessionListItem, column: ColumnId) {
    switch (column) {
      case "date":
        return trainingSessionDisplayDate(session) || "—";
      case "title":
        return (
          <Link
            href={`/document-training/${session.id}`}
            className="font-medium hover:underline"
          >
            {session.title}
          </Link>
        );
      case "category":
        return categoryLabel(session);
      case "hours":
        return session.hours != null ? formatTrainingHours(Number(session.hours)) : "—";
      case "attendees":
        return String(session.attendee_count);
      case "location":
        return session.location || "—";
      case "loggedBy":
        return session.recorder ? personnelDisplayName(session.recorder) : "—";
      case "notes":
        return session.notes ? (
          <span className="line-clamp-1 max-w-[12rem]">{session.notes}</span>
        ) : (
          "—"
        );
    }
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
            placeholder="Search title, category, location…"
            className="h-8 max-w-xs text-sm"
            aria-label="Search training sessions"
          />
        </div>
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

      {filteredRows.length === 0 ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">No sessions match that search.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="border-b bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.id}
                    className={cn(
                      "px-2 py-1.5 font-medium",
                      (col.id === "hours" || col.id === "attendees") && "text-right"
                    )}
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
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-0.5 py-0.5 hover:bg-accent hover:text-accent-foreground",
                        (col.id === "hours" || col.id === "attendees") && "ml-auto"
                      )}
                    >
                      {col.label}
                      {sortIcon(col.id)}
                    </button>
                  </th>
                ))}
                <th className="px-2 py-1.5 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-border/70 last:border-0 hover:bg-muted/20"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        "px-2 py-1.5 align-middle",
                        (col.id === "hours" || col.id === "attendees") &&
                          "text-right tabular-nums"
                      )}
                    >
                      {renderCell(session, col.id)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 align-middle text-right">
                    <Link
                      href={`/document-training/${session.id}`}
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
      )}
    </div>
  );
}
