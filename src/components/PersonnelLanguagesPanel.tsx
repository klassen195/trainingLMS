"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createPersonnelLanguage,
  deletePersonnelLanguage,
  setPersonnelLanguageVerified,
  updatePersonnelLanguage,
} from "@/app/personnel/actions";
import type { PersonnelLanguage } from "@/lib/personnel-types";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";

function sortLanguages(rows: PersonnelLanguage[]) {
  return [...rows].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function PersonnelLanguagesPanel({
  profileId,
  languages,
  canManage,
  canVerify,
  pdipEnabled = false,
}: {
  profileId: string;
  languages: PersonnelLanguage[];
  canManage: boolean;
  canVerify: boolean;
  pdipEnabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sorted = useMemo(() => sortLanguages(languages), [languages]);

  return (
    <div className="space-y-4">
      {sorted.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No languages recorded.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((row) =>
            editingId === row.id ? (
              <li key={row.id} className="rounded-lg border p-4">
                <LanguageForm
                  profileId={profileId}
                  initial={row}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <LanguageRow
                key={row.id}
                language={row}
                canManage={canManage}
                canVerify={canVerify}
                pdipEnabled={pdipEnabled}
                onEdit={() => setEditingId(row.id)}
              />
            )
          )}
        </ul>
      )}

      {canManage ? (
        adding ? (
          <div className="rounded-lg border p-4">
            <LanguageForm
              profileId={profileId}
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add language
          </Button>
        )
      ) : null}
    </div>
  );
}

function LanguageRow({
  language,
  canManage,
  canVerify,
  pdipEnabled,
  onEdit,
}: {
  language: PersonnelLanguage;
  canManage: boolean;
  canVerify: boolean;
  pdipEnabled: boolean;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{language.name}</p>
            {language.verified ? (
              <span className="text-xs font-medium text-muted-foreground">
                Verified{pdipEnabled ? " · PDIP" : ""}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Unverified</span>
            )}
          </div>
          {language.verified && language.verified_at ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Verified {formatDateTime(language.verified_at)}
            </p>
          ) : null}
          {language.notes ? <p className="mt-2 text-sm">{language.notes}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canVerify ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await setPersonnelLanguageVerified({
                      id: language.id,
                      profileId: language.profile_id,
                      verified: !language.verified,
                    });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Update failed");
                  }
                });
              }}
            >
              {pending
                ? "Saving…"
                : language.verified
                  ? "Clear verified"
                  : "Mark verified"}
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
                Edit
              </Button>
              <DeleteLanguageButton id={language.id} profileId={language.profile_id} />
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function DeleteLanguageButton({ id, profileId }: { id: string; profileId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="text-destructive"
      onClick={() => {
        if (!confirm("Delete this language?")) return;
        startTransition(async () => {
          await deletePersonnelLanguage({ id, profileId });
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

function LanguageForm({
  profileId,
  initial,
  onDone,
  onCancel,
}: {
  profileId: string;
  initial?: PersonnelLanguage;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
          setError("Language name is required.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            if (initial) {
              await updatePersonnelLanguage({
                id: initial.id,
                profileId,
                name: trimmed,
                notes: notes || undefined,
              });
            } else {
              await createPersonnelLanguage({
                profileId,
                name: trimmed,
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
        <FieldLabel htmlFor="language-name">Language</FieldLabel>
        <Input
          id="language-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Spanish"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="language-notes">Notes (optional)</FieldLabel>
        <Textarea
          id="language-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : initial ? "Save language" : "Add language"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
