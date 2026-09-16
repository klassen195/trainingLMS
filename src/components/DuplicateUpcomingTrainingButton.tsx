"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateUpcomingTraining } from "@/app/document-training/upcoming/actions";
import { Button } from "@/components/ui/Button";

export function DuplicateUpcomingTrainingButton({
  upcomingTrainingId,
}: {
  upcomingTrainingId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const row = await duplicateUpcomingTraining(upcomingTrainingId);
              router.push(`/document-training/upcoming/${row.id}/edit`);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to duplicate.");
            }
          });
        }}
      >
        {pending ? "Duplicating…" : "Duplicate"}
      </Button>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
