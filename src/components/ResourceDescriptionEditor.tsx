"use client";

import { useEffect, useState, useTransition } from "react";
import { updateModuleResourceDescription } from "@/app/actions";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { FieldLabel } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";

const AUTOSAVE_DELAY_MS = 800;

export function ResourceDescriptionEditor({
  programId,
  moduleId,
  resourceId,
  description,
}: {
  programId: string;
  moduleId: string;
  resourceId: string;
  description: string;
}) {
  const [editDescription, setEditDescription] = useState(description);
  const [savedDescription, setSavedDescription] = useState(description);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const debouncedDescription = useDebouncedValue(editDescription, AUTOSAVE_DELAY_MS);

  useEffect(() => {
    setEditDescription(description);
    setSavedDescription(description);
  }, [description]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    const next = debouncedDescription.trim();
    if (next === savedDescription) return;

    startTransition(async () => {
      setError(null);
      try {
        await updateModuleResourceDescription({ programId, moduleId, resourceId, description: next });
        setSavedDescription(next);
        setSaved(true);
      } catch (err) {
        setSaved(false);
        setError(err instanceof Error ? err.message : "Failed to save description");
      }
    });
  }, [debouncedDescription, moduleId, programId, resourceId, savedDescription]);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor={`resource-description-${resourceId}`}>Description</FieldLabel>
        {pending ? (
          <p className="text-xs text-muted-foreground">Saving...</p>
        ) : saved ? (
          <p className="text-xs text-primary">Saved</p>
        ) : null}
      </div>
      <Textarea
        id={`resource-description-${resourceId}`}
        rows={2}
        placeholder="Optional — shown under the title on the course page"
        value={editDescription}
        onChange={(event) => {
          setSaved(false);
          setError(null);
          setEditDescription(event.target.value);
        }}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
