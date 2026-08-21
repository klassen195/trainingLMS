"use client";

import { useRef, useState, useTransition } from "react";
import {
  createPersonnelCertification,
  deletePersonnelCertification,
  getPersonnelCertificationDownloadUrl,
  updatePersonnelCertification,
} from "@/app/personnel/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PersonnelCertification } from "@/lib/personnel-types";
import {
  isCertExpired,
  isPersonnelDocumentFile,
  PERSONNEL_DOCUMENT_ACCEPT,
  PERSONNEL_DOCUMENTS_BUCKET,
} from "@/lib/personnel-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";

export function PersonnelCertificationsPanel({
  profileId,
  certifications,
  canManage,
}: {
  profileId: string;
  certifications: PersonnelCertification[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {certifications.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No certifications recorded.</p>
      ) : (
        <ul className="space-y-3">
          {certifications.map((cert) =>
            editingId === cert.id ? (
              <li key={cert.id} className="rounded-lg border p-4">
                <CertificationForm
                  profileId={profileId}
                  initial={cert}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={cert.id}
                className={cn(
                  "rounded-lg border p-4",
                  isCertExpired(cert.expires_on) && "border-destructive/50 bg-destructive/5"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{cert.name}</p>
                    {cert.issuing_authority ? (
                      <p className="text-sm text-muted-foreground">{cert.issuing_authority}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted-foreground">
                      Issued {formatDate(cert.issued_on)} · Expires {formatDate(cert.expires_on)}
                      {isCertExpired(cert.expires_on) ? (
                        <span className="ml-2 font-medium text-destructive">Expired</span>
                      ) : null}
                    </p>
                    {cert.file_name ? (
                      <p className="mt-1 text-sm text-muted-foreground">{cert.file_name}</p>
                    ) : null}
                    {cert.notes ? <p className="mt-2 text-sm">{cert.notes}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cert.storage_path ? (
                      <DownloadCertButton id={cert.id} profileId={profileId} />
                    ) : null}
                    {canManage ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingId(cert.id)}
                        >
                          Edit
                        </Button>
                        <DeleteCertButton
                          id={cert.id}
                          profileId={profileId}
                          storagePath={cert.storage_path}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {canManage ? (
        adding ? (
          <div className="rounded-lg border p-4">
            <CertificationForm
              profileId={profileId}
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add certification
          </Button>
        )
      ) : null}
    </div>
  );
}

function DownloadCertButton({ id, profileId }: { id: string; profileId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const { url } = await getPersonnelCertificationDownloadUrl({ id, profileId });
          window.open(url, "_blank", "noopener,noreferrer");
        });
      }}
    >
      {pending ? "…" : "Download"}
    </Button>
  );
}

function DeleteCertButton({
  id,
  profileId,
  storagePath,
}: {
  id: string;
  profileId: string;
  storagePath: string | null;
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
        if (!confirm("Delete this certification?")) return;
        startTransition(async () => {
          await deletePersonnelCertification({ id, profileId, storagePath });
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

function CertificationForm({
  profileId,
  initial,
  onDone,
  onCancel,
}: {
  profileId: string;
  initial?: PersonnelCertification;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [issuingAuthority, setIssuingAuthority] = useState(initial?.issuing_authority ?? "");
  const [issuedOn, setIssuedOn] = useState(initial?.issued_on ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expires_on ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [removeFile, setRemoveFile] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const existingFileName = initial?.file_name && !removeFile ? initial.file_name : null;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const file = fileRef.current?.files?.[0] ?? null;
        if (file && !isPersonnelDocumentFile(file)) {
          setError("Unsupported file type. Use PDF, image, or Word document.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            if (initial) {
              const { storagePath } = await updatePersonnelCertification({
                id: initial.id,
                profileId,
                name,
                issuingAuthority,
                issuedOn,
                expiresOn,
                notes,
                fileName: file?.name ?? null,
                mimeType: file?.type || null,
                removeFile: removeFile && !file,
              });
              if (file && storagePath) {
                const supabase = createSupabaseBrowserClient();
                const { error: uploadError } = await supabase.storage
                  .from(PERSONNEL_DOCUMENTS_BUCKET)
                  .upload(storagePath, file, {
                    upsert: true,
                    contentType: file.type || undefined,
                  });
                if (uploadError) throw new Error(uploadError.message);
              }
            } else {
              const { storagePath } = await createPersonnelCertification({
                profileId,
                name,
                issuingAuthority,
                issuedOn,
                expiresOn,
                notes,
                fileName: file?.name ?? null,
                mimeType: file?.type || null,
              });
              if (file && storagePath) {
                const supabase = createSupabaseBrowserClient();
                const { error: uploadError } = await supabase.storage
                  .from(PERSONNEL_DOCUMENTS_BUCKET)
                  .upload(storagePath, file, {
                    upsert: true,
                    contentType: file.type || undefined,
                  });
                if (uploadError) throw new Error(uploadError.message);
              }
            }
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
          }
        });
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="cert-name">Name</FieldLabel>
        <Input id="cert-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel htmlFor="cert-issuer">Issuing authority</FieldLabel>
          <Input
            id="cert-issuer"
            value={issuingAuthority}
            onChange={(e) => setIssuingAuthority(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="cert-issued">Issued</FieldLabel>
          <Input
            id="cert-issued"
            type="date"
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="cert-expires">Expires</FieldLabel>
          <Input
            id="cert-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="cert-notes">Notes</FieldLabel>
        <Textarea id="cert-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="cert-file">
          {existingFileName ? "Replace file" : "Upload file"}
        </FieldLabel>
        {existingFileName ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Current: {existingFileName}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="text-destructive"
              onClick={() => {
                setRemoveFile(true);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Remove
            </Button>
          </div>
        ) : null}
        <input
          id="cert-file"
          ref={fileRef}
          type="file"
          accept={PERSONNEL_DOCUMENT_ACCEPT}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={() => {
            if (fileRef.current?.files?.[0]) setRemoveFile(false);
          }}
        />
        <p className="text-xs text-muted-foreground">PDF, image, or Word document. Optional.</p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
