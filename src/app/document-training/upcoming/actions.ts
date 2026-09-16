"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { assertCapability, requireCapability } from "@/lib/capability-access";
import { excludePlatformOperatorsFromRoster } from "@/lib/department-roster";
import { comparePersonnelByName } from "@/lib/personnel-types";
import {
  isMissingUpcomingTrainingTables,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeTimeInput } from "@/lib/dates";
import {
  TRAINING_AUTHORIZATION_LEVELS,
  UPCOMING_TRAINING_FLYERS_BUCKET,
  UPCOMING_TRAINING_LIST_SELECT,
  UPCOMING_TRAINING_OPS_MEMBER_SELECT,
  UPCOMING_TRAINING_SELECT,
  UPCOMING_TRAINING_STATUSES,
  buildUpcomingTrainingFlyerStoragePath,
  sanitizeUpcomingTrainingFlyerFileName,
  type TrainingAuthorizationLevel,
  type UpcomingTraining,
  type UpcomingTrainingListItem,
  type UpcomingTrainingOpsMember,
  type UpcomingTrainingStatus,
} from "@/lib/upcoming-training-types";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingUpcomingTrainingTables(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260915120000_upcoming_training_requests.sql, then refresh."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateUpcoming(id?: string) {
  revalidatePath("/document-training");
  revalidatePath("/document-training/upcoming");
  revalidatePath("/document-training/upcoming/new");
  revalidatePath("/document-training/requests");
  revalidatePath("/admin/upcoming-training-ops");
  if (id) {
    revalidatePath(`/document-training/upcoming/${id}`);
    revalidatePath(`/document-training/upcoming/${id}/edit`);
  }
}

function parseTitle(raw: string | null | undefined) {
  const title = raw?.trim() ?? "";
  if (!title) throw new Error("Title is required.");
  return title;
}

function parseOptionalDate(raw: string | null | undefined) {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Use a valid date.");
  }
  return value;
}

function parseOptionalCost(raw: string | number | null | undefined) {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("Estimated cost must be a non-negative number.");
  return Math.round(n * 100) / 100;
}

function parseStatus(raw: string | null | undefined): UpcomingTrainingStatus {
  if (raw && (UPCOMING_TRAINING_STATUSES as readonly string[]).includes(raw)) {
    return raw as UpcomingTrainingStatus;
  }
  throw new Error("Choose a status.");
}

function parseAuthorizationLevel(
  raw: string | null | undefined
): TrainingAuthorizationLevel | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if ((TRAINING_AUTHORIZATION_LEVELS as readonly string[]).includes(value)) {
    return value as TrainingAuthorizationLevel;
  }
  throw new Error("Choose a valid authorization level.");
}

function normalizeText(raw: string | null | undefined) {
  return raw?.trim() ?? "";
}

export type UpcomingTrainingInput = {
  title: string;
  description?: string;
  provider?: string;
  location?: string;
  city?: string;
  startsOn?: string | null;
  endsOn?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  applicationDeadline?: string | null;
  estimatedCost?: string | number | null;
  externalUrl?: string;
  notes?: string;
  status: string;
  authorizationLevel?: string | null;
};

function listingPayload(input: UpcomingTrainingInput, createdBy?: string) {
  const startsOn = parseOptionalDate(input.startsOn);
  const endsOn = parseOptionalDate(input.endsOn);
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new Error("End date must be on or after the start date.");
  }
  const startTime = normalizeTimeInput(input.startTime);
  const endTime = normalizeTimeInput(input.endTime);
  if (startTime && endTime && endTime < startTime) {
    throw new Error("End time must be on or after the start time.");
  }
  return {
    title: parseTitle(input.title),
    description: normalizeText(input.description),
    provider: normalizeText(input.provider),
    location: normalizeText(input.location),
    city: normalizeText(input.city),
    starts_on: startsOn,
    ends_on: endsOn,
    start_time: startTime,
    end_time: endTime,
    application_deadline: parseOptionalDate(input.applicationDeadline),
    estimated_cost: parseOptionalCost(input.estimatedCost),
    external_url: normalizeText(input.externalUrl),
    notes: normalizeText(input.notes),
    status: parseStatus(input.status),
    authorization_level: parseAuthorizationLevel(input.authorizationLevel),
    ...(createdBy ? { created_by: createdBy } : {}),
  };
}

export async function listUpcomingTrainings(options?: {
  includeNonOpen?: boolean;
}): Promise<UpcomingTrainingListItem[]> {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("upcoming_trainings")
    .select(UPCOMING_TRAINING_LIST_SELECT)
    .order("starts_on", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  if (!options?.includeNonOpen) {
    query = query.eq("status", "open");
  }

  const { data, error } = await query;
  throwIfDbError(error);
  return (data ?? []) as unknown as UpcomingTrainingListItem[];
}

export async function getUpcomingTraining(id: string): Promise<UpcomingTrainingListItem> {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("upcoming_trainings")
    .select(UPCOMING_TRAINING_LIST_SELECT)
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Upcoming training not found.");
  return data as unknown as UpcomingTrainingListItem;
}

/** Approved applicants for an opportunity — used when converting to a training report. */
export async function listApprovedApplicantIdsForUpcomingTraining(
  upcomingTrainingId: string
): Promise<string[]> {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("training_attendance_requests")
    .select("applicant_id")
    .eq("upcoming_training_id", upcomingTrainingId)
    .eq("current_stage", "approved");
  throwIfDbError(error);
  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.applicant_id as string)
        .filter((id) => Boolean(id?.trim()))
    ),
  ];
}

export async function createUpcomingTraining(input: UpcomingTrainingInput) {
  const profile = await assertCapability("manage_upcoming_training");
  const supabase = await createSupabaseServerClient();
  const payload = listingPayload(input, profile.id);
  const { data, error } = await supabase
    .from("upcoming_trainings")
    .insert(payload)
    .select(UPCOMING_TRAINING_SELECT)
    .single();
  throwIfDbError(error);
  const row = data as UpcomingTraining;
  revalidateUpcoming(row.id);
  return row;
}

export async function updateUpcomingTraining(id: string, input: UpcomingTrainingInput) {
  await assertCapability("manage_upcoming_training");
  const supabase = await createSupabaseServerClient();
  const payload = listingPayload(input);
  const { data, error } = await supabase
    .from("upcoming_trainings")
    .update(payload)
    .eq("id", id)
    .select(UPCOMING_TRAINING_SELECT)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Upcoming training not found.");
  revalidateUpcoming(id);
  return data as UpcomingTraining;
}

export async function duplicateUpcomingTraining(id: string) {
  const profile = await assertCapability("manage_upcoming_training");
  const supabase = await createSupabaseServerClient();
  const { data: source, error: sourceError } = await supabase
    .from("upcoming_trainings")
    .select(UPCOMING_TRAINING_SELECT)
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(sourceError);
  if (!source) throw new Error("Upcoming training not found.");

  const sourceRow = source as UpcomingTraining;
  const titleBase = sourceRow.title.trim() || "Untitled";
  const copyTitle = titleBase.endsWith("(copy)") ? titleBase : `${titleBase} (copy)`;

  const { data: created, error: createError } = await supabase
    .from("upcoming_trainings")
    .insert({
      title: copyTitle,
      description: sourceRow.description,
      provider: sourceRow.provider,
      location: sourceRow.location,
      city: sourceRow.city,
      starts_on: sourceRow.starts_on,
      ends_on: sourceRow.ends_on,
      start_time: sourceRow.start_time,
      end_time: sourceRow.end_time,
      application_deadline: sourceRow.application_deadline,
      estimated_cost: sourceRow.estimated_cost,
      external_url: sourceRow.external_url,
      notes: sourceRow.notes,
      status: "draft",
      authorization_level: sourceRow.authorization_level,
      created_by: profile.id,
    })
    .select(UPCOMING_TRAINING_SELECT)
    .single();
  throwIfDbError(createError);
  const row = created as UpcomingTraining;

  if (sourceRow.flyer_storage_path && sourceRow.flyer_file_name) {
    const fileId = crypto.randomUUID();
    const nextPath = buildUpcomingTrainingFlyerStoragePath(
      row.id,
      fileId,
      sourceRow.flyer_file_name
    );
    const { error: copyError } = await supabase.storage
      .from(UPCOMING_TRAINING_FLYERS_BUCKET)
      .copy(sourceRow.flyer_storage_path, nextPath);
    if (copyError) {
      // Listing still exists without flyer if copy fails.
      console.error("Failed to copy upcoming training flyer:", copyError.message);
    } else {
      const { error: attachError } = await supabase
        .from("upcoming_trainings")
        .update({
          flyer_file_name: sourceRow.flyer_file_name,
          flyer_storage_path: nextPath,
          flyer_mime_type: sourceRow.flyer_mime_type,
        })
        .eq("id", row.id);
      throwIfDbError(attachError);
      row.flyer_file_name = sourceRow.flyer_file_name;
      row.flyer_storage_path = nextPath;
      row.flyer_mime_type = sourceRow.flyer_mime_type;
    }
  }

  revalidateUpcoming(row.id);
  return row;
}

export async function setUpcomingTrainingStatus(id: string, status: string) {
  await assertCapability("manage_upcoming_training");
  const parsed = parseStatus(status);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("upcoming_trainings")
    .update({ status: parsed })
    .eq("id", id)
    .select(UPCOMING_TRAINING_SELECT)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Upcoming training not found.");
  revalidateUpcoming(id);
  return data as UpcomingTraining;
}

export async function deleteUpcomingTraining(id: string) {
  await assertCapability("manage_upcoming_training");
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("upcoming_trainings")
    .select("flyer_storage_path")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(existingError);

  const { error } = await supabase.from("upcoming_trainings").delete().eq("id", id);
  throwIfDbError(error);

  if (existing?.flyer_storage_path) {
    await supabase.storage
      .from(UPCOMING_TRAINING_FLYERS_BUCKET)
      .remove([existing.flyer_storage_path]);
  }
  revalidateUpcoming(id);
}

export async function prepareUpcomingTrainingFlyerUpload(input: {
  upcomingTrainingId: string;
  fileName: string;
  mimeType?: string | null;
}) {
  await assertCapability("manage_upcoming_training");
  const fileName = sanitizeUpcomingTrainingFlyerFileName(input.fileName);
  if (!fileName) throw new Error("File name is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("upcoming_trainings")
    .select("id")
    .eq("id", input.upcomingTrainingId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Upcoming training not found.");

  const fileId = crypto.randomUUID();
  return {
    storagePath: buildUpcomingTrainingFlyerStoragePath(
      input.upcomingTrainingId,
      fileId,
      fileName
    ),
  };
}

export async function attachUpcomingTrainingFlyer(input: {
  upcomingTrainingId: string;
  storagePath: string;
  fileName: string;
  mimeType?: string | null;
}) {
  await assertCapability("manage_upcoming_training");
  const fileName = sanitizeUpcomingTrainingFlyerFileName(input.fileName);
  const storagePath = input.storagePath.trim();
  if (!fileName || !storagePath) throw new Error("Flyer is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("upcoming_trainings")
    .select("id, flyer_storage_path")
    .eq("id", input.upcomingTrainingId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Upcoming training not found.");

  const previousPath = data.flyer_storage_path;
  const { error: updateError } = await supabase
    .from("upcoming_trainings")
    .update({
      flyer_file_name: fileName,
      flyer_storage_path: storagePath,
      flyer_mime_type: input.mimeType?.trim() || null,
    })
    .eq("id", input.upcomingTrainingId);
  throwIfDbError(updateError);

  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(UPCOMING_TRAINING_FLYERS_BUCKET).remove([previousPath]);
  }

  revalidateUpcoming(input.upcomingTrainingId);
}

export async function removeUpcomingTrainingFlyer(input: { upcomingTrainingId: string }) {
  await assertCapability("manage_upcoming_training");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("upcoming_trainings")
    .select("id, flyer_storage_path")
    .eq("id", input.upcomingTrainingId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Upcoming training not found.");

  const previousPath = data.flyer_storage_path;
  const { error: updateError } = await supabase
    .from("upcoming_trainings")
    .update({
      flyer_file_name: null,
      flyer_storage_path: null,
      flyer_mime_type: null,
    })
    .eq("id", input.upcomingTrainingId);
  throwIfDbError(updateError);

  if (previousPath) {
    await supabase.storage.from(UPCOMING_TRAINING_FLYERS_BUCKET).remove([previousPath]);
  }

  revalidateUpcoming(input.upcomingTrainingId);
}

export async function getUpcomingTrainingFlyerDownloadUrl(input: {
  upcomingTrainingId: string;
  expiresIn?: number;
}) {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("upcoming_trainings")
    .select("flyer_storage_path")
    .eq("id", input.upcomingTrainingId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data?.flyer_storage_path) throw new Error("No flyer is attached to this opportunity.");

  const { data: signed, error: signedError } = await supabase.storage
    .from(UPCOMING_TRAINING_FLYERS_BUCKET)
    .createSignedUrl(data.flyer_storage_path, input.expiresIn ?? 60);
  if (signedError) throw new Error(signedError.message);
  if (!signed?.signedUrl) throw new Error("Could not create download link.");
  return { url: signed.signedUrl };
}

export async function listUpcomingTrainingOpsMembers(): Promise<UpcomingTrainingOpsMember[]> {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("upcoming_training_ops_members")
    .select(UPCOMING_TRAINING_OPS_MEMBER_SELECT)
    .order("created_at", { ascending: true });
  throwIfDbError(error);
  return (data ?? []) as UpcomingTrainingOpsMember[];
}

export async function replaceUpcomingTrainingOpsMembers(input: { profileIds: string[] }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const profileIds = [...new Set(input.profileIds.map((id) => id.trim()).filter(Boolean))];

  const { error: deleteError } = await supabase
    .from("upcoming_training_ops_members")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  throwIfDbError(deleteError);

  if (profileIds.length > 0) {
    const { error: insertError } = await supabase.from("upcoming_training_ops_members").insert(
      profileIds.map((profile_id) => ({ profile_id }))
    );
    throwIfDbError(insertError);
  }

  revalidateUpcoming();
}

export async function listAdminUpcomingTrainingProfiles() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await excludePlatformOperatorsFromRoster(
    supabase
      .from("profiles")
      .select(
        "id, display_name, first_name, last_name, email, shift, primary_location_id, primary_location:locations!primary_location_id(id, name)"
      )
      .eq("is_active", true)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false })
  );
  throwIfDbError(error);
  return [...(data ?? [])].sort(comparePersonnelByName);
}
