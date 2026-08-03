"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PersonnelProfile } from "@/lib/personnel-types";
import { personnelDisplayName, personnelShiftLabel } from "@/lib/personnel-types";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

export function PersonnelDirectory({
  rows,
  expiredCertCountByUser,
}: {
  rows: PersonnelProfile[];
  expiredCertCountByUser: Record<string, number>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((person) => {
      const haystack = [
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
  }, [query, rows]);

  return (
    <div className="space-y-3">
      <Input
        type="search"
        placeholder="Search by name, rank, shift, station…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0 ? "No personnel yet. Invite the first member." : "No matches for that search."}
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
                const expired = expiredCertCountByUser[person.id] ?? 0;
                return (
                  <tr key={person.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <Link href={`/personnel/${person.id}`} className="block min-w-0">
                        <span className="font-medium">{personnelDisplayName(person)}</span>
                        {person.employee_number ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {person.employee_number}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                      {person.rank || "—"}
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                      {personnelShiftLabel(person.shift)}
                    </td>
                    <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                      {person.primary_location?.name || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
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
