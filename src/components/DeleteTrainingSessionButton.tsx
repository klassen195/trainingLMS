"use client";

import { useTransition } from "react";
import { deleteTrainingSession } from "@/app/document-training/actions";
import { Button } from "@/components/ui/Button";

export function DeleteTrainingSessionButton({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      className="border-destructive text-destructive hover:bg-destructive/10"
      onClick={() => {
        if (
          !window.confirm(
            `Delete training report “${title}”? This cannot be undone.`
          )
        ) {
          return;
        }
        startTransition(async () => {
          try {
            await deleteTrainingSession(sessionId);
          } catch (err) {
            if (
              err &&
              typeof err === "object" &&
              "digest" in err &&
              String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
            ) {
              throw err;
            }
            window.alert(err instanceof Error ? err.message : "Failed to delete training report.");
          }
        });
      }}
    >
      {pending ? "Deleting…" : "Delete report"}
    </Button>
  );
}
