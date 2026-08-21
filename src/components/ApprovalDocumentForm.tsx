"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  attachApprovalDocumentFile,
  createApprovalDocument,
  prepareApprovalDocumentFileUpload,
  updateApprovalDocument,
} from "@/app/approval-tracker/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  APPROVAL_DOC_TYPES,
  APPROVAL_FILES_BUCKET,
  APPROVAL_FILE_ACCEPT,
  approvalDocTypeLabel,
  approvalSubmissionKindLabel,
  isApprovalDocumentFile,
  type ApprovalDocType,
  type ApprovalSubmissionKind,
} from "@/lib/approval-tracker-types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const SUBMISSION_OPTIONS: { value: ApprovalSubmissionKind; description: string }[] = [
  {
    value: "new",
    description: "This is a new policy, best practice, or training aid.",
  },
  {
    value: "replacement",
    description: "This replaces an existing document already in use.",
  },
];

export function ApprovalDocumentForm({
  initial,
}: {
  initial?: {
    id: string;
    title: string;
    docType: ApprovalDocType;
    submissionKind: ApprovalSubmissionKind;
    notes: string;
    fileName: string | null;
  };
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [docType, setDocType] = useState<ApprovalDocType | "">(initial?.docType ?? "");
  const [submissionKind, setSubmissionKind] = useState<ApprovalSubmissionKind | "">(
    initial?.submissionKind ?? ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          let storagePath: string | null = null;
          try {
            if (!isEdit && !file) {
              throw new Error("Upload the document so it can travel through the pipeline.");
            }
            if (file && !isApprovalDocumentFile(file)) {
              throw new Error(
                "Upload a PDF, Word document, PowerPoint, image, or video (MP4, MOV, WebM)."
              );
            }

            let documentId = initial?.id;
            if (isEdit && initial) {
              await updateApprovalDocument({
                id: initial.id,
                title,
                docType,
                submissionKind,
                notes,
              });
            } else {
              const created = await createApprovalDocument({
                title,
                docType,
                submissionKind,
                notes,
              });
              documentId = created.id;
            }

            if (file && documentId) {
              const prepared = await prepareApprovalDocumentFileUpload({
                documentId,
                fileName: file.name,
                mimeType: file.type || null,
              });
              storagePath = prepared.storagePath;
              const supabase = createSupabaseBrowserClient();
              const { error: uploadError } = await supabase.storage
                .from(APPROVAL_FILES_BUCKET)
                .upload(prepared.storagePath, file, {
                  contentType: file.type || undefined,
                  upsert: false,
                });
              if (uploadError) throw new Error(uploadError.message);
              await attachApprovalDocumentFile({
                documentId,
                storagePath: prepared.storagePath,
                fileName: file.name,
                mimeType: file.type || null,
              });
            }

            router.push(`/approval-tracker/${documentId}`);
            router.refresh();
          } catch (err) {
            if (storagePath) {
              try {
                const supabase = createSupabaseBrowserClient();
                await supabase.storage.from(APPROVAL_FILES_BUCKET).remove([storagePath]);
              } catch {
                // best-effort cleanup
              }
            }
            setError(err instanceof Error ? err.message : "Failed to save document.");
          }
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Incoming document</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Document status">
            {SUBMISSION_OPTIONS.map((option) => {
              const selected = submissionKind === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={pending}
                  onClick={() => setSubmissionKind(option.value)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="font-semibold">{approvalSubmissionKindLabel(option.value)}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="approval-title">Title</FieldLabel>
            <Input
              id="approval-title"
              required
              value={title}
              disabled={pending}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="approval-type">Type</FieldLabel>
            <Select
              id="approval-type"
              required
              value={docType}
              disabled={pending}
              onChange={(e) => setDocType(e.target.value as ApprovalDocType | "")}
            >
              <option value="">Select type</option>
              {APPROVAL_DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {approvalDocTypeLabel(type)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="approval-file">{isEdit ? "Replace file" : "Upload file"}</FieldLabel>
            <Input
              id="approval-file"
              type="file"
              required={!isEdit}
              disabled={pending}
              accept={APPROVAL_FILE_ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {isEdit && initial?.fileName ? (
              <FieldHint>Current file: {initial.fileName}. Leave empty to keep it.</FieldHint>
            ) : (
              <FieldHint>
                PDF, Word, PowerPoint, image, or video (up to 500 MB). This file stays with the
                document through every stage.
              </FieldHint>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="approval-notes">Notes</FieldLabel>
            <Textarea
              id="approval-notes"
              rows={4}
              value={notes}
              disabled={pending}
              placeholder="Optional context for reviewers"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create document"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            router.push(initial ? `/approval-tracker/${initial.id}` : "/approval-tracker")
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
