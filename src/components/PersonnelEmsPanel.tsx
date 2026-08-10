"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPersonnelEmsLicense,
  deletePersonnelEmsLicense,
  setPersonnelEmsClearance,
  updatePersonnelEmsLicense,
} from "@/app/personnel/actions";
import type { EmsClearanceLevel } from "@/lib/ems-clearance-levels-types";
import type { EmsLevel } from "@/lib/ems-levels-types";
import type { PersonnelEmsLicense } from "@/lib/personnel-types";
import { isCertExpired } from "@/lib/personnel-types";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";

export function PersonnelEmsPanel({
  profileId,
  licenses,
  licenseCatalog,
  clearanceCatalog,
  clearedLevelId,
  clearedLevel = null,
  canManage,
}: {
  profileId: string;
  licenses: PersonnelEmsLicense[];
  licenseCatalog: EmsLevel[];
  clearanceCatalog: EmsClearanceLevel[];
  clearedLevelId: string | null;
  clearedLevel?: { id: string; name: string } | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clearanceId, setClearanceId] = useState(clearedLevelId ?? "");
  const [clearanceError, setClearanceError] = useState<string | null>(null);
  const [clearancePending, startClearanceTransition] = useTransition();

  useEffect(() => {
    setClearanceId(clearedLevelId ?? "");
  }, [clearedLevelId]);

  const clearanceOptions = useMemo(() => {
    const list = [...clearanceCatalog];
    if (clearedLevel && !list.some((level) => level.id === clearedLevel.id)) {
      list.unshift({
        id: clearedLevel.id,
        name: clearedLevel.name,
        sort_order: 0,
        is_active: false,
        notes: "",
        created_at: "",
        updated_at: "",
      });
    }
    return list;
  }, [clearanceCatalog, clearedLevel]);

  const clearedName =
    clearanceOptions.find((level) => level.id === (clearedLevelId ?? ""))?.name ??
    clearedLevel?.name ??
    null;

  const sorted = useMemo(() => {
    return [...licenses].sort((a, b) => {
      const aName = a.ems_level?.name ?? "";
      const bName = b.ems_level?.name ?? "";
      const byName = aName.localeCompare(bName, undefined, { sensitivity: "base" });
      if (byName !== 0) return byName;
      return (b.issued_on ?? "").localeCompare(a.issued_on ?? "");
    });
  }, [licenses]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Cleared to operate</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The level this person is cleared to work at, which may be below licenses they hold.
          </p>
        </div>
        {canManage ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setClearanceError(null);
              startClearanceTransition(async () => {
                try {
                  await setPersonnelEmsClearance({
                    profileId,
                    clearanceLevelId: clearanceId || null,
                  });
                  router.refresh();
                } catch (err) {
                  setClearanceError(
                    err instanceof Error ? err.message : "Failed to save clearance"
                  );
                }
              });
            }}
          >
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <FieldLabel htmlFor="personnel-ems-clearance">Level</FieldLabel>
              <Select
                id="personnel-ems-clearance"
                value={clearanceId}
                onChange={(e) => setClearanceId(e.target.value)}
                disabled={clearancePending}
              >
                <option value="">Not set</option>
                {clearanceOptions.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                    {!level.is_active ? " (inactive)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={clearancePending || clearanceId === (clearedLevelId ?? "")}
            >
              {clearancePending ? "Saving…" : "Save clearance"}
            </Button>
            {clearanceError ? <FieldError className="w-full">{clearanceError}</FieldError> : null}
          </form>
        ) : (
          <p className="text-sm font-medium">{clearedName ?? "Not set"}</p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Licenses held</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            EMS licenses this person currently holds. A person can hold more than one level.
          </p>
        </div>

        {sorted.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">No EMS licenses recorded.</p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((row) =>
              editingId === row.id ? (
                <li key={row.id} className="rounded-lg border p-4">
                  <LicenseForm
                    profileId={profileId}
                    catalog={licenseCatalog}
                    initial={row}
                    onDone={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li
                  key={row.id}
                  className={cn(
                    "rounded-lg border p-4",
                    isCertExpired(row.expires_on) && "border-destructive/50 bg-destructive/5"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.ems_level?.name ?? "Unknown level"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Issued {formatDate(row.issued_on)} · Expires {formatDate(row.expires_on)}
                        {isCertExpired(row.expires_on) ? (
                          <span className="ml-2 font-medium text-destructive">Expired</span>
                        ) : null}
                        {row.license_number ? ` · #${row.license_number}` : null}
                      </p>
                      {row.notes ? <p className="mt-2 text-sm">{row.notes}</p> : null}
                    </div>
                    {canManage ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingId(row.id)}
                        >
                          Edit
                        </Button>
                        <DeleteLicenseButton id={row.id} profileId={profileId} />
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            )}
          </ul>
        )}

        {canManage ? (
          adding ? (
            <div className="rounded-lg border p-4">
              <LicenseForm
                profileId={profileId}
                catalog={licenseCatalog}
                onDone={() => setAdding(false)}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
              Add license
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}

function DeleteLicenseButton({ id, profileId }: { id: string; profileId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="text-destructive"
      onClick={() => {
        if (!confirm("Remove this EMS license?")) return;
        startTransition(async () => {
          await deletePersonnelEmsLicense({ id, profileId });
          router.refresh();
        });
      }}
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}

function LicenseForm({
  profileId,
  catalog,
  initial,
  onDone,
  onCancel,
}: {
  profileId: string;
  catalog: EmsLevel[];
  initial?: PersonnelEmsLicense;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const options = useMemo(() => {
    const list = [...catalog];
    if (initial?.ems_level && !list.some((level) => level.id === initial.ems_level_id)) {
      list.unshift({
        id: initial.ems_level.id,
        name: initial.ems_level.name,
        sort_order: 0,
        is_active: false,
        notes: "",
        created_at: "",
        updated_at: "",
      });
    }
    return list;
  }, [catalog, initial]);

  const [emsLevelId, setEmsLevelId] = useState(initial?.ems_level_id ?? options[0]?.id ?? "");
  const [issuedOn, setIssuedOn] = useState(initial?.issued_on ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expires_on ?? "");
  const [licenseNumber, setLicenseNumber] = useState(initial?.license_number ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            if (initial) {
              await updatePersonnelEmsLicense({
                id: initial.id,
                profileId,
                emsLevelId,
                issuedOn,
                expiresOn,
                licenseNumber,
                notes,
              });
            } else {
              await createPersonnelEmsLicense({
                profileId,
                emsLevelId,
                issuedOn,
                expiresOn,
                licenseNumber,
                notes,
              });
            }
            router.refresh();
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save EMS license");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <FieldLabel htmlFor="personnel-ems-level">EMS level</FieldLabel>
        <Select
          id="personnel-ems-level"
          value={emsLevelId}
          onChange={(e) => setEmsLevelId(e.target.value)}
          required
          disabled={pending || options.length === 0}
        >
          {options.length === 0 ? (
            <option value="">No EMS levels available</option>
          ) : (
            options.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
                {!level.is_active ? " (inactive)" : ""}
              </option>
            ))
          )}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="personnel-ems-issued">Issued on</FieldLabel>
          <Input
            id="personnel-ems-issued"
            type="date"
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="personnel-ems-expires">Expires on</FieldLabel>
          <Input
            id="personnel-ems-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="personnel-ems-license-number">License number</FieldLabel>
        <Input
          id="personnel-ems-license-number"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="personnel-ems-notes">Notes</FieldLabel>
        <Textarea
          id="personnel-ems-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={pending}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || !emsLevelId}>
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
