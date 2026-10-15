"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatDate, isoDateLocal } from "@/lib/dates";
import { cn } from "@/lib/cn";
import {
  formatEstimatedCost,
  getTrainingAuthorizationBadge,
  trainingAuthorizationLevelLabel,
  upcomingTrainingDisplayStatus,
  upcomingTrainingStatusLabel,
  upcomingTrainingTimeRange,
  isPastUpcomingTraining,
  type UpcomingTrainingListItem,
  type UpcomingTrainingStatus,
} from "@/lib/upcoming-training-types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

type SortColumn =
  | "title"
  | "provider"
  | "starts_on"
  | "application_deadline"
  | "estimated_cost"
  | "authorization_level"
  | "status";

type SortDir = "asc" | "desc";

const SORTABLE_COLUMNS: { id: SortColumn; label: string; managersOnly?: boolean }[] = [
  { id: "title", label: "Title" },
  { id: "provider", label: "Provider" },
  { id: "starts_on", label: "Dates" },
  { id: "application_deadline", label: "Deadline" },
  { id: "estimated_cost", label: "Cost" },
  { id: "authorization_level", label: "Level" },
  { id: "status", label: "Status", managersOnly: true },
];

function statusVariant(status: UpcomingTrainingListItem["status"]) {
  switch (status) {
    case "open":
      return "default" as const;
    case "draft":
      return "secondary" as const;
    case "closed":
      return "outline" as const;
    case "cancelled":
      return "destructive" as const;
  }
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

const STATUS_ORDER: Record<UpcomingTrainingStatus, number> = {
  open: 0,
  draft: 1,
  closed: 2,
  cancelled: 3,
};

const LEVEL_ORDER: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
};

function sortRows(
  rows: UpcomingTrainingListItem[],
  sortBy: SortColumn,
  sortDir: SortDir
) {
  const dir = sortDir === "asc" ? 1 : -1;
  const withIndex = rows.map((row, idx) => ({ row, idx }));
  withIndex.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "title":
        cmp = compareText(a.row.title, b.row.title);
        break;
      case "provider":
        cmp = compareText(a.row.provider || "", b.row.provider || "");
        break;
      case "starts_on":
        cmp = compareDate(a.row.starts_on, b.row.starts_on);
        break;
      case "application_deadline":
        cmp = compareDate(a.row.application_deadline, b.row.application_deadline);
        break;
      case "estimated_cost":
        cmp = compareNumber(a.row.estimated_cost, b.row.estimated_cost);
        break;
      case "authorization_level": {
        const aLevel = a.row.authorization_level
          ? (LEVEL_ORDER[a.row.authorization_level] ?? 99)
          : 999;
        const bLevel = b.row.authorization_level
          ? (LEVEL_ORDER[b.row.authorization_level] ?? 99)
          : 999;
        cmp = aLevel - bLevel;
        break;
      }
      case "status":
        cmp =
          STATUS_ORDER[upcomingTrainingDisplayStatus(a.row)] -
          STATUS_ORDER[upcomingTrainingDisplayStatus(b.row)];
        break;
    }
    if (cmp !== 0) return cmp * dir;
    const dateCmp = compareDate(a.row.starts_on, b.row.starts_on);
    if (dateCmp !== 0) return dateCmp;
    const titleCmp = compareText(a.row.title, b.row.title);
    if (titleCmp !== 0) return titleCmp;
    return a.idx - b.idx;
  });
  return withIndex.map((item) => item.row);
}

function matchesQuery(row: UpcomingTrainingListItem, query: string) {
  const haystack = [
    row.title,
    row.provider,
    row.city,
    row.location,
    row.description,
    row.external_url,
    upcomingTrainingStatusLabel(upcomingTrainingDisplayStatus(row)),
    trainingAuthorizationLevelLabel(row.authorization_level),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function UpcomingTrainingTable({
  rows,
  emptyMessage,
  showStatus = false,
}: {
  rows: UpcomingTrainingListItem[];
  emptyMessage: string;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortColumn>("starts_on");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const today = isoDateLocal(new Date());

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => matchesQuery(row, q));
  }, [query, rows]);

  const { currentRows, archiveRows } = useMemo(() => {
    const current: UpcomingTrainingListItem[] = [];
    const archive: UpcomingTrainingListItem[] = [];
    for (const row of filteredRows) {
      if (isPastUpcomingTraining(row, today)) archive.push(row);
      else current.push(row);
    }
    return {
      currentRows: sortRows(current, sortBy, sortDir),
      archiveRows: sortRows(archive, sortBy, sortDir),
    };
  }, [filteredRows, sortBy, sortDir, today]);

  const matchCount = currentRows.length + archiveRows.length;

  const columns = useMemo(
    () => SORTABLE_COLUMNS.filter((col) => showStatus || !col.managersOnly),
    [showStatus]
  );

  function toggleSort(column: SortColumn) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  }

  function sortIcon(column: SortColumn) {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  }

  function renderTable(
    tableRows: UpcomingTrainingListItem[],
    framed: boolean,
    archived = false
  ) {
    const tableColumns =
      archived && !showStatus ? [...columns, { id: "status" as const, label: "Status" }] : columns;

    return (
      <div className={cn("overflow-x-auto", framed && "rounded-md border")}>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {tableColumns.map((col) => (
                <th key={col.id} className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground",
                      sortBy === col.id ? "text-foreground" : "text-muted-foreground"
                    )}
                    onClick={() => toggleSort(col.id)}
                  >
                    {col.label}
                    {sortIcon(col.id)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              const levelBadge = getTrainingAuthorizationBadge(row.authorization_level);
              const timeRange = upcomingTrainingTimeRange(row);
              const href = `/document-training/upcoming/${row.id}`;
              const displayStatus = upcomingTrainingDisplayStatus(row);
              return (
                <tr
                  key={row.id}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                  onClick={() => router.push(href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-primary">{row.title}</div>
                    {row.city || row.location ? (
                      <div className="text-xs text-muted-foreground">
                        {[row.city, row.location].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.provider || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <div>
                      {row.starts_on ? formatDate(row.starts_on) : "—"}
                      {row.ends_on && row.ends_on !== row.starts_on
                        ? ` – ${formatDate(row.ends_on)}`
                        : ""}
                    </div>
                    {timeRange ? (
                      <div className="text-xs text-muted-foreground">{timeRange}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.application_deadline ? formatDate(row.application_deadline) : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatEstimatedCost(row.estimated_cost)}
                  </td>
                  <td className="px-3 py-2">
                    {levelBadge ? (
                      // Static badge art under /public/training-levels
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={levelBadge.badgeSrc}
                        alt={levelBadge.label}
                        title={levelBadge.label}
                        width={40}
                        height={40}
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {showStatus || archived ? (
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(displayStatus)}>
                        {upcomingTrainingStatusLabel(displayStatus)}
                      </Badge>
                    </td>
                  ) : null}
                </tr>
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
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, provider, city…"
          className="h-8 max-w-xs text-sm"
          aria-label="Search upcoming training"
        />
        {query.trim() ? (
          <p className="text-xs text-muted-foreground">
            {matchCount} match{matchCount === 1 ? "" : "es"}
            {archiveRows.length > 0
              ? ` (${archiveRows.length} in archive)`
              : ""}
          </p>
        ) : null}
      </div>

      {currentRows.length > 0 ? (
        renderTable(currentRows, true)
      ) : query.trim() && archiveRows.length === 0 ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">No opportunities match your search.</p>
        </div>
      ) : (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {query.trim()
              ? "No current opportunities match your search."
              : "No upcoming training right now."}
          </p>
        </div>
      )}

      {archiveRows.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          key={query.trim() ? "search" : "browse"}
          defaultValue={query.trim() ? "archive" : undefined}
        >
          <AccordionItem value="archive" className="overflow-hidden rounded-md border">
            <AccordionTrigger className="bg-muted/30 px-3 py-2 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="font-semibold">Archive</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                  {archiveRows.length}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="p-0">
              {renderTable(archiveRows, false, true)}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
