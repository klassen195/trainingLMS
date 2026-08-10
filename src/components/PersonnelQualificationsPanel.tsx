"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  createPersonnelQualification,
  deletePersonnelQualification,
  updatePersonnelQualification,
} from "@/app/personnel/actions";
import type { PersonnelQualification } from "@/lib/personnel-types";
import { isCertExpired } from "@/lib/personnel-types";
import type { Qualification } from "@/lib/qualifications-types";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";

export function PersonnelQualificationsPanel({
  profileId,
  qualifications,
  catalog,
  canManage,
}: {
  profileId: string;
  qualifications: PersonnelQualification[];
  catalog: Qualification[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...qualifications].sort((a, b) => {
      const aName = a.qualification?.name ?? "";
      const bName = b.qualification?.name ?? "";
      const byName = aName.localeCompare(bName, undefined, { sensitivity: "base" });
      if (byName !== 0) return byName;
      return (b.earned_on ?? "").localeCompare(a.earned_on ?? "");
    });
  }, [qualifications]);

  return (
    <div className="space-y-4">
      {sorted.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No qualifications recorded.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((row) =>
            editingId === row.id ? (
              <li key={row.id} className="rounded-lg border p-4">
                <QualificationForm
                  profileId={profileId}
                  catalog={catalog}
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
                    <p className="font-medium">
                      {row.qualification?.name ?? "Unknown qualification"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Earned {formatDate(row.earned_on)} · Expires {formatDate(row.expires_on)}
                      {isCertExpired(row.expires_on) ? (
                        <span className="ml-2 font-medium text-destructive">Expired</span>
                      ) : null}
                      {row.source_session_id ? (
                        <>
                          {" · "}
                          <Link
                            href={`/document-training/${row.source_session_id}`}
                            className="underline-offset-2 hover:underline"
                          >
                            From training report
                          </Link>
                        </>
                      ) : null}
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
                      <DeleteQualificationButton id={row.id} profileId={profileId} />
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
            <QualificationForm
              profileId={profileId}
              catalog={catalog}
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add qualification
          </Button>
        )
      ) : null}
    </div>
  );
}

function DeleteQualificationButton({ id, profileId }: { id: string; profileId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="text-destructive"
      onClick={() => {
        if (!confirm("Remove this qualification?")) return;
        startTransition(async () => {
          await deletePersonnelQualification({ id, profileId });
        });
      }}
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}

function QualificationForm({
  profileId,
  catalog,
  initial,
  onDone,
  onCancel,
}: {
  profileId: string;
  catalog: Qualification[];
  initial?: PersonnelQualification;
  onDone: () => void;
  onCancel: () => void;
}) {
  const options = useMemo(() => {
    const list = [...catalog];
    if (
      initial?.qualification &&
      !list.some((q) => q.id === initial.qualification_id)
    ) {
      list.unshift({
        id: initial.qualification.id,
        name: initial.qualification.name,
        sort_order: 0,
        is_active: false,
        notes: "",
        created_at: "",
        updated_at: "",
      });
    }
    return list;
  }, [catalog, initial]);

  const [qualificationId, setQualificationId] = useState(
    initial?.qualification_id ?? options[0]?.id ?? ""
  );
  const [earnedOn, setEarnedOn] = useState(initial?.earned_on ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expires_on ?? "");
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
              await updatePersonnelQualification({
                id: initial.id,
                profileId,
                qualificationId,
                earnedOn,
                expiresOn,
                notes,
              });
            } else {
              await createPersonnelQualification({
                profileId,
                qualificationId,
                earnedOn,
                expiresOn,
                notes,
              });
            }
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save qualification");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <FieldLabel htmlFor="personnel-qualification">Qualification</FieldLabel>
        <Select
          id="personnel-qualification"
          value={qualificationId}
          onChange={(e) => setQualificationId(e.target.value)}
          required
          disabled={pending || options.length === 0}
        >
          {options.length === 0 ? (
            <option value="">No qualifications available</option>
          ) : (
            options.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
                {!q.is_active ? " (inactive)" : ""}
              </option>
            ))
          )}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="personnel-qualification-earned">Earned on</FieldLabel>
          <Input
            id="personnel-qualification-earned"
            type="date"
            value={earnedOn}
            onChange={(e) => setEarnedOn(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="personnel-qualification-expires">Expires on</FieldLabel>
          <Input
            id="personnel-qualification-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="personnel-qualification-notes">Notes</FieldLabel>
        <Textarea
          id="personnel-qualification-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={pending}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || !qualificationId}>
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
