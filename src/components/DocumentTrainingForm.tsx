"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  createTrainingSession,
  prepareTrainingSessionFileUpload,
  updateTrainingSession,
} from "@/app/document-training/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  TRAINING_SESSION_FILE_ACCEPT,
  TRAINING_SESSION_FILES_BUCKET,
  isTrainingSessionFile,
  trainingSessionTypeLabel,
  type TrainingSessionProfileOption,
  type TrainingSessionType,
} from "@/lib/document-training-types";
import type { TrainingCategory } from "@/lib/training-categories-types";
import {
  personnelDisplayName,
  personnelShiftLabel,
  personnelShifts,
  type PersonnelShift,
} from "@/lib/personnel-types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

const SESSION_TYPES: {
  value: TrainingSessionType;
  label: string;
  description: string;
}[] = [
  {
    value: "in_house",
    label: "In-house training",
    description: "Department drills, company training, and other local sessions.",
  },
  {
    value: "certification_course",
    label: "Certification course",
    description: "External or formal courses that lead to a credential.",
  },
];

export type DocumentTrainingFormInitial = {
  sessionId: string;
  sessionType: TrainingSessionType;
  categoryId: string;
  title: string;
  hours: string;
  location: string;
  notes: string;
  attendeeIds: string[];
  occurredOn: string;
  instructorName: string;
  provider: string;
  startedOn: string;
  endedOn: string;
  expiresOn: string;
};

export function DocumentTrainingForm({
  profiles,
  categories,
  initial,
}: {
  profiles: TrainingSessionProfileOption[];
  categories: TrainingCategory[];
  initial?: DocumentTrainingFormInitial;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial);

  const [sessionType, setSessionType] = useState<TrainingSessionType | null>(
    initial?.sessionType ?? null
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId || categories[0]?.id || ""
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [hours, setHours] = useState(initial?.hours ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [attendeeIds, setAttendeeIds] = useState<string[]>(initial?.attendeeIds ?? []);
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [attendeeShift, setAttendeeShift] = useState<PersonnelShift | "">("");
  const [attendeeStationId, setAttendeeStationId] = useState("");

  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? "");
  const [instructorName, setInstructorName] = useState(initial?.instructorName ?? "");

  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [startedOn, setStartedOn] = useState(initial?.startedOn ?? "");
  const [endedOn, setEndedOn] = useState(initial?.endedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn ?? "");

  const stationOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const person of profiles) {
      const loc = person.primary_location;
      if (loc?.id && loc.name) byId.set(loc.id, loc.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const q = attendeeQuery.trim().toLowerCase();
    return profiles.filter((person) => {
      if (attendeeShift && person.shift !== attendeeShift) return false;
      if (attendeeStationId && person.primary_location_id !== attendeeStationId) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        person.first_name,
        person.last_name,
        person.display_name,
        person.email,
        personnelShiftLabel(person.shift),
        person.primary_location?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [profiles, attendeeQuery, attendeeShift, attendeeStationId]);

  const selectedProfiles = useMemo(() => {
    const selected = new Set(attendeeIds);
    return profiles
      .filter((person) => selected.has(person.id))
      .sort((a, b) =>
        personnelDisplayName(a).localeCompare(personnelDisplayName(b), undefined, {
          sensitivity: "base",
        })
      );
  }, [profiles, attendeeIds]);

  function selectSessionType(next: TrainingSessionType) {
    if (isEdit) return;
    setSessionType(next);
    setOccurredOn("");
    setInstructorName("");
    setProvider("");
    setStartedOn("");
    setEndedOn("");
    setExpiresOn("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const cancelHref = initial
    ? `/document-training/${initial.sessionId}`
    : "/document-training";

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);

        if (!sessionType) {
          setError("Choose in-house training or a certification course.");
          return;
        }
        if (!categoryId) {
          setError("Choose a training category.");
          return;
        }

        startTransition(async () => {
          let createdId: string | null = null;
          let storagePath: string | null = null;
          try {
            const file = fileInputRef.current?.files?.[0] ?? null;
            if (file && !isTrainingSessionFile(file)) {
              throw new Error("Certificate must be a PDF or image (JPEG, PNG, WebP, or HEIC).");
            }

            const payload = {
              sessionType,
              categoryId,
              title,
              hours: hours.trim() === "" ? null : hours,
              location,
              notes,
              occurredOn,
              instructorName,
              provider,
              startedOn,
              endedOn,
              expiresOn,
              attendeeIds,
            };

            const { sessionId } = initial
              ? await updateTrainingSession({ sessionId: initial.sessionId, ...payload })
              : await createTrainingSession(payload);
            createdId = sessionId;

            if (file) {
              const prepared = await prepareTrainingSessionFileUpload({
                sessionId,
                fileName: file.name,
                mimeType: file.type || null,
              });
              storagePath = prepared.storagePath;
              const supabase = createSupabaseBrowserClient();
              const { error: uploadError } = await supabase.storage
                .from(TRAINING_SESSION_FILES_BUCKET)
                .upload(prepared.storagePath, file, {
                  contentType: file.type || undefined,
                  upsert: false,
                });
              if (uploadError) throw new Error(uploadError.message);
            }

            router.push(`/document-training/${sessionId}`);
            router.refresh();
          } catch (err) {
            if (!isEdit && createdId && storagePath) {
              try {
                const supabase = createSupabaseBrowserClient();
                await supabase.storage.from(TRAINING_SESSION_FILES_BUCKET).remove([storagePath]);
              } catch {
                // best-effort cleanup
              }
            }
            setError(err instanceof Error ? err.message : "Failed to save training.");
          }
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What kind of training is this?</CardTitle>
        </CardHeader>
        <CardContent>
          {isEdit && sessionType ? (
            <p className="text-sm text-muted-foreground">
              {trainingSessionTypeLabel(sessionType)}
              <span className="mt-1 block text-xs">
                Type cannot be changed after the report is created.
              </span>
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Training type">
              {SESSION_TYPES.map((option) => {
                const selected = sessionType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectSessionType(option.value)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="font-semibold">{option.label}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {sessionType ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {sessionType === "in_house" ? "In-house session details" : "Course details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <FieldLabel htmlFor="training-category">Category</FieldLabel>
                <Select
                  id="training-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  {categories.length === 0 ? (
                    <option value="">No categories available</option>
                  ) : (
                    categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {!category.is_active ? " (inactive)" : ""}
                      </option>
                    ))
                  )}
                </Select>
              </div>

              <div>
                <FieldLabel htmlFor="training-title">
                  {sessionType === "in_house" ? "Topic / title" : "Course name"}
                </FieldLabel>
                <Input
                  id="training-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder={
                    sessionType === "in_house"
                      ? "e.g. Hose deployment drill"
                      : "e.g. Firefighter I"
                  }
                />
              </div>

              {sessionType === "in_house" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="occurred-on">Date</FieldLabel>
                    <Input
                      id="occurred-on"
                      type="date"
                      value={occurredOn}
                      onChange={(e) => setOccurredOn(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="instructor-name">Instructor</FieldLabel>
                    <Input
                      id="instructor-name"
                      value={instructorName}
                      onChange={(e) => setInstructorName(e.target.value)}
                      required
                      placeholder="Name"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <FieldLabel htmlFor="provider">Provider</FieldLabel>
                    <Input
                      id="provider"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      required
                      placeholder="e.g. State Fire Academy"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <FieldLabel htmlFor="started-on">Start date</FieldLabel>
                      <Input
                        id="started-on"
                        type="date"
                        value={startedOn}
                        onChange={(e) => setStartedOn(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="ended-on">End date</FieldLabel>
                      <Input
                        id="ended-on"
                        type="date"
                        value={endedOn}
                        onChange={(e) => setEndedOn(e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="expires-on">Expiration</FieldLabel>
                      <Input
                        id="expires-on"
                        type="date"
                        value={expiresOn}
                        onChange={(e) => setExpiresOn(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="hours">Hours</FieldLabel>
                  <Input
                    id="hours"
                    type="number"
                    min={0}
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Station, classroom, etc."
                  />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional"
                />
              </div>

              {sessionType === "certification_course" ? (
                <div>
                  <FieldLabel htmlFor="certificate-file">
                    {isEdit ? "Add certificate (optional)" : "Certificate (optional)"}
                  </FieldLabel>
                  <Input
                    id="certificate-file"
                    ref={fileInputRef}
                    type="file"
                    accept={TRAINING_SESSION_FILE_ACCEPT}
                  />
                  <FieldHint>PDF or image, up to 20 MB.</FieldHint>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attendees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No personnel profiles found.</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-3">
                      <FieldLabel htmlFor="attendee-search">Search</FieldLabel>
                      <Input
                        id="attendee-search"
                        type="search"
                        placeholder="Search by name…"
                        value={attendeeQuery}
                        onChange={(e) => setAttendeeQuery(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="attendee-shift">Shift</FieldLabel>
                      <Select
                        id="attendee-shift"
                        value={attendeeShift}
                        onChange={(e) =>
                          setAttendeeShift(e.target.value as PersonnelShift | "")
                        }
                      >
                        <option value="">All shifts</option>
                        {personnelShifts.map((shift) => (
                          <option key={shift} value={shift}>
                            {personnelShiftLabel(shift)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <FieldLabel htmlFor="attendee-station">Station</FieldLabel>
                      <Select
                        id="attendee-station"
                        value={attendeeStationId}
                        onChange={(e) => setAttendeeStationId(e.target.value)}
                      >
                        <option value="">All stations</option>
                        {stationOptions.map((station) => (
                          <option key={station.id} value={station.id}>
                            {station.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3 sm:col-span-3">
                      {filteredProfiles.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">
                          No personnel match these filters.
                        </p>
                      ) : (
                        filteredProfiles.map((person) => {
                          const checked = attendeeIds.includes(person.id);
                          const meta = [
                            personnelShiftLabel(person.shift),
                            person.primary_location?.name,
                          ]
                            .filter((part) => part && part !== "—")
                            .join(" · ");
                          return (
                            <label
                              key={person.id}
                              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                            >
                              <input
                                type="checkbox"
                                className="size-4 shrink-0 accent-primary"
                                checked={checked}
                                onChange={() => toggleAttendee(person.id)}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm">
                                  {personnelDisplayName(person)}
                                </span>
                                {meta ? (
                                  <span className="block text-xs text-muted-foreground">
                                    {meta}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div className="flex max-h-72 flex-col rounded-md border sm:col-span-2">
                      <div className="shrink-0 border-b px-3 py-2">
                        <p className="text-sm font-medium">
                          Selected ({selectedProfiles.length})
                        </p>
                      </div>
                      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                        {selectedProfiles.length === 0 ? (
                          <p className="px-1 py-1.5 text-sm text-muted-foreground">
                            None selected yet
                          </p>
                        ) : (
                          selectedProfiles.map((person) => (
                            <div
                              key={person.id}
                              className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted/60"
                            >
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {personnelDisplayName(person)}
                              </span>
                              <button
                                type="button"
                                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={`Remove ${personnelDisplayName(person)}`}
                                onClick={() => toggleAttendee(person.id)}
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {profiles.length > 0 && attendeeIds.length === 0 ? (
                <FieldHint>Select everyone who attended.</FieldHint>
              ) : null}
            </CardContent>
          </Card>

          {error ? <FieldError>{error}</FieldError> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save training"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => router.push(cancelHref)}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}
