"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ApprovalProfileOption } from "@/lib/approval-tracker-types";
import {
  personnelDisplayName,
  personnelShiftLabel,
  personnelShifts,
  type PersonnelShift,
} from "@/lib/personnel-types";
import { FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

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
  const [shift, setShift] = useState<PersonnelShift | "">("");
  const [stationId, setStationId] = useState("");

  const stationOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const person of profiles) {
      const loc = person.primary_location;
      if (loc?.id && loc.name) byId.set(loc.id, loc.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((person) => {
      if (shift && person.shift !== shift) return false;
      if (stationId && person.primary_location_id !== stationId) return false;
      if (!q) return true;
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
    });
  }, [profiles, query, shift, stationId]);

  const selectedProfiles = useMemo(() => {
    const selected = new Set(selectedIds);
    return profiles
      .filter((person) => selected.has(person.id))
      .sort((a, b) =>
        personnelDisplayName(a).localeCompare(personnelDisplayName(b), undefined, {
          sensitivity: "base",
        })
      );
  }, [profiles, selectedIds]);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  if (profiles.length === 0) {
    return <p className="text-sm text-muted-foreground">No personnel profiles found.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <FieldLabel>Search</FieldLabel>
          <Input
            type="search"
            placeholder="Search by name…"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Shift</FieldLabel>
          <Select
            value={shift}
            disabled={disabled}
            onChange={(e) => setShift(e.target.value as PersonnelShift | "")}
          >
            <option value="">All shifts</option>
            {personnelShifts.map((value) => (
              <option key={value} value={value}>
                {personnelShiftLabel(value)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>Station</FieldLabel>
          <Select
            value={stationId}
            disabled={disabled}
            onChange={(e) => setStationId(e.target.value)}
          >
            <option value="">All stations</option>
            {stationOptions.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3 sm:col-span-3">
          {filteredProfiles.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No personnel match these filters.
            </p>
          ) : (
            filteredProfiles.map((person) => {
              const checked = selectedIds.includes(person.id);
              const meta = [personnelShiftLabel(person.shift), person.primary_location?.name]
                .filter((part) => part && part !== "—")
                .join(" · ");
              return (
                <label
                  key={person.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(person.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm">{personnelDisplayName(person)}</span>
                    {meta ? (
                      <span className="block text-xs text-muted-foreground">{meta}</span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="flex max-h-72 flex-col rounded-md border sm:col-span-2">
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
                    onClick={() => toggle(person.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {emptyHint && selectedIds.length === 0 ? <FieldHint>{emptyHint}</FieldHint> : null}
    </div>
  );
}
