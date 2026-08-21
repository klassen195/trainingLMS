"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ApprovalProfileOption } from "@/lib/approval-tracker-types";
import {
  comparePersonnelByName,
  personnelDisplayName,
  personnelShiftLabel,
} from "@/lib/personnel-types";
import { FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function ApprovalPersonnelPicker({
  profiles,
  selectedIds,
  onChange,
  emptyHint,
  disabled = false,
}: {
  profiles: ApprovalProfileOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyHint?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");

  const selectedProfiles = useMemo(() => {
    const selected = new Set(selectedIds);
    return profiles
      .filter((person) => selected.has(person.id))
      .sort(comparePersonnelByName);
  }, [profiles, selectedIds]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const selected = new Set(selectedIds);
    return profiles
      .filter((person) => {
        if (selected.has(person.id)) return false;
        const haystack = [
          person.first_name,
          person.last_name,
          person.display_name,
          person.email,
          personnelShiftLabel(person.shift),
          person.primary_location?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort(comparePersonnelByName)
      .slice(0, 8);
  }, [profiles, query, selectedIds]);

  function add(id: string) {
    if (disabled || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
  }

  function remove(id: string) {
    if (disabled) return;
    onChange(selectedIds.filter((value) => value !== id));
  }

  if (profiles.length === 0) {
    return <p className="text-sm text-muted-foreground">No personnel profiles found.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <FieldLabel>Search</FieldLabel>
        <Input
          type="search"
          placeholder="Search by name…"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query.trim() ? (
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {searchResults.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matching people.</p>
            ) : (
              searchResults.map((person) => {
                const meta = [personnelShiftLabel(person.shift), person.primary_location?.name]
                  .filter((part) => part && part !== "—")
                  .join(" · ");
                return (
                  <button
                    key={person.id}
                    type="button"
                    disabled={disabled}
                    className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60 disabled:opacity-50"
                    onClick={() => add(person.id)}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm">{personnelDisplayName(person)}</span>
                      {meta ? (
                        <span className="block text-xs text-muted-foreground">{meta}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <div className="flex max-h-56 flex-col rounded-md border">
        <div className="shrink-0 border-b px-3 py-2">
          <p className="text-sm font-medium">Selected ({selectedProfiles.length})</p>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {selectedProfiles.length === 0 ? (
            <p className="px-1 py-1.5 text-sm text-muted-foreground">None selected yet</p>
          ) : (
            selectedProfiles.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {personnelDisplayName(person)}
                </span>
                <button
                  type="button"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${personnelDisplayName(person)}`}
                  disabled={disabled}
                  onClick={() => remove(person.id)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {emptyHint && selectedIds.length === 0 ? <FieldHint>{emptyHint}</FieldHint> : null}
    </div>
  );
}
