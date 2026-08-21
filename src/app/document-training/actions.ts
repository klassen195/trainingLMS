"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertCapability, requireCapability } from "@/lib/capability-access";
import {
  TRAINING_SESSION_DAY_SELECT,
  TRAINING_SESSION_FILES_BUCKET,
  TRAINING_SESSION_SELECT,
  TRAINING_SESSION_WITH_RECORDER_SELECT,
  buildTrainingSessionFileStoragePath,
  sanitizeTrainingSessionFileName,
  type TrainingSession,
  type TrainingSessionDay,
  type TrainingSessionDetail,
  type TrainingSessionFile,
  type TrainingSessionListItem,
  type TrainingSessionProfileOption,
  type TrainingSessionType,
} from "@/lib/document-training-types";
import { hoursBetweenTimes, normalizeTimeInput } from "@/lib/dates";
import { personnelDisplayName } from "@/lib/personnel-types";
import {
  isMissingTrainingSessionsTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TrainingSessionDayInput = {
  occurredOn: string;
  startTime: string;
  endTime: string;
};

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingTrainingSessionsTable(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260804120000_document_training_sessions.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateTraining(sessionId?: string) {
  revalidatePath("/document-training");
  revalidatePath("/document-training/new");
  revalidatePath("/personnel", "layout");
  if (sessionId) {
    revalidatePath(`/document-training/${sessionId}`);
    revalidatePath(`/document-training/${sessionId}/edit`);
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function parseSessionTimes(input: {
  startTime?: string | null;
  endTime?: string | null;
}) {
  const startTime = normalizeTimeInput(input.startTime);
  const endTime = normalizeTimeInput(input.endTime);
  if (!startTime) throw new Error("Start time is required.");
  if (!endTime) throw new Error("End time is required.");
  if (endTime <= startTime) {
    throw new Error("End time must be after start time.");
  }
  const hours = hoursBetweenTimes(startTime, endTime);
  if (hours == null || hours <= 0) {
    throw new Error("Could not calculate hours from the start and end time.");
  }
  return { startTime, endTime, hours };
}

function parseCertificationDays(daysInput: TrainingSessionDayInput[] | undefined) {
  if (!daysInput || daysInput.length === 0) {
    throw new Error("Add at least one session day.");
  }

  const seenDates = new Set<string>();
  const days: {
    occurred_on: string;
    start_time: string;
    end_time: string;
    sort_order: number;
    hours: number;
  }[] = [];

  for (let i = 0; i < daysInput.length; i++) {
    const occurredOn = daysInput[i].occurredOn?.trim() || "";
    if (!occurredOn) throw new Error(`Day ${i + 1}: date is required.`);
    if (seenDates.has(occurredOn)) {
      throw new Error("Each session day must use a different date.");
    }
    seenDates.add(occurredOn);

    let parsed: { startTime: string; endTime: string; hours: number };
    try {
      parsed = parseSessionTimes(daysInput[i]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid times.";
      throw new Error(`Day ${i + 1}: ${message}`);
    }

    days.push({
      occurred_on: occurredOn,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      sort_order: i,
      hours: parsed.hours,
    });
  }

  days.sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  days.forEach((day, index) => {
    day.sort_order = index;
  });

  const talliedHours =
    Math.round(days.reduce((sum, day) => sum + day.hours, 0) * 100) / 100;
  const startedOn = days[0].occurred_on;
  const endedOn = days[days.length - 1].occurred_on;

  return { days, talliedHours, startedOn, endedOn };
}

function parseHoursOverride(raw: string | number | null | undefined) {
  if (raw == null || raw === "") {
    throw new Error("Override hours is required when override is enabled.");
  }
  const hours = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("Override hours must be greater than zero.");
  }
  return Math.round(hours * 100) / 100;
}

async function replaceSessionDays(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string,
  days: {
    occurred_on: string;
    start_time: string;
    end_time: string;
    sort_order: number;
  }[]
) {
  const { error: deleteError } = await supabase
    .from("training_session_days")
    .delete()
    .eq("session_id", sessionId);
  throwIfDbError(deleteError);

  if (days.length === 0) return;

  const { error: insertError } = await supabase.from("training_session_days").insert(
    days.map((day) => ({
      session_id: sessionId,
      occurred_on: day.occurred_on,
      start_time: day.start_time,
      end_time: day.end_time,
      sort_order: day.sort_order,
    }))
  );
  throwIfDbError(insertError);
}

async function resolveQualificationId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  qualificationIdRaw: string | null | undefined,
  allowInactiveId?: string | null
) {
  const qualificationId = qualificationIdRaw?.trim() || null;
  if (!qualificationId) return null;

  const { data, error } = await supabase
    .from("qualifications")
    .select("id, is_active")
    .eq("id", qualificationId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Qualification not found.");
  if (!data.is_active && data.id !== allowInactiveId) {
    throw new Error("That qualification is inactive.");
  }
  return data.id as string;
}

async function syncSessionQualificationGrants(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string,
  createdBy: string | null
) {
  const { data: session, error: sessionError } = await supabase
    .from("training_sessions")
    .select("id, qualification_id, occurred_on, started_on, expires_on")
    .eq("id", sessionId)
    .maybeSingle();
  throwIfDbError(sessionError);
  if (!session) return;

  const qualificationId = (session.qualification_id as string | null) ?? null;

  const { data: grantRows, error: grantsError } = await supabase
    .from("personnel_qualifications")
    .select("id, profile_id, qualification_id, source_session_id, earned_on, expires_on, notes")
    .eq("source_session_id", sessionId);
  throwIfDbError(grantsError);

  if (!qualificationId) {
    if ((grantRows ?? []).length > 0) {
      const { error: deleteError } = await supabase
        .from("personnel_qualifications")
        .delete()
        .eq("source_session_id", sessionId);
      throwIfDbError(deleteError);
    }
    return;
  }

  const { data: attendees, error: attendeesError } = await supabase
    .from("training_session_attendees")
    .select("profile_id")
    .eq("session_id", sessionId);
  throwIfDbError(attendeesError);

  const attendeeIds = (attendees ?? []).map((row) => row.profile_id as string);
  const attendeeSet = new Set(attendeeIds);
  const earnedOn =
    (session.occurred_on as string | null) ||
    (session.started_on as string | null) ||
    new Date().toISOString().slice(0, 10);
  const expiresOn = (session.expires_on as string | null) || null;

  for (const row of grantRows ?? []) {
    const profileId = row.profile_id as string;
    const rowQualId = row.qualification_id as string;
    if (!attendeeSet.has(profileId) || rowQualId !== qualificationId) {
      const { error: deleteError } = await supabase
        .from("personnel_qualifications")
        .delete()
        .eq("id", row.id);
      throwIfDbError(deleteError);
    }
  }

  if (attendeeIds.length === 0) return;

  const { data: existingRows, error: existingError } = await supabase
    .from("personnel_qualifications")
    .select("id, profile_id, qualification_id, source_session_id, earned_on, expires_on, notes")
    .eq("qualification_id", qualificationId)
    .in("profile_id", attendeeIds);
  throwIfDbError(existingError);

  const byProfile = new Map(
    (existingRows ?? []).map((row) => [row.profile_id as string, row])
  );

  for (const profileId of attendeeIds) {
    const existing = byProfile.get(profileId);
    if (!existing) {
      const { error: insertError } = await supabase.from("personnel_qualifications").insert({
        profile_id: profileId,
        qualification_id: qualificationId,
        earned_on: earnedOn,
        expires_on: expiresOn,
        source_session_id: sessionId,
        created_by: createdBy,
      });
      throwIfDbError(insertError);
      continue;
    }

    if (existing.source_session_id == null) {
      const { error: updateError } = await supabase
        .from("personnel_qualifications")
        .update({ source_session_id: sessionId })
        .eq("id", existing.id);
      throwIfDbError(updateError);
    } else if (existing.source_session_id === sessionId) {
      // Keep earned_on/notes; refresh expiration from the training report when set.
      if (expiresOn !== (existing.expires_on as string | null)) {
        const { error: updateError } = await supabase
          .from("personnel_qualifications")
          .update({ expires_on: expiresOn })
          .eq("id", existing.id);
        throwIfDbError(updateError);
      }
    }
    // Else: already has this qualification from another source — leave alone.
  }
}

export async function listTrainingSessionProfiles(): Promise<TrainingSessionProfileOption[]> {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, first_name, last_name, email, shift, primary_location_id, primary_location:locations!primary_location_id(id, name)"
    )
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  throwIfDbError(error);

  return ((data ?? []) as unknown as TrainingSessionProfileOption[]).sort((a, b) =>
    personnelDisplayName(a).localeCompare(personnelDisplayName(b), undefined, {
      sensitivity: "base",
    })
  );
}

export async function listTrainingSessions(): Promise<TrainingSessionListItem[]> {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("training_sessions")
    .select(TRAINING_SESSION_WITH_RECORDER_SELECT)
    .order("created_at", { ascending: false });
  throwIfDbError(error);

  const sessions = (data ?? []) as unknown as (TrainingSession & {
    recorder?: TrainingSessionListItem["recorder"];
    category?: TrainingSessionListItem["category"];
    qualification?: TrainingSessionListItem["qualification"];
  })[];

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: attendeeRows, error: attendeeError } = await supabase
    .from("training_session_attendees")
    .select("session_id")
    .in("session_id", sessionIds);
  throwIfDbError(attendeeError);

  const counts = new Map<string, number>();
  for (const row of attendeeRows ?? []) {
    const id = row.session_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return sessions.map((session) => ({
    ...session,
    attendee_count: counts.get(session.id) ?? 0,
  }));
}

export async function getTrainingSession(sessionId: string): Promise<TrainingSessionDetail | null> {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("training_sessions")
    .select(TRAINING_SESSION_WITH_RECORDER_SELECT)
    .eq("id", sessionId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) return null;

  const session = data as unknown as TrainingSession & {
    recorder?: TrainingSessionDetail["recorder"];
    category?: TrainingSessionDetail["category"];
    qualification?: TrainingSessionDetail["qualification"];
  };

  const [
    { data: attendees, error: attendeesError },
    { data: files, error: filesError },
    { data: days, error: daysError },
  ] = await Promise.all([
      supabase
        .from("training_session_attendees")
        .select(
          "session_id, profile_id, created_at, profile:profiles!profile_id(id, display_name, email)"
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      supabase
        .from("training_session_files")
        .select("id, session_id, file_name, storage_path, mime_type, uploaded_by, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      supabase
        .from("training_session_days")
        .select(TRAINING_SESSION_DAY_SELECT)
        .eq("session_id", sessionId)
        .order("sort_order", { ascending: true })
        .order("occurred_on", { ascending: true }),
    ]);

  throwIfDbError(attendeesError);
  throwIfDbError(filesError);
  throwIfDbError(daysError);

  return {
    ...session,
    attendees: (attendees ?? []) as unknown as TrainingSessionDetail["attendees"],
    files: (files ?? []) as TrainingSessionFile[],
    days: (days ?? []) as TrainingSessionDay[],
  };
}

export async function createTrainingSession(input: {
  sessionType: TrainingSessionType;
  categoryId: string;
  title: string;
  location?: string | null;
  notes?: string | null;
  occurredOn?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  instructorName?: string | null;
  provider?: string | null;
  expiresOn?: string | null;
  qualificationId?: string | null;
  days?: TrainingSessionDayInput[];
  hoursOverridden?: boolean;
  hoursOverride?: string | number | null;
  attendeeIds: string[];
}) {
  const profile = await assertCapability("document_training");
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const categoryId = input.categoryId.trim();
  if (!categoryId) throw new Error("Category is required.");

  const location = input.location?.trim() || null;
  const notes = input.notes?.trim() || null;
  const attendeeIds = uniqueIds(input.attendeeIds);

  const supabase = await createSupabaseServerClient();

  const { data: category, error: categoryError } = await supabase
    .from("training_categories")
    .select("id, is_active")
    .eq("id", categoryId)
    .maybeSingle();
  throwIfDbError(categoryError);
  if (!category) throw new Error("Category not found.");
  if (!category.is_active) throw new Error("That category is inactive.");

  const qualificationId = await resolveQualificationId(supabase, input.qualificationId);

  let row: Record<string, unknown>;
  let certificationDays: {
    occurred_on: string;
    start_time: string;
    end_time: string;
    sort_order: number;
  }[] | null = null;

  if (input.sessionType === "in_house") {
    const occurredOn = input.occurredOn?.trim() || "";
    const instructorName = input.instructorName?.trim() || "";
    if (!occurredOn) throw new Error("Training date is required.");
    if (!instructorName) throw new Error("Instructor is required.");
    const { startTime, endTime, hours } = parseSessionTimes(input);
    row = {
      session_type: "in_house",
      category_id: categoryId,
      title,
      hours,
      hours_overridden: false,
      location,
      notes,
      occurred_on: occurredOn,
      start_time: startTime,
      end_time: endTime,
      instructor_name: instructorName,
      provider: null,
      started_on: null,
      ended_on: null,
      expires_on: null,
      qualification_id: qualificationId,
      recorded_by: profile.id,
    };
  } else if (input.sessionType === "certification_course") {
    const provider = input.provider?.trim() || "";
    if (!provider) throw new Error("Course provider is required.");
    const parsedDays = parseCertificationDays(input.days);
    const hoursOverridden = Boolean(input.hoursOverridden);
    const hours = hoursOverridden
      ? parseHoursOverride(input.hoursOverride)
      : parsedDays.talliedHours;
    certificationDays = parsedDays.days;
    row = {
      session_type: "certification_course",
      category_id: categoryId,
      title,
      hours,
      hours_overridden: hoursOverridden,
      location,
      notes,
      occurred_on: null,
      start_time: null,
      end_time: null,
      instructor_name: null,
      provider,
      started_on: parsedDays.startedOn,
      ended_on: parsedDays.endedOn,
      expires_on: input.expiresOn?.trim() || null,
      qualification_id: qualificationId,
      recorded_by: profile.id,
    };
  } else {
    throw new Error("Invalid training type.");
  }

  if (attendeeIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", attendeeIds);
    throwIfDbError(profilesError);
    if ((profiles ?? []).length !== attendeeIds.length) {
      throw new Error("One or more attendees were not found.");
    }
  }

  const { data, error } = await supabase
    .from("training_sessions")
    .insert(row)
    .select(TRAINING_SESSION_SELECT)
    .single();
  throwIfDbError(error);
  if (!data) throw new Error("Failed to create training session.");

  const session = data as TrainingSession;

  try {
    if (certificationDays) {
      await replaceSessionDays(supabase, session.id, certificationDays);
    }

    if (attendeeIds.length > 0) {
      const { error: attendeeError } = await supabase.from("training_session_attendees").insert(
        attendeeIds.map((profileId) => ({
          session_id: session.id,
          profile_id: profileId,
        }))
      );
      throwIfDbError(attendeeError);
    }

    await syncSessionQualificationGrants(supabase, session.id, profile.id);
  } catch (err) {
    await supabase.from("training_sessions").delete().eq("id", session.id);
    throw err;
  }

  revalidateTraining(session.id);
  return { sessionId: session.id };
}

export async function deleteTrainingSession(sessionId: string) {
  await assertCapability("delete_training_reports");
  const supabase = await createSupabaseServerClient();

  const { data: session, error: sessionError } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();
  throwIfDbError(sessionError);
  if (!session) throw new Error("Training report not found.");

  const { data: files, error: filesError } = await supabase
    .from("training_session_files")
    .select("storage_path")
    .eq("session_id", sessionId);
  throwIfDbError(filesError);

  const { error: grantsError } = await supabase
    .from("personnel_qualifications")
    .delete()
    .eq("source_session_id", sessionId);
  throwIfDbError(grantsError);

  const storagePaths = (files ?? [])
    .map((file) => file.storage_path as string)
    .filter(Boolean);
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(TRAINING_SESSION_FILES_BUCKET)
      .remove(storagePaths);
    if (storageError) throw new Error(storageError.message);
  }

  const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
  throwIfDbError(error);

  revalidateTraining(sessionId);
  redirect("/document-training");
}

export async function updateTrainingSession(input: {
  sessionId: string;
  sessionType: TrainingSessionType;
  categoryId: string;
  title: string;
  location?: string | null;
  notes?: string | null;
  occurredOn?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  instructorName?: string | null;
  provider?: string | null;
  expiresOn?: string | null;
  qualificationId?: string | null;
  days?: TrainingSessionDayInput[];
  hoursOverridden?: boolean;
  hoursOverride?: string | number | null;
  attendeeIds: string[];
}) {
  const profile = await assertCapability("document_training");
  const sessionId = input.sessionId.trim();
  if (!sessionId) throw new Error("Session is required.");

  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const categoryId = input.categoryId.trim();
  if (!categoryId) throw new Error("Category is required.");

  const location = input.location?.trim() || null;
  const notes = input.notes?.trim() || null;
  const attendeeIds = uniqueIds(input.attendeeIds);

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("training_sessions")
    .select("id, session_type, category_id, qualification_id")
    .eq("id", sessionId)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Training session not found.");
  if (existing.session_type !== input.sessionType) {
    throw new Error("Training type cannot be changed after the report is created.");
  }

  const { data: category, error: categoryError } = await supabase
    .from("training_categories")
    .select("id, is_active")
    .eq("id", categoryId)
    .maybeSingle();
  throwIfDbError(categoryError);
  if (!category) throw new Error("Category not found.");
  if (!category.is_active && categoryId !== existing.category_id) {
    throw new Error("That category is inactive.");
  }

  const qualificationId = await resolveQualificationId(
    supabase,
    input.qualificationId,
    existing.qualification_id as string | null
  );

  let patch: Record<string, unknown>;
  let certificationDays: {
    occurred_on: string;
    start_time: string;
    end_time: string;
    sort_order: number;
  }[] | null = null;

  if (input.sessionType === "in_house") {
    const occurredOn = input.occurredOn?.trim() || "";
    const instructorName = input.instructorName?.trim() || "";
    if (!occurredOn) throw new Error("Training date is required.");
    if (!instructorName) throw new Error("Instructor is required.");
    const { startTime, endTime, hours } = parseSessionTimes(input);
    patch = {
      category_id: categoryId,
      title,
      hours,
      hours_overridden: false,
      location,
      notes,
      occurred_on: occurredOn,
      start_time: startTime,
      end_time: endTime,
      instructor_name: instructorName,
      provider: null,
      started_on: null,
      ended_on: null,
      expires_on: null,
      qualification_id: qualificationId,
    };
  } else if (input.sessionType === "certification_course") {
    const provider = input.provider?.trim() || "";
    if (!provider) throw new Error("Course provider is required.");
    const parsedDays = parseCertificationDays(input.days);
    const hoursOverridden = Boolean(input.hoursOverridden);
    const hours = hoursOverridden
      ? parseHoursOverride(input.hoursOverride)
      : parsedDays.talliedHours;
    certificationDays = parsedDays.days;
    patch = {
      category_id: categoryId,
      title,
      hours,
      hours_overridden: hoursOverridden,
      location,
      notes,
      occurred_on: null,
      start_time: null,
      end_time: null,
      instructor_name: null,
      provider,
      started_on: parsedDays.startedOn,
      ended_on: parsedDays.endedOn,
      expires_on: input.expiresOn?.trim() || null,
      qualification_id: qualificationId,
    };
  } else {
    throw new Error("Invalid training type.");
  }

  if (attendeeIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", attendeeIds);
    throwIfDbError(profilesError);
    if ((profiles ?? []).length !== attendeeIds.length) {
      throw new Error("One or more attendees were not found.");
    }
  }

  const { error: updateError } = await supabase
    .from("training_sessions")
    .update(patch)
    .eq("id", sessionId);
  throwIfDbError(updateError);

  if (certificationDays) {
    await replaceSessionDays(supabase, sessionId, certificationDays);
  }

  const { data: currentAttendees, error: currentAttendeesError } = await supabase
    .from("training_session_attendees")
    .select("profile_id")
    .eq("session_id", sessionId);
  throwIfDbError(currentAttendeesError);

  const currentIds = new Set((currentAttendees ?? []).map((row) => row.profile_id as string));
  const nextIds = new Set(attendeeIds);
  const toAdd = attendeeIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toAdd.length > 0) {
    const { error: addError } = await supabase.from("training_session_attendees").insert(
      toAdd.map((profileId) => ({
        session_id: sessionId,
        profile_id: profileId,
      }))
    );
    throwIfDbError(addError);
  }

  if (toRemove.length > 0) {
    const { error: removeError } = await supabase
      .from("training_session_attendees")
      .delete()
      .eq("session_id", sessionId)
      .in("profile_id", toRemove);
    throwIfDbError(removeError);
  }

  await syncSessionQualificationGrants(supabase, sessionId, profile.id);

  revalidateTraining(sessionId);
  return { sessionId };
}

export async function prepareTrainingSessionFileUpload(input: {
  sessionId: string;
  fileName: string;
  mimeType?: string | null;
}) {
  const profile = await assertCapability("document_training");
  const fileName = sanitizeTrainingSessionFileName(input.fileName);
  if (!fileName) throw new Error("File name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: session, error: sessionError } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", input.sessionId)
    .maybeSingle();
  throwIfDbError(sessionError);
  if (!session) throw new Error("Training session not found.");

  const fileId = crypto.randomUUID();
  const storagePath = buildTrainingSessionFileStoragePath(input.sessionId, fileId, fileName);

  const { error } = await supabase.from("training_session_files").insert({
    id: fileId,
    session_id: input.sessionId,
    file_name: fileName,
    storage_path: storagePath,
    mime_type: input.mimeType?.trim() || null,
    uploaded_by: profile.id,
  });
  throwIfDbError(error);

  revalidateTraining(input.sessionId);
  return { fileId, storagePath };
}

export async function getTrainingSessionFileDownloadUrl(input: {
  fileId: string;
  sessionId: string;
}) {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();

  const { data: file, error } = await supabase
    .from("training_session_files")
    .select("storage_path, session_id")
    .eq("id", input.fileId)
    .eq("session_id", input.sessionId)
    .maybeSingle();
  throwIfDbError(error);
  if (!file) throw new Error("File not found.");

  const { data, error: signedError } = await supabase.storage
    .from(TRAINING_SESSION_FILES_BUCKET)
    .createSignedUrl(file.storage_path, 60);
  if (signedError) throw new Error(signedError.message);
  if (!data?.signedUrl) throw new Error("Could not create download link.");
  return { url: data.signedUrl };
}
