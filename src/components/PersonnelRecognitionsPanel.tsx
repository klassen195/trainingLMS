"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createPersonnelRecognition,
  deletePersonnelRecognition,
  updatePersonnelRecognition,
} from "@/app/personnel/actions";
import type { PersonnelRecognition } from "@/lib/personnel-types";
import {
  getRecognitionAward,
  recognitionAwardsBySection,
  type RecognitionAwardId,
} from "@/lib/recognition-awards";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/dates";

function sortRecognitions(rows: PersonnelRecognition[]) {
  return [...rows].sort((a, b) => {
    const aAward = getRecognitionAward(a.award_id);
    const bAward = getRecognitionAward(b.award_id);
    const aPrec = aAward?.precedence ?? 999;
    const bPrec = bAward?.precedence ?? 999;
    if (aPrec !== bPrec) return aPrec - bPrec;
    const aDate = a.awarded_on ?? "";
    const bDate = b.awarded_on ?? "";
    return bDate.localeCompare(aDate);
  });
}

export function PersonnelRecognitionsPanel({
  profileId,
  recognitions,
  canManage,
}: {
  profileId: string;
  recognitions: PersonnelRecognition[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sorted = useMemo(() => sortRecognitions(recognitions), [recognitions]);

  return (
    <div className="space-y-4">
      {sorted.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No recognitions recorded.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((row) =>
            editingId === row.id ? (
              <li key={row.id} className="rounded-lg border p-4">
                <RecognitionForm
                  profileId={profileId}
                  initial={row}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <RecognitionRow
                key={row.id}
                recognition={row}
                canManage={canManage}
                onEdit={() => setEditingId(row.id)}
              />
            )
          )}
        </ul>
      )}

      {canManage ? (
        adding ? (
          <div className="rounded-lg border p-4">
            <RecognitionForm
              profileId={profileId}
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add award
          </Button>
        )
      ) : null}
    </div>
  );
}

function RibbonGraphic({
  awardId,
  label,
}: {
  awardId: string;
  label: string;
}) {
  const award = getRecognitionAward(awardId);
  if (!award) {
    return (
      <span
        className="inline-block h-3.5 w-12 shrink-0 rounded-sm border bg-muted"
        aria-hidden
      />
    );
  }
  return (
    // Ribbon SVG assets live under /public/ribbons; next/image is unnecessary for small static SVGs.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={award.ribbonSrc}
      alt=""
      title={label}
      width={48}
      height={14}
      className="h-3.5 w-12 shrink-0 rounded-sm border border-black/20 object-cover shadow-sm"
    />
  );
}

function RecognitionRow({
  recognition,
  canManage,
  onEdit,
}: {
  recognition: PersonnelRecognition;
  canManage: boolean;
  onEdit: () => void;
}) {
  const award = getRecognitionAward(recognition.award_id);
  const label = award?.label ?? recognition.award_id;

  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <RibbonGraphic awardId={recognition.award_id} label={label} />
            <p className="font-medium">{label}</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Awarded {formatDate(recognition.awarded_on)}
          </p>
          {recognition.notes ? <p className="mt-2 text-sm">{recognition.notes}</p> : null}
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
            <DeleteRecognitionButton id={recognition.id} profileId={recognition.profile_id} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function DeleteRecognitionButton({ id, profileId }: { id: string; profileId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="text-destructive"
      onClick={() => {
        if (!confirm("Delete this recognition?")) return;
        startTransition(async () => {
          await deletePersonnelRecognition({ id, profileId });
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

function RecognitionForm({
  profileId,
  initial,
  onDone,
  onCancel,
}: {
  profileId: string;
  initial?: PersonnelRecognition;
  onDone: () => void;
  onCancel: () => void;
}) {
  const sections = recognitionAwardsBySection();
  const [awardId, setAwardId] = useState<RecognitionAwardId | "">(
    (initial?.award_id as RecognitionAwardId | undefined) ?? ""
  );
  const [awardedOn, setAwardedOn] = useState(initial?.awarded_on?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!awardId) {
          setError("Select an award.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            if (initial) {
              await updatePersonnelRecognition({
                id: initial.id,
                profileId,
                awardId,
                awardedOn: awardedOn || undefined,
                notes: notes || undefined,
              });
            } else {
              await createPersonnelRecognition({
                profileId,
                awardId,
                awardedOn: awardedOn || undefined,
                notes: notes || undefined,
              });
            }
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="recognition-award">Award</FieldLabel>
        <Select
          id="recognition-award"
          required
          value={awardId}
          onChange={(e) => setAwardId(e.target.value as RecognitionAwardId | "")}
        >
          <option value="" disabled>
            Select award…
          </option>
          {sections.map((group) => (
            <optgroup key={group.section} label={group.label}>
              {group.awards.map((award) => (
                <option key={award.id} value={award.id}>
                  {award.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        {awardId ? (
          <div className="flex items-center gap-2 pt-1">
            <RibbonGraphic
              awardId={awardId}
              label={getRecognitionAward(awardId)?.label ?? awardId}
            />
            <span className="text-xs text-muted-foreground">Ribbon preview</span>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="recognition-awarded-on">Awarded on</FieldLabel>
        <Input
          id="recognition-awarded-on"
          type="date"
          value={awardedOn}
          onChange={(e) => setAwardedOn(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="recognition-notes">Notes (optional)</FieldLabel>
        <Textarea
          id="recognition-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !awardId}>
          {pending ? "Saving…" : initial ? "Save award" : "Add award"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
