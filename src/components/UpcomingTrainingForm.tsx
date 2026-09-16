"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  attachUpcomingTrainingFlyer,
  createUpcomingTraining,
  prepareUpcomingTrainingFlyerUpload,
  removeUpcomingTrainingFlyer,
  updateUpcomingTraining,
} from "@/app/document-training/upcoming/actions";
import { TrainingAuthorizationDetails } from "@/components/TrainingAuthorizationDetails";
import {
  TRAINING_AUTHORIZATION_LEVELS,
  UPCOMING_TRAINING_FLYERS_BUCKET,
  UPCOMING_TRAINING_FLYER_ACCEPT,
  UPCOMING_TRAINING_STATUSES,
  getTrainingAuthorizationBadge,
  isUpcomingTrainingFlyerFile,
  trainingAuthorizationLevelLabel,
  upcomingTrainingStatusLabel,
  type TrainingAuthorizationLevel,
  type UpcomingTraining,
} from "@/lib/upcoming-training-types";
import { toTimeInputValue } from "@/lib/dates";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { TimeInput } from "@/components/ui/TimeInput";

export function UpcomingTrainingForm({
  initial,
}: {
  initial?: UpcomingTraining | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [authorizationLevel, setAuthorizationLevel] = useState<string>(
    initial?.authorization_level ?? ""
  );
  const [flyer, setFlyer] = useState<File | null>(null);
  const [removeExistingFlyer, setRemoveExistingFlyer] = useState(false);

  const selectedBadge = getTrainingAuthorizationBadge(authorizationLevel);
  const existingFlyerName =
    !removeExistingFlyer && initial?.flyer_file_name ? initial.flyer_file_name : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      let storagePath: string | null = null;
      try {
        if (flyer && !isUpcomingTrainingFlyerFile(flyer)) {
          throw new Error("Upload a PDF or image flyer (JPG, PNG, WebP, HEIC).");
        }

        const payload = {
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          provider: String(formData.get("provider") ?? ""),
          location: String(formData.get("location") ?? ""),
          city: String(formData.get("city") ?? ""),
          startsOn: String(formData.get("startsOn") ?? "") || null,
          endsOn: String(formData.get("endsOn") ?? "") || null,
          startTime: String(formData.get("startTime") ?? "") || null,
          endTime: String(formData.get("endTime") ?? "") || null,
          applicationDeadline: String(formData.get("applicationDeadline") ?? "") || null,
          estimatedCost: String(formData.get("estimatedCost") ?? "") || null,
          externalUrl: String(formData.get("externalUrl") ?? ""),
          notes: String(formData.get("notes") ?? ""),
          status: String(formData.get("status") ?? "draft"),
          authorizationLevel: String(formData.get("authorizationLevel") ?? "") || null,
        };

        const row = initial
          ? await updateUpcomingTraining(initial.id, payload)
          : await createUpcomingTraining(payload);

        if (removeExistingFlyer && initial?.flyer_storage_path && !flyer) {
          await removeUpcomingTrainingFlyer({ upcomingTrainingId: row.id });
        }

        if (flyer) {
          const prepared = await prepareUpcomingTrainingFlyerUpload({
            upcomingTrainingId: row.id,
            fileName: flyer.name,
            mimeType: flyer.type || null,
          });
          storagePath = prepared.storagePath;
          const supabase = createSupabaseBrowserClient();
          const { error: uploadError } = await supabase.storage
            .from(UPCOMING_TRAINING_FLYERS_BUCKET)
            .upload(prepared.storagePath, flyer, {
              contentType: flyer.type || undefined,
              upsert: false,
            });
          if (uploadError) throw new Error(uploadError.message);
          await attachUpcomingTrainingFlyer({
            upcomingTrainingId: row.id,
            storagePath: prepared.storagePath,
            fileName: flyer.name,
            mimeType: flyer.type || null,
          });
        }

        router.push(`/document-training/upcoming/${row.id}`);
        router.refresh();
      } catch (err) {
        if (storagePath) {
          try {
            const supabase = createSupabaseBrowserClient();
            await supabase.storage.from(UPCOMING_TRAINING_FLYERS_BUCKET).remove([storagePath]);
          } catch {
            // best-effort cleanup
          }
        }
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
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
          <FieldLabel htmlFor="city">City</FieldLabel>
          <Input id="city" name="city" defaultValue={initial?.city ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="location">Location</FieldLabel>
        <Input id="location" name="location" defaultValue={initial?.location ?? ""} />
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
          <FieldLabel htmlFor="startTime">Start time</FieldLabel>
          <TimeInput
            id="startTime"
            name="startTime"
            defaultValue={toTimeInputValue(initial?.start_time)}
          />
          <FieldHint>24-hour format (e.g. 08:00)</FieldHint>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="endTime">End time</FieldLabel>
          <TimeInput
            id="endTime"
            name="endTime"
            defaultValue={toTimeInputValue(initial?.end_time)}
          />
          <FieldHint>24-hour format (e.g. 17:00)</FieldHint>
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
        <FieldLabel htmlFor="authorizationLevel">Authorization level</FieldLabel>
        <Select
          id="authorizationLevel"
          name="authorizationLevel"
          className="max-w-xs"
          value={authorizationLevel}
          onChange={(e) => setAuthorizationLevel(e.target.value)}
        >
          <option value="">None</option>
          {TRAINING_AUTHORIZATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {trainingAuthorizationLevelLabel(level as TrainingAuthorizationLevel)}
            </option>
          ))}
        </Select>
        {selectedBadge ? (
          <div className="mt-3 flex flex-wrap items-start gap-4 rounded-md border p-3">
            {/* Static badge art under /public/training-levels */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedBadge.badgeSrc}
              alt={selectedBadge.label}
              width={128}
              height={128}
              className="h-28 w-28 shrink-0 object-contain sm:h-32 sm:w-32"
            />
            <TrainingAuthorizationDetails badge={selectedBadge} className="min-w-[14rem] flex-1" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a level to preview the authorization badge and details.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="flyer">Flyer</FieldLabel>
        <Input
          id="flyer"
          type="file"
          accept={UPCOMING_TRAINING_FLYER_ACCEPT}
          disabled={pending}
          onChange={(e) => {
            setFlyer(e.target.files?.[0] ?? null);
            if (e.target.files?.[0]) setRemoveExistingFlyer(false);
          }}
        />
        <FieldHint>Optional PDF or image. Replacing uploads overwrite the current flyer.</FieldHint>
        {existingFlyerName ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">A flyer is currently attached.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                setRemoveExistingFlyer(true);
                setFlyer(null);
              }}
            >
              Remove flyer
            </Button>
          </div>
        ) : null}
        {removeExistingFlyer && !flyer ? (
          <p className="text-sm text-muted-foreground">Flyer will be removed on save.</p>
        ) : null}
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
