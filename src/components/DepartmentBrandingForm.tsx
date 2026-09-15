"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  prepareClientLogoUpload,
  removeClientLogo,
} from "@/app/admin/branding/actions";
import {
  CLIENT_LOGO_ACCEPT,
  CLIENT_LOGOS_BUCKET,
  isClientLogoMimeType,
  type Client,
} from "@/lib/clients";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";

export function DepartmentBrandingForm({
  client,
  previewUrl,
}: {
  client: Client;
  previewUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onFileSelected(file: File | null) {
    if (!file) return;
    setError(null);
    if (!isClientLogoMimeType(file.type)) {
      setError("Logo must be a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be 5 MB or smaller.");
      return;
    }

    startTransition(async () => {
      try {
        const { storagePath } = await prepareClientLogoUpload({
          fileName: file.name,
          mimeType: file.type,
        });
        const supabase = createSupabaseBrowserClient();
        const { error: uploadError } = await supabase.storage
          .from(CLIENT_LOGOS_BUCKET)
          .upload(storagePath, file, {
            upsert: true,
            contentType: file.type,
          });
        if (uploadError) throw uploadError;
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      try {
        await removeClientLogo();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove logo.");
      }
    });
  }

  return (
    <div className="space-y-6 rounded-lg border p-6">
      <div>
        <h2 className="text-lg font-semibold">{client.name}</h2>
        <p className="text-sm text-muted-foreground">Client ID: {client.code}</p>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${client.name} logo`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">No logo</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <FieldLabel htmlFor="department-logo">Department logo</FieldLabel>
            <p className="mb-2 text-sm text-muted-foreground">
              Used in the header of exported PDF reports. JPEG, PNG, or WebP up to 5 MB.
            </p>
            <input
              ref={inputRef}
              id="department-logo"
              type="file"
              accept={CLIENT_LOGO_ACCEPT}
              disabled={pending}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
            />
          </div>

          {client.logo_file_name ? (
            <p className="text-sm text-muted-foreground">Current file: {client.logo_file_name}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {client.logo_storage_path ? (
              <Button type="button" variant="outline" disabled={pending} onClick={onRemove}>
                Remove logo
              </Button>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {pending ? <p className="text-sm text-muted-foreground">Saving…</p> : null}
        </div>
      </div>
    </div>
  );
}
