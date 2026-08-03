"use client";

import { useRef, useState, useTransition } from "react";
import {
  createPersonnelDocument,
  deletePersonnelDocument,
  getPersonnelDocumentDownloadUrl,
} from "@/app/personnel/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PersonnelDocument } from "@/lib/personnel-types";
import {
  isPersonnelDocumentFile,
  PERSONNEL_DOCUMENT_ACCEPT,
  PERSONNEL_DOCUMENTS_BUCKET,
} from "@/lib/personnel-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function PersonnelDocumentsPanel({
  profileId,
  documents,
  canManage,
}: {
  profileId: string;
  documents: PersonnelDocument[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      {documents.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No documents attached.</p>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="min-w-0">
                <p className="font-medium">{doc.title}</p>
                <p className="text-sm text-muted-foreground">{doc.file_name}</p>
              </div>
              <div className="flex gap-2">
                <DownloadDocButton id={doc.id} profileId={profileId} />
                {canManage ? (
                  <DeleteDocButton
                    id={doc.id}
                    profileId={profileId}
                    storagePath={doc.storage_path}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        adding ? (
          <div className="rounded-lg border p-4">
            <UploadDocumentForm profileId={profileId} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Upload document
          </Button>
        )
      ) : null}
    </div>
  );
}

function DownloadDocButton({ id, profileId }: { id: string; profileId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const { url } = await getPersonnelDocumentDownloadUrl({ id, profileId });
          window.open(url, "_blank", "noopener,noreferrer");
        });
      }}
    >
      {pending ? "…" : "Download"}
    </Button>
  );
}

function DeleteDocButton({
  id,
  profileId,
  storagePath,
}: {
  id: string;
  profileId: string;
  storagePath: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="text-destructive"
      onClick={() => {
        if (!confirm("Delete this document?")) return;
        startTransition(async () => {
          await deletePersonnelDocument({ id, profileId, storagePath });
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

function UploadDocumentForm({
  profileId,
  onDone,
  onCancel,
}: {
  profileId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const file = fileRef.current?.files?.[0];
        if (!file) {
          setError("Choose a file to upload.");
          return;
        }
        if (!isPersonnelDocumentFile(file)) {
          setError("Unsupported file type. Use PDF, image, or Word document.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            const { storagePath } = await createPersonnelDocument({
              profileId,
              title: title.trim() || file.name,
              fileName: file.name,
              mimeType: file.type || null,
            });
            const supabase = createSupabaseBrowserClient();
            const { error: uploadError } = await supabase.storage
              .from(PERSONNEL_DOCUMENTS_BUCKET)
              .upload(storagePath, file, {
                upsert: true,
                contentType: file.type || undefined,
              });
            if (uploadError) throw new Error(uploadError.message);
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
          }
        });
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="doc-title">Title</FieldLabel>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Driver license"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="doc-file">File</FieldLabel>
        <input
          id="doc-file"
          ref={fileRef}
          type="file"
          accept={PERSONNEL_DOCUMENT_ACCEPT}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
