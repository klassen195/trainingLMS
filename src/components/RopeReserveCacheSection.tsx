"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cacheRowSearchText, groupByCategory, type RopeCacheRow } from "@/lib/rope-types";
import { Input, Select } from "@/components/ui/Input";

export function RopeReserveCacheSection({
  anchor,
  rows,
}: {
  anchor: string;
  rows: RopeCacheRow[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (window.location.hash === `#${anchor}`) setOpen(true);
  }, [anchor]);

  return (
    <section id={anchor} className="rounded-xl border bg-muted/40 p-3 sm:p-4">
      <button
        type="button"
        className={`flex w-full items-center gap-2 text-left ${open ? "mb-3" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <h2 className="min-w-0 flex-1 text-lg font-semibold">Reserve cache</h2>
        <span className="shrink-0 text-sm text-muted-foreground">
          {rows.length === 1 ? "1 type" : `${rows.length} types`}
        </span>
      </button>
      {open ? (
        rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No gear in the reserve cache yet.</p>
        ) : (
          <ReserveCacheList rows={rows} query={query} categoryId={categoryId} onQuery={setQuery} onCategory={setCategoryId} />
        )
      ) : null}
    </section>
  );
}

function ReserveCacheList({
  rows,
  query,
  categoryId,
  onQuery,
  onCategory,
}: {
  rows: RopeCacheRow[];
  query: string;
  categoryId: string;
  onQuery: (value: string) => void;
  onCategory: (value: string) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (categoryId && row.categoryId !== categoryId) return false;
    if (!normalizedQuery) return true;
    return cacheRowSearchText(row).includes(normalizedQuery);
  });
  const groups = groupByCategory(visible, (row) => `${row.gearTypeName} ${row.summary}`, (row) => row.sortOrder);
  const categoryOptions = [...new Map(rows.map((row) => [row.categoryId, row])).values()].sort(
    (a, b) => a.categorySortOrder - b.categorySortOrder || a.categoryName.localeCompare(b.categoryName)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          value={query}
          placeholder="Filter by name, color, size…"
          aria-label="Filter cache"
          className="min-w-52 flex-1"
          onChange={(event) => onQuery(event.target.value)}
        />
        <Select
          value={categoryId}
          aria-label="Filter by category"
          className="w-full sm:w-52"
          onChange={(event) => onCategory(event.target.value)}
        >
          <option value="">All categories</option>
          {categoryOptions.map((row) => (
            <option key={row.categoryId} value={row.categoryId}>
              {row.categoryName}
            </option>
          ))}
        </Select>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gear matches that filter.</p>
      ) : (
        groups.map((group) => (
              <section key={group.id}>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </h3>
                <ul className="divide-y overflow-hidden rounded-lg border bg-background">
                  {group.items.map((row) => {
                    const detail = [row.summary, row.description].filter(Boolean).join(" — ");
                    return (
                      <li key={row.gearTypeId}>
                        <Link
                          href="/assets/rope/cache"
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-3">
                              <span className="truncate font-medium">{row.gearTypeName}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">× {row.quantity}</span>
                            </span>
                            {detail ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>
                            ) : null}
                          </span>
                          {row.spares.length > 0 ? (
                            <span className="shrink-0 text-muted-foreground">{row.spares.length} tracked</span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
        ))
      )}
    </div>
  );
}
