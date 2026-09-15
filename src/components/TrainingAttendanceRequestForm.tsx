"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUnlistedTrainingRequest } from "@/app/document-training/requests/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";

export function TrainingAttendanceRequestForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const row = await createUnlistedTrainingRequest({
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          provider: String(formData.get("provider") ?? ""),
          location: String(formData.get("location") ?? ""),
          startsOn: String(formData.get("startsOn") ?? "") || null,
          endsOn: String(formData.get("endsOn") ?? "") || null,
          estimatedCost: String(formData.get("estimatedCost") ?? "") || null,
          justification: String(formData.get("justification") ?? ""),
        });
        router.push(`/document-training/requests/${row.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit request.");
      }
    });
  }

  return (
    <form action={onSubmit} className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1.5">
        <FieldLabel htmlFor="title">Training title</FieldLabel>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea id="description" name="description" rows={4} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="provider">Provider</FieldLabel>
          <Input id="provider" name="provider" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="location">Location</FieldLabel>
          <Input id="location" name="location" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="startsOn">Starts</FieldLabel>
          <Input id="startsOn" name="startsOn" type="date" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="endsOn">Ends</FieldLabel>
          <Input id="endsOn" name="endsOn" type="date" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="estimatedCost">Estimated cost</FieldLabel>
          <Input id="estimatedCost" name="estimatedCost" type="number" min="0" step="0.01" />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="justification">Justification</FieldLabel>
        <Textarea id="justification" name="justification" rows={3} />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit request"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
