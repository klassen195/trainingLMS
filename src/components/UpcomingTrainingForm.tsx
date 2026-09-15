"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUpcomingTraining,
  updateUpcomingTraining,
} from "@/app/document-training/upcoming/actions";
import {
  UPCOMING_TRAINING_STATUSES,
  upcomingTrainingStatusLabel,
  type UpcomingTraining,
} from "@/lib/upcoming-training-types";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function UpcomingTrainingForm({
  initial,
}: {
  initial?: UpcomingTraining | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          provider: String(formData.get("provider") ?? ""),
          location: String(formData.get("location") ?? ""),
          startsOn: String(formData.get("startsOn") ?? "") || null,
          endsOn: String(formData.get("endsOn") ?? "") || null,
          applicationDeadline: String(formData.get("applicationDeadline") ?? "") || null,
          estimatedCost: String(formData.get("estimatedCost") ?? "") || null,
          externalUrl: String(formData.get("externalUrl") ?? ""),
          notes: String(formData.get("notes") ?? ""),
          status: String(formData.get("status") ?? "draft"),
        };
        const row = initial
          ? await updateUpcomingTraining(initial.id, payload)
          : await createUpcomingTraining(payload);
        router.push(`/document-training/upcoming/${row.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <form action={onSubmit} className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1.5">
        <FieldLabel htmlFor="title">Title</FieldLabel>
        <Input id="title" name="title" required defaultValue={initial?.title ?? ""} />
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial?.description ?? ""}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="provider">Provider</FieldLabel>
          <Input id="provider" name="provider" defaultValue={initial?.provider ?? ""} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="location">Location</FieldLabel>
          <Input id="location" name="location" defaultValue={initial?.location ?? ""} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="startsOn">Starts</FieldLabel>
          <Input
            id="startsOn"
            name="startsOn"
            type="date"
            defaultValue={initial?.starts_on ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="endsOn">Ends</FieldLabel>
          <Input id="endsOn" name="endsOn" type="date" defaultValue={initial?.ends_on ?? ""} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="applicationDeadline">Apply by</FieldLabel>
          <Input
            id="applicationDeadline"
            name="applicationDeadline"
            type="date"
            defaultValue={initial?.application_deadline ?? ""}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="estimatedCost">Estimated cost</FieldLabel>
          <Input
            id="estimatedCost"
            name="estimatedCost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initial?.estimated_cost ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Select id="status" name="status" defaultValue={initial?.status ?? "draft"}>
            {UPCOMING_TRAINING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {upcomingTrainingStatusLabel(status)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="externalUrl">External link</FieldLabel>
        <Input
          id="externalUrl"
          name="externalUrl"
          type="url"
          placeholder="https://"
          defaultValue={initial?.external_url ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="notes">Internal notes</FieldLabel>
        <Textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create opportunity"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
