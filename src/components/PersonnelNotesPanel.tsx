"use client";

import { useState, useTransition } from "react";
import { createPersonnelNote, deletePersonnelNote } from "@/app/personnel/actions";
import type { PersonnelNote } from "@/lib/personnel-types";
import { personnelDisplayName } from "@/lib/personnel-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export function PersonnelNotesPanel({
  profileId,
  notes,
  canManage,
}: {
  profileId: string;
  notes: PersonnelNote[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      {notes.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(note.created_at)}
                    {note.created_by_profile
                      ? ` · ${personnelDisplayName(note.created_by_profile)}`
                      : null}
                  </p>
                </div>
                {canManage ? (
                  <DeleteNoteButton id={note.id} profileId={profileId} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        adding ? (
          <div className="rounded-lg border p-4">
            <NoteForm
              profileId={profileId}
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add note
          </Button>
        )
      ) : null}
    </div>
  );
}

function DeleteNoteButton({ id, profileId }: { id: string; profileId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="text-destructive"
      onClick={() => {
        if (!confirm("Delete this note?")) return;
        startTransition(async () => {
          await deletePersonnelNote({ id, profileId });
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

function NoteForm({
  profileId,
  onDone,
  onCancel,
}: {
  profileId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
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
            await createPersonnelNote({ profileId, body });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
          }
        });
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="note-body">Note</FieldLabel>
        <Textarea
          id="note-body"
          required
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
