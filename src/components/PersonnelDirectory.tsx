"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PersonnelProfile } from "@/lib/personnel-types";
import { personnelDisplayName, personnelShiftLabel, isRankOnProbation } from "@/lib/personnel-types";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

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
        person.shift,
        person.employee_number,
        person.primary_location?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows, showInactive]);

  const inactiveCount = rows.filter((person) => person.is_active === false).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Search by name, rank, shift, station…"
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
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Rank</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Shift</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Station</th>
                <th className="px-3 py-2 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => {
                const href = `/personnel/${person.id}`;
                const canOpen = canOpenAllFiles || person.id === viewerId;
                const expired = expiredCertCountByUser[person.id] ?? 0;
                const inactive = person.is_active === false;
                const onProbation = Boolean(person.rank) && isRankOnProbation(person.rank_promoted_on);
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
                    <td className="px-3 py-2">
                      {canOpen ? (
                        <Link
                          href={href}
                          className="block min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {nameContent}
                        </Link>
                      ) : (
                        <div className="min-w-0">{nameContent}</div>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span>{person.rank || "—"}</span>
                        {onProbation ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-900"
                          >
                            Probation
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                      {personnelShiftLabel(person.shift)}
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                      {person.primary_location?.name || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {inactive ? <Badge variant="outline">Inactive</Badge> : null}
                        {!person.invited_at && !inactive ? (
                          <Badge variant="outline">Not invited</Badge>
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
