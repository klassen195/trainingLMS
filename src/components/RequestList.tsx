"use client";

import { useMemo, useState } from "react";
import { resolveShiftExchangeRequest } from "@/app/shift-exchange/actions";
import { formatShiftDayRange, formatTimestamp } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";

export type ShiftExchangeRequestRow = {
  id: string;
  created_at: string;
  category: string;
  shift_color: string;
  shift_date: string;
  request_notes: string;
  status: "open" | "resolved";
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_note: string | null;
};

function formatCategoryLabel(raw: string) {
  const known: Record<string, string> = {
    station: "Station",
    engine: "Engine",
    boat: "Boat",
    tech_rescue: "Tech Rescue",
    events: "Events",
    ems: "EMS",
  };

  const key = (raw ?? "").toString();
  if (known[key]) return known[key];

  return key
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function RequestList({
  rows,
  currentUserId,
}: {
  rows: ShiftExchangeRequestRow[];
  currentUserId: string | null;
}) {
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [sortBy, setSortBy] = useState<"date" | "category">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvedNote, setResolvedNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggleSort(next: "date" | "category") {
    if (sortBy === next) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(next);
    setSortDir("desc");
  }

  function sortArrow(key: "date" | "category") {
    if (sortBy !== key) return null;
    return <span className="ml-1 text-[11px]">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const filtered = useMemo(() => {
    const base = rows.filter((r) => r.status === tab);

    const dir = sortDir === "asc" ? 1 : -1;

    const withIndex = base.map((r, idx) => ({ r, idx }));
    withIndex.sort((a, b) => {
      if (sortBy === "category") {
        const av = formatCategoryLabel(a.r.category ?? "").toLowerCase();
        const bv = formatCategoryLabel(b.r.category ?? "").toLowerCase();
        const cmp = av.localeCompare(bv);
        if (cmp !== 0) return cmp * dir;
      } else {
        const at = new Date(a.r.created_at).getTime();
        const bt = new Date(b.r.created_at).getTime();
        const aOk = Number.isFinite(at);
        const bOk = Number.isFinite(bt);
        if (aOk && bOk) {
          if (at !== bt) return (at < bt ? -1 : 1) * dir;
        } else if (aOk !== bOk) {
          return (aOk ? -1 : 1) * dir;
        }
      }

      return a.idx - b.idx;
    });

    return withIndex.map(({ r }) => r);
  }, [rows, tab, sortBy, sortDir]);

  async function resolveNow(id: string) {
    setError(null);
    try {
      await resolveShiftExchangeRequest({ id, resolvedNote: resolvedNote.trim() || undefined });
      setResolvingId(null);
      setResolvedNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve note");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Notes</CardTitle>
            <CardDescription>Open notes and resolved history.</CardDescription>
          </div>

          <div className="inline-flex rounded-md border border-input bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setTab("open")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "open"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setTab("resolved")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "resolved"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              Resolved
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error ? <FieldError className="mb-3">{error}</FieldError> : null}

        <div className="overflow-x-auto">
          <table
            className={cn(
              "w-full table-fixed text-left text-sm",
              tab === "resolved" ? "min-w-[1100px]" : "min-w-[720px]"
            )}
          >
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th
                  className={cn("px-3 py-2 font-medium", tab === "resolved" ? "w-[14%]" : "w-[18%]")}
                  aria-sort={sortBy === "date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("date")}
                    className="inline-flex items-center rounded-md px-1 py-0.5 hover:bg-accent"
                  >
                    Shift Day{sortArrow("date")}
                  </button>
                </th>
                <th
                  className={cn("px-3 py-2 font-medium", tab === "resolved" ? "w-[10%]" : "w-[12%]")}
                  aria-sort={sortBy === "category" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("category")}
                    className="inline-flex items-center rounded-md px-1 py-0.5 hover:bg-accent"
                  >
                    Category{sortArrow("category")}
                  </button>
                </th>
                <th className={cn("px-3 py-2 font-medium", tab === "resolved" ? "w-[20%]" : "w-[34%]")}>
                  Notes
                </th>
                <th className={cn("px-3 py-2 font-medium", tab === "resolved" ? "w-[12%]" : "w-[16%]")}>
                  <button
                    type="button"
                    onClick={() => toggleSort("date")}
                    className="inline-flex items-center rounded-md px-1 py-0.5 hover:bg-accent"
                    title="Sort by created date"
                  >
                    Created{sortArrow("date")}
                  </button>
                </th>
                {tab === "resolved" ? (
                  <>
                    <th className="w-[12%] px-3 py-2 font-medium">Resolved</th>
                    <th className="w-[18%] px-3 py-2 font-medium">Resolved note</th>
                    <th className="w-[14%] px-3 py-2 font-medium">Resolved by</th>
                  </>
                ) : (
                  <th className="w-[20%] px-3 py-2 font-medium"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={tab === "resolved" ? 7 : 5}>
                    No {tab} notes.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">
                        {r.shift_color} — {formatShiftDayRange(r.shift_date)}
                      </div>
                    </td>
                    <td className="px-3 py-3">{formatCategoryLabel(r.category)}</td>
                    <td className="break-words px-3 py-3 whitespace-pre-wrap text-foreground">
                      {r.request_notes || "-"}
                    </td>
                    <td className="break-words px-3 py-3 text-muted-foreground">
                      {formatTimestamp(r.created_at)}
                    </td>

                    {tab === "resolved" ? (
                      <>
                        <td className="break-words px-3 py-3 text-muted-foreground">
                          {r.resolved_at ? formatTimestamp(r.resolved_at) : "-"}
                        </td>
                        <td className="break-words px-3 py-3 whitespace-pre-wrap text-foreground">
                          {r.resolved_note || "-"}
                        </td>
                        <td className="break-all px-3 py-3 text-muted-foreground">
                          {r.resolved_by
                            ? currentUserId && r.resolved_by === currentUserId
                              ? "You"
                              : r.resolved_by
                            : "-"}
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-3">
                        {resolvingId === r.id ? (
                          <div className="grid gap-2">
                            <Textarea
                              value={resolvedNote}
                              onChange={(e) => setResolvedNote(e.target.value)}
                              className="min-h-20"
                              placeholder="Optional note"
                            />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" onClick={() => void resolveNow(r.id)}>
                                Confirm resolve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setResolvingId(null);
                                  setResolvedNote("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button type="button" size="sm" variant="outline" onClick={() => setResolvingId(r.id)}>
                            Resolve
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
