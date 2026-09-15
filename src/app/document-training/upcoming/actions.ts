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
import {
  UPCOMING_TRAINING_LIST_SELECT,
  UPCOMING_TRAINING_OPS_MEMBER_SELECT,
  UPCOMING_TRAINING_SELECT,
  UPCOMING_TRAINING_STATUSES,
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

function normalizeText(raw: string | null | undefined) {
  return raw?.trim() ?? "";
}

export type UpcomingTrainingInput = {
  title: string;
  description?: string;
  provider?: string;
  location?: string;
  startsOn?: string | null;
  endsOn?: string | null;
  applicationDeadline?: string | null;
  estimatedCost?: string | number | null;
  externalUrl?: string;
  notes?: string;
  status: string;
};

function listingPayload(input: UpcomingTrainingInput, createdBy?: string) {
  const startsOn = parseOptionalDate(input.startsOn);
  const endsOn = parseOptionalDate(input.endsOn);
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new Error("End date must be on or after the start date.");
  }
  return {
    title: parseTitle(input.title),
    description: normalizeText(input.description),
    provider: normalizeText(input.provider),
    location: normalizeText(input.location),
    starts_on: startsOn,
    ends_on: endsOn,
    application_deadline: parseOptionalDate(input.applicationDeadline),
    estimated_cost: parseOptionalCost(input.estimatedCost),
    external_url: normalizeText(input.externalUrl),
    notes: normalizeText(input.notes),
    status: parseStatus(input.status),
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
  const { error } = await supabase.from("upcoming_trainings").delete().eq("id", id);
  throwIfDbError(error);
  revalidateUpcoming(id);
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
