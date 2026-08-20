"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createApprovalDocument,
  updateApprovalDocument,
} from "@/app/approval-tracker/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  APPROVAL_DOC_TYPES,
  APPROVAL_TRACKS,
  approvalDocTypeLabel,
  approvalTrackLabel,
  type ApprovalDocType,
  type ApprovalTrack,
} from "@/lib/approval-tracker-types";

export function ApprovalDocumentForm({
  initial,
}: {
  initial?: {
    id: string;
    title: string;
    docType: ApprovalDocType;
    track: ApprovalTrack;
    notes: string;
  };
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [docType, setDocType] = useState<ApprovalDocType | "">(initial?.docType ?? "");
  const [track, setTrack] = useState<ApprovalTrack | "">(initial?.track ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            if (isEdit && initial) {
              await updateApprovalDocument({
                id: initial.id,
                title,
                docType,
                track,
                notes,
              });
              router.push(`/approval-tracker/${initial.id}`);
              router.refresh();
            } else {
              const created = await createApprovalDocument({
                title,
                docType,
                track,
                notes,
              });
              router.push(`/approval-tracker/${created.id}`);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save document.");
          }
        });
      }}
    >
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
            <FieldLabel htmlFor="approval-track">Track</FieldLabel>
            <Select
              id="approval-track"
              required
              value={track}
              disabled={pending}
              onChange={(e) => setTrack(e.target.value as ApprovalTrack | "")}
            >
              <option value="">Select track</option>
              {APPROVAL_TRACKS.map((value) => (
                <option key={value} value={value}>
                  {approvalTrackLabel(value)}
                </option>
              ))}
            </Select>
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
