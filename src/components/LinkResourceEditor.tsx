"use client";

import { useEffect, useState, useTransition } from "react";
import { updateModuleResourceLink } from "@/app/actions";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

const AUTOSAVE_DELAY_MS = 800;

export function LinkResourceEditor({
  programId,
  moduleId,
  resourceId,
  title,
  url,
}: {
  programId: string;
  moduleId: string;
  resourceId: string;
  title: string;
  url: string;
}) {
  const [editTitle, setEditTitle] = useState(title);
  const [editUrl, setEditUrl] = useState(url);
  const [savedSnapshot, setSavedSnapshot] = useState({ title, url });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const debouncedTitle = useDebouncedValue(editTitle, AUTOSAVE_DELAY_MS);
  const debouncedUrl = useDebouncedValue(editUrl, AUTOSAVE_DELAY_MS);

  useEffect(() => {
    setEditTitle(title);
    setEditUrl(url);
    setSavedSnapshot({ title, url });
  }, [title, url]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    const nextTitle = debouncedTitle.trim();
    const nextUrl = debouncedUrl.trim();
    const hasChanges = nextTitle !== savedSnapshot.title || nextUrl !== savedSnapshot.url;

    if (!hasChanges) return;
    if (!nextTitle || !nextUrl) {
      setError("Title and URL are required.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        await updateModuleResourceLink({
          programId,
          moduleId,
          resourceId,
          title: nextTitle,
          url: nextUrl,
        });
        setSavedSnapshot({ title: nextTitle, url: nextUrl });
        setSaved(true);
      } catch (err) {
        setSaved(false);
        setError(err instanceof Error ? err.message : "Failed to save link");
      }
    });
  }, [
    debouncedTitle,
    debouncedUrl,
    moduleId,
    programId,
    resourceId,
    savedSnapshot.title,
    savedSnapshot.url,
  ]);

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-dashed border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Website link</p>
        {pending ? (
          <p className="text-xs text-muted-foreground">Saving...</p>
        ) : saved ? (
          <p className="text-xs text-primary">Saved</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor={`link-edit-title-${resourceId}`}>Link title</FieldLabel>
        <Input
          id={`link-edit-title-${resourceId}`}
          value={editTitle}
          onChange={(event) => {
            setSaved(false);
            setError(null);
            setEditTitle(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor={`link-edit-url-${resourceId}`}>Website URL</FieldLabel>
        <Input
          id={`link-edit-url-${resourceId}`}
          type="url"
          value={editUrl}
          onChange={(event) => {
            setSaved(false);
            setError(null);
            setEditUrl(event.target.value);
          }}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
