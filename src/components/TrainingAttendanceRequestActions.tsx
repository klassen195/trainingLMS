"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveTrainingAttendanceRequest,
  denyTrainingAttendanceRequest,
  withdrawTrainingAttendanceRequest,
} from "@/app/document-training/requests/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";

export function TrainingAttendanceRequestActions({
  requestId,
  canDecide,
  canWithdraw,
}: {
  requestId: string;
  canDecide: boolean;
  canWithdraw: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");

  if (!canDecide && !canWithdraw) return null;

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

  return (
    <div className="space-y-3 rounded-md border p-4">
      {canDecide ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveTrainingAttendanceRequest({ id: requestId }))}
            >
              Approve
            </Button>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="denyReason">Denial reason</FieldLabel>
            <Textarea
              id="denyReason"
              rows={2}
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
            />
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(() =>
                  denyTrainingAttendanceRequest({ id: requestId, reason: denyReason })
                )
              }
            >
              Deny
            </Button>
          </div>
        </div>
      ) : null}
      {canWithdraw ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => withdrawTrainingAttendanceRequest({ id: requestId }))}
        >
          Withdraw request
        </Button>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
