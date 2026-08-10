"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertCapability, requireCapability } from "@/lib/capability-access";
import {
  TRAINING_SESSION_FILES_BUCKET,
  TRAINING_SESSION_SELECT,
  TRAINING_SESSION_WITH_RECORDER_SELECT,
  buildTrainingSessionFileStoragePath,
  sanitizeTrainingSessionFileName,
  type TrainingSession,
  type TrainingSessionDetail,
  type TrainingSessionFile,
  type TrainingSessionListItem,
  type TrainingSessionProfileOption,
  type TrainingSessionType,
} from "@/lib/document-training-types";
import { personnelDisplayName } from "@/lib/personnel-types";
import {
  isMissingTrainingSessionsTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function parseHours(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Hours must be a non-negative number.");
  }
  return n;
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
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
  };

  const [{ data: attendees, error: attendeesError }, { data: files, error: filesError }] =
    await Promise.all([
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
    ]);

  throwIfDbError(attendeesError);
  throwIfDbError(filesError);

  return {
    ...session,
    attendees: (attendees ?? []) as unknown as TrainingSessionDetail["attendees"],
    files: (files ?? []) as TrainingSessionFile[],
  };
}

export async function createTrainingSession(input: {
  sessionType: TrainingSessionType;
  categoryId: string;
  title: string;
  hours?: number | string | null;
  location?: string | null;
  notes?: string | null;
  occurredOn?: string | null;
  instructorName?: string | null;
  provider?: string | null;
  startedOn?: string | null;
  endedOn?: string | null;
  expiresOn?: string | null;
  attendeeIds: string[];
}) {
  const profile = await assertCapability("document_training");
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const categoryId = input.categoryId.trim();
  if (!categoryId) throw new Error("Category is required.");

  const hours = parseHours(input.hours);
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

  let row: Record<string, unknown>;

  if (input.sessionType === "in_house") {
    const occurredOn = input.occurredOn?.trim() || "";
    const instructorName = input.instructorName?.trim() || "";
    if (!occurredOn) throw new Error("Training date is required.");
    if (!instructorName) throw new Error("Instructor is required.");
    row = {
      session_type: "in_house",
      category_id: categoryId,
      title,
      hours,
      location,
      notes,
      occurred_on: occurredOn,
      instructor_name: instructorName,
      provider: null,
      started_on: null,
      ended_on: null,
      expires_on: null,
      recorded_by: profile.id,
    };
  } else if (input.sessionType === "certification_course") {
    const provider = input.provider?.trim() || "";
    const startedOn = input.startedOn?.trim() || "";
    if (!provider) throw new Error("Course provider is required.");
    if (!startedOn) throw new Error("Start date is required.");
    row = {
      session_type: "certification_course",
      category_id: categoryId,
      title,
      hours,
      location,
      notes,
      occurred_on: null,
      instructor_name: null,
      provider,
      started_on: startedOn,
      ended_on: input.endedOn?.trim() || null,
      expires_on: input.expiresOn?.trim() || null,
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

  if (attendeeIds.length > 0) {
    const { error: attendeeError } = await supabase.from("training_session_attendees").insert(
      attendeeIds.map((profileId) => ({
        session_id: session.id,
        profile_id: profileId,
      }))
    );
    if (attendeeError) {
      await supabase.from("training_sessions").delete().eq("id", session.id);
      throwIfDbError(attendeeError);
    }
  }

  revalidateTraining(session.id);
  return { sessionId: session.id };
}

export async function updateTrainingSession(input: {
  sessionId: string;
  sessionType: TrainingSessionType;
  categoryId: string;
  title: string;
  hours?: number | string | null;
  location?: string | null;
  notes?: string | null;
  occurredOn?: string | null;
  instructorName?: string | null;
  provider?: string | null;
  startedOn?: string | null;
  endedOn?: string | null;
  expiresOn?: string | null;
  attendeeIds: string[];
}) {
  await assertCapability("document_training");
  const sessionId = input.sessionId.trim();
  if (!sessionId) throw new Error("Session is required.");

  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const categoryId = input.categoryId.trim();
  if (!categoryId) throw new Error("Category is required.");

  const hours = parseHours(input.hours);
  const location = input.location?.trim() || null;
  const notes = input.notes?.trim() || null;
  const attendeeIds = uniqueIds(input.attendeeIds);

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("training_sessions")
    .select("id, session_type, category_id")
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

  let patch: Record<string, unknown>;

  if (input.sessionType === "in_house") {
    const occurredOn = input.occurredOn?.trim() || "";
    const instructorName = input.instructorName?.trim() || "";
    if (!occurredOn) throw new Error("Training date is required.");
    if (!instructorName) throw new Error("Instructor is required.");
    patch = {
      category_id: categoryId,
      title,
      hours,
      location,
      notes,
      occurred_on: occurredOn,
      instructor_name: instructorName,
      provider: null,
      started_on: null,
      ended_on: null,
      expires_on: null,
    };
  } else if (input.sessionType === "certification_course") {
    const provider = input.provider?.trim() || "";
    const startedOn = input.startedOn?.trim() || "";
    if (!provider) throw new Error("Course provider is required.");
    if (!startedOn) throw new Error("Start date is required.");
    patch = {
      category_id: categoryId,
      title,
      hours,
      location,
      notes,
      occurred_on: null,
      instructor_name: null,
      provider,
      started_on: startedOn,
      ended_on: input.endedOn?.trim() || null,
      expires_on: input.expiresOn?.trim() || null,
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
