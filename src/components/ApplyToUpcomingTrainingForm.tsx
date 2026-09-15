"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyToUpcomingTraining } from "@/app/document-training/requests/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";

export function ApplyToUpcomingTrainingForm({
  upcomingTrainingId,
  alreadyApplied,
}: {
  upcomingTrainingId: string;
  alreadyApplied: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (alreadyApplied) {
    return (
      <p className="text-sm text-muted-foreground">
        You already have an open or approved request for this opportunity.
      </p>
    );
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const row = await applyToUpcomingTraining({
          upcomingTrainingId,
          justification: String(formData.get("justification") ?? ""),
        });
        router.push(`/document-training/requests/${row.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to apply.");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <FieldLabel htmlFor="justification">Why do you want to attend?</FieldLabel>
        <Textarea id="justification" name="justification" rows={3} />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Apply"}
      </Button>
    </form>
  );
}
