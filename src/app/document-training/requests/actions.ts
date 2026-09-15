"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertCapability, requireCapability } from "@/lib/capability-access";
import { isAdmin } from "@/lib/permissions";
import {
  BATTALION_CHIEF_RANK,
  isShiftBattalionChiefOf,
  type PersonnelShift,
} from "@/lib/personnel-types";
import {
  isMissingUpcomingTrainingTables,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/training-lms-types";
import {
  TRAINING_ATTENDANCE_EVENT_SELECT,
  TRAINING_ATTENDANCE_REQUEST_LIST_SELECT,
  TRAINING_ATTENDANCE_REQUEST_SELECT,
  UPCOMING_TRAINING_SELECT,
  initialStageForApplicant,
  isTrainingAttendancePending,
  nextStageAfterApproval,
  type TrainingAttendancePendingStage,
  type TrainingAttendanceRequest,
  type TrainingAttendanceRequestDetail,
  type TrainingAttendanceRequestEvent,
  type TrainingAttendanceRequestListItem,
  type TrainingAttendanceStage,
  type UpcomingTraining,
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

function revalidateRequests(requestId?: string, listingId?: string | null) {
  revalidatePath("/document-training");
  revalidatePath("/document-training/upcoming");
  revalidatePath("/document-training/requests");
  revalidatePath("/document-training/requests/new");
  revalidatePath("/personnel/supervisor");
  revalidatePath("/", "layout");
  if (requestId) revalidatePath(`/document-training/requests/${requestId}`);
  if (listingId) revalidatePath(`/document-training/upcoming/${listingId}`);
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

function normalizeText(raw: string | null | undefined) {
  return raw?.trim() ?? "";
}

async function assertCanActAtStage(
  viewer: Profile,
  request: TrainingAttendanceRequestListItem,
  stage: TrainingAttendancePendingStage
) {
  if (isAdmin(viewer)) return;

  if (stage === "pending_captain") {
    if (request.applicant?.supervisor_id === viewer.id) return;
    throw new Error("Only the applicant's assigned captain can act on this request.");
  }

  if (stage === "pending_bc") {
    if (
      isShiftBattalionChiefOf(
        { id: viewer.id, rank: viewer.rank, shift: viewer.shift as PersonnelShift | null },
        {
          id: request.applicant_id,
          supervisor_id: request.applicant?.supervisor_id,
          shift: (request.applicant?.shift as PersonnelShift | null) ?? null,
        }
      )
    ) {
      return;
    }
    throw new Error("Only a Battalion Chief on the applicant's shift can act on this request.");
  }

  if (stage === "pending_ops") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("upcoming_training_ops_members")
      .select("id")
      .eq("profile_id", viewer.id)
      .maybeSingle();
    throwIfDbError(error);
    if (data) return;
    throw new Error("Only Ops Team members can act on this request.");
  }
}

async function insertEvent(input: {
  requestId: string;
  fromStage: string | null;
  toStage: string | null;
  action: string;
  comment?: string | null;
  actedBy: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("training_attendance_request_events").insert({
    request_id: input.requestId,
    from_stage: input.fromStage,
    to_stage: input.toStage,
    action: input.action,
    comment: input.comment?.trim() || null,
    acted_by: input.actedBy,
  });
  throwIfDbError(error);
}

async function requireApplicantCoverage(applicant: {
  id: string;
  rank: string | null | undefined;
  supervisor_id: string | null | undefined;
  shift: string | null | undefined;
}) {
  const stage = initialStageForApplicant(applicant.rank);
  if (stage === "pending_ops") return stage;

  if (stage === "pending_captain" && !applicant.supervisor_id) {
    throw new Error(
      "You need an assigned captain supervisor before requesting training attendance."
    );
  }

  if (stage === "pending_bc") {
    if (!applicant.shift) {
      throw new Error("You need a shift assignment before requesting training attendance.");
    }
    const supabase = await createSupabaseServerClient();
    const { data: bcs, error: bcError } = await supabase
      .from("profiles")
      .select("id")
      .eq("rank", BATTALION_CHIEF_RANK)
      .eq("shift", applicant.shift)
      .eq("is_active", true)
      .neq("id", applicant.id)
      .limit(1);
    throwIfDbError(bcError);
    if (!bcs?.length) {
      throw new Error(
        "You need a Battalion Chief on your shift before requesting training attendance."
      );
    }
  }

  return stage;
}

export type UnlistedTrainingRequestInput = {
  title: string;
  description?: string;
  provider?: string;
  location?: string;
  startsOn?: string | null;
  endsOn?: string | null;
  estimatedCost?: string | number | null;
  justification?: string;
};

export async function listMyTrainingAttendanceRequests(): Promise<
  TrainingAttendanceRequestListItem[]
> {
  const profile = await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("training_attendance_requests")
    .select(TRAINING_ATTENDANCE_REQUEST_LIST_SELECT)
    .eq("applicant_id", profile.id)
    .order("created_at", { ascending: false });
  throwIfDbError(error);
  return (data ?? []) as unknown as TrainingAttendanceRequestListItem[];
}

export async function listTrainingAttendanceRequestsWaitingOnMe(): Promise<
  TrainingAttendanceRequestListItem[]
> {
  const profile = await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const { data: opsMembership, error: opsError } = await supabase
    .from("upcoming_training_ops_members")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  throwIfDbError(opsError);
  const isOps = opsMembership != null;

  const { data, error } = await supabase
    .from("training_attendance_requests")
    .select(TRAINING_ATTENDANCE_REQUEST_LIST_SELECT)
    .in("current_stage", ["pending_captain", "pending_bc", "pending_ops"])
    .order("created_at", { ascending: true });
  throwIfDbError(error);

  const rows = (data ?? []) as unknown as TrainingAttendanceRequestListItem[];
  if (isAdmin(profile)) return rows;

  return rows.filter((row) => {
    if (row.current_stage === "pending_captain") {
      return row.applicant?.supervisor_id === profile.id;
    }
    if (row.current_stage === "pending_bc") {
      return isShiftBattalionChiefOf(
        { id: profile.id, rank: profile.rank, shift: profile.shift as PersonnelShift | null },
        {
          id: row.applicant_id,
          supervisor_id: row.applicant?.supervisor_id,
          shift: (row.applicant?.shift as PersonnelShift | null) ?? null,
        }
      );
    }
    if (row.current_stage === "pending_ops") {
      return isOps;
    }
    return false;
  });
}

export async function getTrainingAttendanceRequest(
  id: string
): Promise<TrainingAttendanceRequestDetail> {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("training_attendance_requests")
    .select(TRAINING_ATTENDANCE_REQUEST_LIST_SELECT)
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Training request not found.");

  const { data: events, error: eventsError } = await supabase
    .from("training_attendance_request_events")
    .select(TRAINING_ATTENDANCE_EVENT_SELECT)
    .eq("request_id", id)
    .order("created_at", { ascending: true });
  throwIfDbError(eventsError);

  return {
    ...(data as unknown as TrainingAttendanceRequestListItem),
    events: (events ?? []) as unknown as TrainingAttendanceRequestEvent[],
  };
}

export async function applyToUpcomingTraining(input: {
  upcomingTrainingId: string;
  justification?: string;
}) {
  const profile = await assertCapability("document_training");
  const supabase = await createSupabaseServerClient();

  const { data: listing, error: listingError } = await supabase
    .from("upcoming_trainings")
    .select(UPCOMING_TRAINING_SELECT)
    .eq("id", input.upcomingTrainingId)
    .maybeSingle();
  throwIfDbError(listingError);
  if (!listing) throw new Error("Upcoming training not found.");
  const openListing = listing as UpcomingTraining;
  if (openListing.status !== "open") {
    throw new Error("This opportunity is not open for applications.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("training_attendance_requests")
    .select("id, current_stage")
    .eq("applicant_id", profile.id)
    .eq("upcoming_training_id", openListing.id)
    .in("current_stage", ["pending_captain", "pending_bc", "pending_ops", "approved"]);
  throwIfDbError(existingError);
  if (existing && existing.length > 0) {
    throw new Error("You already have an open or approved request for this opportunity.");
  }

  const stage = await requireApplicantCoverage({
    id: profile.id,
    rank: profile.rank,
    supervisor_id: profile.supervisor_id,
    shift: profile.shift,
  });

  const { data, error } = await supabase
    .from("training_attendance_requests")
    .insert({
      applicant_id: profile.id,
      upcoming_training_id: openListing.id,
      title: openListing.title,
      description: openListing.description,
      provider: openListing.provider,
      location: openListing.location,
      starts_on: openListing.starts_on,
      ends_on: openListing.ends_on,
      estimated_cost: openListing.estimated_cost,
      justification: normalizeText(input.justification),
      current_stage: stage,
    })
    .select(TRAINING_ATTENDANCE_REQUEST_SELECT)
    .single();
  throwIfDbError(error);
  const row = data as TrainingAttendanceRequest;

  await insertEvent({
    requestId: row.id,
    fromStage: null,
    toStage: stage,
    action: "created",
    actedBy: profile.id,
  });

  revalidateRequests(row.id, openListing.id);
  return row;
}

export async function createUnlistedTrainingRequest(input: UnlistedTrainingRequestInput) {
  const profile = await assertCapability("document_training");
  const startsOn = parseOptionalDate(input.startsOn);
  const endsOn = parseOptionalDate(input.endsOn);
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new Error("End date must be on or after the start date.");
  }

  const stage = await requireApplicantCoverage({
    id: profile.id,
    rank: profile.rank,
    supervisor_id: profile.supervisor_id,
    shift: profile.shift,
  });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("training_attendance_requests")
    .insert({
      applicant_id: profile.id,
      upcoming_training_id: null,
      title: parseTitle(input.title),
      description: normalizeText(input.description),
      provider: normalizeText(input.provider),
      location: normalizeText(input.location),
      starts_on: startsOn,
      ends_on: endsOn,
      estimated_cost: parseOptionalCost(input.estimatedCost),
      justification: normalizeText(input.justification),
      current_stage: stage,
    })
    .select(TRAINING_ATTENDANCE_REQUEST_SELECT)
    .single();
  throwIfDbError(error);
  const row = data as TrainingAttendanceRequest;

  await insertEvent({
    requestId: row.id,
    fromStage: null,
    toStage: stage,
    action: "created",
    actedBy: profile.id,
  });

  revalidateRequests(row.id);
  return row;
}

export async function approveTrainingAttendanceRequest(input: {
  id: string;
  comment?: string;
}) {
  const viewer = await assertCapability("document_training");
  const request = await getTrainingAttendanceRequest(input.id);
  if (!isTrainingAttendancePending(request.current_stage)) {
    throw new Error("Only pending requests can be approved.");
  }
  await assertCanActAtStage(viewer, request, request.current_stage);

  const nextStage = nextStageAfterApproval(request.current_stage);
  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("training_attendance_requests")
    .update({
      current_stage: nextStage,
      denial_reason: null,
      decided_by: nextStage === "approved" ? viewer.id : null,
      decided_at: nextStage === "approved" ? now : null,
    })
    .eq("id", input.id)
    .eq("current_stage", request.current_stage);
  throwIfDbError(error);

  await insertEvent({
    requestId: input.id,
    fromStage: request.current_stage,
    toStage: nextStage,
    action: nextStage === "approved" ? "approved" : "advanced",
    comment: input.comment,
    actedBy: viewer.id,
  });

  revalidateRequests(input.id, request.upcoming_training_id);
}

export async function denyTrainingAttendanceRequest(input: {
  id: string;
  reason?: string;
}) {
  const viewer = await assertCapability("document_training");
  const request = await getTrainingAttendanceRequest(input.id);
  if (!isTrainingAttendancePending(request.current_stage)) {
    throw new Error("Only pending requests can be denied.");
  }
  await assertCanActAtStage(viewer, request, request.current_stage);

  const reason = normalizeText(input.reason);
  if (!reason) throw new Error("A denial reason is required.");

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("training_attendance_requests")
    .update({
      current_stage: "denied" satisfies TrainingAttendanceStage,
      denial_reason: reason,
      decided_by: viewer.id,
      decided_at: now,
    })
    .eq("id", input.id)
    .eq("current_stage", request.current_stage);
  throwIfDbError(error);

  await insertEvent({
    requestId: input.id,
    fromStage: request.current_stage,
    toStage: "denied",
    action: "denied",
    comment: reason,
    actedBy: viewer.id,
  });

  revalidateRequests(input.id, request.upcoming_training_id);
}

export async function withdrawTrainingAttendanceRequest(input: { id: string }) {
  const viewer = await assertCapability("document_training");
  const request = await getTrainingAttendanceRequest(input.id);
  if (request.applicant_id !== viewer.id && !isAdmin(viewer)) {
    throw new Error("Only the applicant can withdraw this request.");
  }
  if (!isTrainingAttendancePending(request.current_stage)) {
    throw new Error("Only pending requests can be withdrawn.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("training_attendance_requests")
    .update({
      current_stage: "withdrawn" satisfies TrainingAttendanceStage,
      decided_by: viewer.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("current_stage", request.current_stage);
  throwIfDbError(error);

  await insertEvent({
    requestId: input.id,
    fromStage: request.current_stage,
    toStage: "withdrawn",
    action: "withdrawn",
    actedBy: viewer.id,
  });

  revalidateRequests(input.id, request.upcoming_training_id);
}

export async function viewerCanDecideTrainingRequest(
  viewer: Profile,
  request: TrainingAttendanceRequestListItem
) {
  if (!isTrainingAttendancePending(request.current_stage)) return false;
  try {
    await assertCanActAtStage(viewer, request, request.current_stage);
    return true;
  } catch {
    return false;
  }
}
