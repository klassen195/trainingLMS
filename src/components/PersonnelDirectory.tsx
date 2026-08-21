"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Columns3 } from "lucide-react";
import type { PersonnelProfile } from "@/lib/personnel-types";
import {
  formatPersonnelRankDisplay,
  personnelDisplayName,
  personnelShiftLabel,
  isRankOnProbation,
  effectiveRankPromotedOn,
} from "@/lib/personnel-types";
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

type ColumnId = "name" | "rank" | "shift" | "station" | "emsLevel";

const STORAGE_KEY = "personnel-directory-columns-v1";

const COLUMN_DEFS: {
  id: ColumnId;
  label: string;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
}[] = [
  { id: "name", label: "Name", defaultVisible: true, alwaysVisible: true },
  { id: "rank", label: "Rank", defaultVisible: true },
  { id: "shift", label: "Shift", defaultVisible: true },
  { id: "station", label: "Station", defaultVisible: true },
  { id: "emsLevel", label: "EMS level", defaultVisible: false },
];

function defaultVisibility(): Record<ColumnId, boolean> {
  const visibility = {} as Record<ColumnId, boolean>;
  for (const col of COLUMN_DEFS) {
    visibility[col.id] = col.defaultVisible;
  }
  return visibility;
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

export function PersonnelDirectory({
  rows,
  expiredCertCountByUser,
  viewerId,
  canOpenAllFiles = false,
}: {
  rows: PersonnelProfile[];
  expiredCertCountByUser: Record<string, number>;
  viewerId: string;
  /** Admins can open any person file; others only their own. */
  canOpenAllFiles?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Section hashes from personnel files can linger and leave the directory scrolled down.
    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    setVisibility(loadVisibility());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  }, [hydrated, visibility]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((person) => {
      if (!showInactive && person.is_active === false) return false;
      if (!q) return true;
      const haystack = [
        person.first_name,
        person.last_name,
        person.display_name,
        person.email,
        person.rank,
        person.job_title,
        person.shift,
        person.employee_number,
        person.primary_location?.name,
        person.ems_cleared_level?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows, showInactive]);

  const inactiveCount = rows.filter((person) => person.is_active === false).length;

  const toggleableColumns = useMemo(
    () => COLUMN_DEFS.filter((col) => !col.alwaysVisible),
    []
  );

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((col) => visibility[col.id]),
    [visibility]
  );

  function setColumnVisible(id: ColumnId, visible: boolean) {
    setVisibility((prev) => ({ ...prev, [id]: visible }));
  }

  function renderCell(person: PersonnelProfile, column: ColumnId) {
    switch (column) {
      case "name": {
        const href = `/personnel/${person.id}`;
        const canOpen = canOpenAllFiles || person.id === viewerId;
        const nameContent = (
          <>
            <span className="font-medium">{personnelDisplayName(person)}</span>
            {person.employee_number ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {person.employee_number}
              </span>
            ) : null}
          </>
        );
        return canOpen ? (
          <Link href={href} className="block min-w-0" onClick={(e) => e.stopPropagation()}>
            {nameContent}
          </Link>
        ) : (
          <div className="min-w-0">{nameContent}</div>
        );
      }
      case "rank": {
        const promotedOn = effectiveRankPromotedOn(
          person.rank,
          person.rank_promoted_on,
          person.hire_date
        );
        const onProbation = isRankOnProbation(person.rank, promotedOn);
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>{formatPersonnelRankDisplay(person.rank, person.job_title)}</span>
            {onProbation ? (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-900"
              >
                Probation
              </Badge>
            ) : null}
          </span>
        );
      }
      case "shift":
        return personnelShiftLabel(person.shift);
      case "station":
        return person.primary_location?.name || "—";
      case "emsLevel":
        return person.ems_cleared_level?.name || "—";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <Input
            type="search"
            placeholder="Search by name, rank, shift, station, EMS…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md"
          />
          {inactiveCount > 0 ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive ({inactiveCount})
            </label>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9 px-2">
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

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "No personnel yet. Invite the first member."
              : "No matches for that search."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.id} className="px-3 py-2 font-medium">
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => {
                const href = `/personnel/${person.id}`;
                const canOpen = canOpenAllFiles || person.id === viewerId;
                const expired = expiredCertCountByUser[person.id] ?? 0;
                const inactive = person.is_active === false;
                return (
                  <tr
                    key={person.id}
                    role={canOpen ? "link" : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    className={`border-b last:border-0 ${
                      canOpen ? "cursor-pointer hover:bg-accent/40" : ""
                    } ${inactive ? "opacity-70" : ""}`}
                    onClick={canOpen ? () => router.push(href) : undefined}
                    onKeyDown={
                      canOpen
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(href);
                            }
                          }
                        : undefined
                    }
                  >
                    {visibleColumns.map((col) => (
                      <td
                        key={col.id}
                        className={
                          col.id === "name"
                            ? "px-3 py-2"
                            : "px-3 py-2 text-muted-foreground"
                        }
                      >
                        {renderCell(person, col.id)}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {inactive ? <Badge variant="outline">Inactive</Badge> : null}
                        {!person.invited_at && !inactive ? (
                          <Badge variant="outline">No password</Badge>
                        ) : null}
                        {person.is_admin ? <Badge variant="outline">Admin</Badge> : null}
                        {expired > 0 ? (
                          <Badge className="bg-destructive text-destructive-foreground">
                            {expired} expired
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
