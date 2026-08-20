"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { assertCapability, requireCapability } from "@/lib/capability-access";
import {
  APPROVAL_ASSIGNABLE_STAGES,
  APPROVAL_DOC_TYPES,
  APPROVAL_DOCUMENT_LIST_SELECT,
  APPROVAL_EVENT_SELECT,
  APPROVAL_PROFILE_OPTION_SELECT,
  APPROVAL_STAGE_MEMBER_SELECT,
  APPROVAL_STAGES,
  APPROVAL_TRACKS,
  earlierApprovalStages,
  groupStageMemberIds,
  nextApprovalStage,
  type ApprovalAssignableStage,
  type ApprovalDocType,
  type ApprovalDocument,
  type ApprovalDocumentDetail,
  type ApprovalDocumentEvent,
  type ApprovalDocumentListItem,
  type ApprovalProfileOption,
  type ApprovalProfileSummary,
  type ApprovalStage,
  type ApprovalStageMember,
  type ApprovalTrack,
} from "@/lib/approval-tracker-types";
import { personnelDisplayName } from "@/lib/personnel-types";
import {
  isMissingApprovalTrackerTables,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/permissions";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingApprovalTrackerTables(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260820120000_approval_tracker.sql, then refresh."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateApprovals(documentId?: string) {
  revalidatePath("/approval-tracker");
  revalidatePath("/approval-tracker/new");
  revalidatePath("/admin/approval-tracker");
  revalidatePath("/", "layout");
  if (documentId) {
    revalidatePath(`/approval-tracker/${documentId}`);
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function parseTitle(raw: string | null | undefined) {
  const title = raw?.trim() ?? "";
  if (!title) throw new Error("Title is required.");
  return title;
}

function parseDocType(raw: string | null | undefined): ApprovalDocType {
  if (raw && (APPROVAL_DOC_TYPES as readonly string[]).includes(raw)) {
    return raw as ApprovalDocType;
  }
  throw new Error("Choose a document type.");
}

function parseStage(raw: string | null | undefined): ApprovalStage {
  if (raw && (APPROVAL_STAGES as readonly string[]).includes(raw)) {
    return raw as ApprovalStage;
  }
  throw new Error("Invalid stage.");
}

function parseAssignableStage(raw: string | null | undefined): ApprovalAssignableStage {
  if (raw && (APPROVAL_ASSIGNABLE_STAGES as readonly string[]).includes(raw)) {
    return raw as ApprovalAssignableStage;
  }
  throw new Error("Invalid stage.");
}

function parseTrack(raw: string | null | undefined): ApprovalTrack {
  if (raw && (APPROVAL_TRACKS as readonly string[]).includes(raw)) {
    return raw as ApprovalTrack;
  }
  throw new Error("Choose Training or EMS.");
}

function parseOptionalTrack(
  stage: ApprovalAssignableStage,
  raw: string | null | undefined
): ApprovalTrack | null {
  if (stage === "fire_chief" || stage === "policy_holder") {
    if (raw) throw new Error("This stage is shared by both tracks.");
    return null;
  }
  return parseTrack(raw);
}

function asProfile(value: unknown): ApprovalProfileSummary | null {
  if (!value || typeof value !== "object") return null;
  const row = value as ApprovalProfileSummary;
  if (typeof row.id !== "string") return null;
  return row;
}

export async function listApprovalProfiles(): Promise<ApprovalProfileOption[]> {
  await requireCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(APPROVAL_PROFILE_OPTION_SELECT)
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  throwIfDbError(error);

  return ((data ?? []) as unknown as ApprovalProfileOption[]).sort((a, b) =>
    personnelDisplayName(a).localeCompare(personnelDisplayName(b), undefined, {
      sensitivity: "base",
    })
  );
}

export async function listAdminApprovalProfiles(): Promise<ApprovalProfileOption[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(APPROVAL_PROFILE_OPTION_SELECT)
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  throwIfDbError(error);

  return ((data ?? []) as unknown as ApprovalProfileOption[]).sort((a, b) =>
    personnelDisplayName(a).localeCompare(personnelDisplayName(b), undefined, {
      sensitivity: "base",
    })
  );
}

export async function listApprovalStageMembers(): Promise<ApprovalStageMember[]> {
  await requireCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_stage_members")
    .select(APPROVAL_STAGE_MEMBER_SELECT)
    .order("created_at", { ascending: true });
  throwIfDbError(error);
  return (data ?? []) as unknown as ApprovalStageMember[];
}

export async function listApprovalDocuments(options?: {
  includeArchived?: boolean;
}): Promise<ApprovalDocumentListItem[]> {
  await requireCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("approval_documents")
    .select(APPROVAL_DOCUMENT_LIST_SELECT)
    .order("stage_entered_at", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  throwIfDbError(error);

  const documents = (data ?? []) as unknown as (ApprovalDocument & {
    creator?: ApprovalProfileSummary | null;
  })[];

  return documents.map((doc) => ({
    ...doc,
    creator: asProfile(doc.creator),
  }));
}

export async function getApprovalDocument(
  documentId: string
): Promise<ApprovalDocumentDetail | null> {
  await requireCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("approval_documents")
    .select(`${APPROVAL_DOCUMENT_LIST_SELECT}`)
    .eq("id", documentId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) return null;

  const { data: events, error: eventError } = await supabase
    .from("approval_document_events")
    .select(APPROVAL_EVENT_SELECT)
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  throwIfDbError(eventError);

  const document = data as unknown as ApprovalDocument & {
    creator?: ApprovalProfileSummary | null;
  };

  return {
    ...document,
    creator: asProfile(document.creator),
    events: ((events ?? []) as unknown as ApprovalDocumentEvent[]).map((event) => ({
      ...event,
      actor: asProfile(event.actor),
    })),
  };
}

export async function createApprovalDocument(input: {
  title: string;
  docType: string;
  track: string;
  notes?: string | null;
}): Promise<{ id: string }> {
  const profile = await assertCapability("approval_tracker");
  const title = parseTitle(input.title);
  const docType = parseDocType(input.docType);
  const track = parseTrack(input.track);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_documents")
    .insert({
      title,
      doc_type: docType,
      track,
      notes: input.notes?.trim() || null,
      created_by: profile.id,
      current_stage: "creator",
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (!data?.id) throw new Error("Failed to create document.");

  revalidateApprovals(data.id);
  return { id: data.id };
}

export async function updateApprovalDocument(input: {
  id: string;
  title: string;
  docType: string;
  track: string;
  notes?: string | null;
}) {
  await assertCapability("approval_tracker");
  const title = parseTitle(input.title);
  const docType = parseDocType(input.docType);
  const track = parseTrack(input.track);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("approval_documents")
    .update({
      title,
      doc_type: docType,
      track,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id);
  throwIfDbError(error);

  revalidateApprovals(input.id);
}

export async function advanceApprovalDocument(input: { id: string; comment?: string | null }) {
  await assertCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_documents")
    .select("id, current_stage, archived_at")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Document not found.");

  const next = nextApprovalStage(data.current_stage as ApprovalStage);
  if (!next) throw new Error("This document cannot advance further.");

  const { error: rpcError } = await supabase.rpc("transition_approval_document", {
    p_document_id: input.id,
    p_to_stage: next,
    p_comment: input.comment?.trim() || null,
  });
  throwIfDbError(rpcError);
  revalidateApprovals(input.id);
}

export async function kickBackApprovalDocument(input: {
  id: string;
  toStage: string;
  comment: string;
}) {
  await assertCapability("approval_tracker");
  const toStage = parseStage(input.toStage);
  const comment = input.comment.trim();
  if (!comment) throw new Error("A comment is required when kicking a document back.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_documents")
    .select("id, current_stage")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Document not found.");

  const allowed = earlierApprovalStages(data.current_stage as ApprovalStage);
  if (!allowed.includes(toStage)) {
    throw new Error("Choose an earlier stage.");
  }

  const { error: rpcError } = await supabase.rpc("transition_approval_document", {
    p_document_id: input.id,
    p_to_stage: toStage,
    p_comment: comment,
  });
  throwIfDbError(rpcError);
  revalidateApprovals(input.id);
}

export async function setApprovalDocumentArchived(input: { id: string; archived: boolean }) {
  await assertCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_documents")
    .select("id, current_stage, archived_at")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Document not found.");
  if (data.current_stage !== "approved") {
    throw new Error("Only approved documents can be archived.");
  }

  const { error: updateError } = await supabase
    .from("approval_documents")
    .update({ archived_at: input.archived ? new Date().toISOString() : null })
    .eq("id", input.id);
  throwIfDbError(updateError);
  revalidateApprovals(input.id);
}

export async function replaceApprovalStageMembers(input: {
  stage: string;
  track?: string | null;
  profileIds: string[];
}) {
  await requireAdmin();
  const stage = parseAssignableStage(input.stage);
  const track = parseOptionalTrack(stage, input.track);
  const profileIds = uniqueIds(input.profileIds);
  const supabase = await createSupabaseServerClient();

  let deleteQuery = supabase.from("approval_stage_members").delete().eq("stage", stage);
  deleteQuery = track ? deleteQuery.eq("track", track) : deleteQuery.is("track", null);
  const { error: deleteError } = await deleteQuery;
  throwIfDbError(deleteError);

  if (profileIds.length > 0) {
    const { error: insertError } = await supabase.from("approval_stage_members").insert(
      profileIds.map((profile_id) => ({
        stage,
        track,
        profile_id,
      }))
    );
    throwIfDbError(insertError);
  }

  revalidateApprovals();
}

export async function loadApprovalBoardContext() {
  const profile = await requireCapability("approval_tracker");
  const [documents, members] = await Promise.all([
    listApprovalDocuments({ includeArchived: true }),
    listApprovalStageMembers(),
  ]);
  return {
    profile,
    isAdminUser: isAdmin(profile),
    documents,
    stageMemberIds: groupStageMemberIds(members),
  };
}
