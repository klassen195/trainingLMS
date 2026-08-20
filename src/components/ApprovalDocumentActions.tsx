"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  advanceApprovalDocument,
  kickBackApprovalDocument,
  setApprovalDocumentArchived,
} from "@/app/approval-tracker/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Select, Textarea } from "@/components/ui/Input";
import {
  approvalStageLabel,
  earlierApprovalStages,
  nextApprovalStage,
  type ApprovalStage,
} from "@/lib/approval-tracker-types";

export function ApprovalDocumentActions({
  documentId,
  currentStage,
  archived,
  canAct,
}: {
  documentId: string;
  currentStage: ApprovalStage;
  archived: boolean;
  canAct: boolean;
}) {
  const router = useRouter();
  const next = nextApprovalStage(currentStage);
  const earlier = earlierApprovalStages(currentStage);
  const [kickStage, setKickStage] = useState<ApprovalStage | "">(earlier[0] ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  if (archived) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Archive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This approved document is archived and hidden from the active board.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => setApprovalDocumentArchived({ id: documentId, archived: false }))
            }
          >
            {pending ? "Restoring…" : "Restore to board"}
          </Button>
          {error ? <FieldError>{error}</FieldError> : null}
        </CardContent>
      </Card>
    );
  }

  if (currentStage === "approved") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Approved</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Fire Chief approval is complete. Archive it to hide it from the active board.
          </p>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => setApprovalDocumentArchived({ id: documentId, archived: true }))
            }
          >
            {pending ? "Archiving…" : "Archive"}
          </Button>
          {error ? <FieldError>{error}</FieldError> : null}
        </CardContent>
      </Card>
    );
  }

  if (!canAct) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Waiting</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only people assigned to {approvalStageLabel(currentStage)} can move this document.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Move document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {next ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {next === "approved"
                ? "Approve this document as Fire Chief."
                : `Send forward to ${approvalStageLabel(next)}.`}
            </p>
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => advanceApprovalDocument({ id: documentId }))}
            >
              {pending ? "Updating…" : next === "approved" ? "Approve" : "Advance"}
            </Button>
          </div>
        ) : null}

        {earlier.length > 0 ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Kick back for revision</p>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="kick-stage">Return to</FieldLabel>
              <Select
                id="kick-stage"
                value={kickStage}
                disabled={pending}
                onChange={(e) => setKickStage(e.target.value as ApprovalStage)}
              >
                {earlier.map((stage) => (
                  <option key={stage} value={stage}>
                    {approvalStageLabel(stage)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="kick-comment">Comment</FieldLabel>
              <Textarea
                id="kick-comment"
                required
                rows={3}
                value={comment}
                disabled={pending}
                placeholder="Explain what needs to change"
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !kickStage || !comment.trim()}
              onClick={() =>
                run(() =>
                  kickBackApprovalDocument({
                    id: documentId,
                    toStage: kickStage,
                    comment,
                  })
                )
              }
            >
              Kick back
            </Button>
          </div>
        ) : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </CardContent>
    </Card>
  );
}
