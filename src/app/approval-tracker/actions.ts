"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { assertCapability, requireCapability } from "@/lib/capability-access";
import {
  APPROVAL_ASSIGNABLE_STAGES,
  APPROVAL_COMMITTEE_MEMBER_SELECT,
  APPROVAL_COMMITTEES,
  APPROVAL_DOC_TYPES,
  APPROVAL_DOCUMENT_LIST_SELECT,
  APPROVAL_EVENT_SELECT,
  APPROVAL_FILES_BUCKET,
  APPROVAL_PROFILE_OPTION_SELECT,
  APPROVAL_STAGE_MEMBER_SELECT,
  APPROVAL_STAGES,
  APPROVAL_SUBCOMMITTEES,
  APPROVAL_SUBMISSION_KINDS,
  buildApprovalFileStoragePath,
  earlierApprovalStages,
  groupStageMemberIds,
  nextApprovalStage,
  sanitizeApprovalFileName,
  type ApprovalAssignableStage,
  type ApprovalCommittee,
  type ApprovalCommitteeMember,
  type ApprovalCommitteeVote,
  type ApprovalDocType,
  type ApprovalDocument,
  type ApprovalDocumentDetail,
  type ApprovalDocumentEvent,
  type ApprovalDocumentListItem,
  type ApprovalProfileOption,
  type ApprovalProfileSummary,
  type ApprovalStage,
  type ApprovalStageMember,
  type ApprovalSubcommittee,
  type ApprovalSubmissionKind,
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

function parseCommittee(raw: string | null | undefined): ApprovalCommittee {
  if (raw && (APPROVAL_COMMITTEES as readonly string[]).includes(raw)) {
    return raw as ApprovalCommittee;
  }
  throw new Error("Choose a committee.");
}

function parseSubcommittee(
  committee: ApprovalCommittee,
  raw: string | null | undefined
): ApprovalSubcommittee | null {
  if (committee !== "operations") {
    if (raw) throw new Error("Only Operations has subcommittees.");
    return null;
  }
  if (raw && (APPROVAL_SUBCOMMITTEES as readonly string[]).includes(raw)) {
    return raw as ApprovalSubcommittee;
  }
  throw new Error("Choose an Operations subcommittee.");
}

function parseSubmissionKind(raw: string | null | undefined): ApprovalSubmissionKind {
  if (raw && (APPROVAL_SUBMISSION_KINDS as readonly string[]).includes(raw)) {
    return raw as ApprovalSubmissionKind;
  }
  throw new Error("Choose whether this is a new document or a replacement.");
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

export async function listApprovalCommitteeMembers(): Promise<ApprovalCommitteeMember[]> {
  await requireCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_committee_members")
    .select(APPROVAL_COMMITTEE_MEMBER_SELECT)
    .order("created_at", { ascending: true });
  throwIfDbError(error);
  return (data ?? []) as unknown as ApprovalCommitteeMember[];
}

export async function listApprovalCommitteeVotes(
  documentIds?: string[]
): Promise<ApprovalCommitteeVote[]> {
  await requireCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("approval_document_committee_votes")
    .select("document_id, profile_id, created_at");
  if (documentIds) {
    if (documentIds.length === 0) return [];
    query = query.in("document_id", documentIds);
  }
  const { data, error } = await query;
  throwIfDbError(error);
  return (data ?? []) as ApprovalCommitteeVote[];
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
  submissionKind: string;
  notes?: string | null;
}): Promise<{ id: string }> {
  const profile = await assertCapability("approval_tracker");
  const title = parseTitle(input.title);
  const docType = parseDocType(input.docType);
  const submissionKind = parseSubmissionKind(input.submissionKind);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_documents")
    .insert({
      title,
      doc_type: docType,
      submission_kind: submissionKind,
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
  submissionKind: string;
  notes?: string | null;
}) {
  await assertCapability("approval_tracker");
  const title = parseTitle(input.title);
  const docType = parseDocType(input.docType);
  const submissionKind = parseSubmissionKind(input.submissionKind);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("approval_documents")
    .update({
      title,
      doc_type: docType,
      submission_kind: submissionKind,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id);
  throwIfDbError(error);

  revalidateApprovals(input.id);
}

export async function prepareApprovalDocumentFileUpload(input: {
  documentId: string;
  fileName: string;
  mimeType?: string | null;
}) {
  await assertCapability("approval_tracker");
  const fileName = sanitizeApprovalFileName(input.fileName);
  if (!fileName) throw new Error("File name is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_documents")
    .select("id")
    .eq("id", input.documentId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Document not found.");

  const fileId = crypto.randomUUID();
  return {
    storagePath: buildApprovalFileStoragePath(input.documentId, fileId, fileName),
  };
}

export async function attachApprovalDocumentFile(input: {
  documentId: string;
  storagePath: string;
  fileName: string;
  mimeType?: string | null;
}) {
  await assertCapability("approval_tracker");
  const fileName = sanitizeApprovalFileName(input.fileName);
  const storagePath = input.storagePath.trim();
  if (!fileName || !storagePath) throw new Error("File is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_documents")
    .select("id, storage_path")
    .eq("id", input.documentId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Document not found.");

  const previousPath = data.storage_path;
  const { error: updateError } = await supabase
    .from("approval_documents")
    .update({
      file_name: fileName,
      storage_path: storagePath,
      mime_type: input.mimeType?.trim() || null,
    })
    .eq("id", input.documentId);
  throwIfDbError(updateError);

  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(APPROVAL_FILES_BUCKET).remove([previousPath]);
  }

  revalidateApprovals(input.documentId);
}

export async function getApprovalDocumentDownloadUrl(input: { documentId: string }) {
  await requireCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("approval_documents")
    .select("storage_path")
    .eq("id", input.documentId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data?.storage_path) throw new Error("No file is attached to this document.");

  const { data: signed, error: signedError } = await supabase.storage
    .from(APPROVAL_FILES_BUCKET)
    .createSignedUrl(data.storage_path, 60);
  if (signedError) throw new Error(signedError.message);
  if (!signed?.signedUrl) throw new Error("Could not create download link.");
  return { url: signed.signedUrl };
}

export async function advanceApprovalDocument(input: {
  id: string;
  comment?: string | null;
  committee?: string | null;
  subcommittee?: string | null;
}) {
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

  let committee: string | null = null;
  let subcommittee: string | null = null;
  if (data.current_stage === "special_projects_intake") {
    const parsed = parseCommittee(input.committee);
    committee = parsed;
    subcommittee = parseSubcommittee(parsed, input.subcommittee);
  }

  const { error: rpcError } = await supabase.rpc("transition_approval_document", {
    p_document_id: input.id,
    p_to_stage: next,
    p_comment: input.comment?.trim() || null,
    p_committee: committee,
    p_subcommittee: subcommittee,
  });
  throwIfDbError(rpcError);
  revalidateApprovals(input.id);
}

export async function recordApprovalCommitteeVote(input: { id: string }) {
  await assertCapability("approval_tracker");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_approval_committee_vote", {
    p_document_id: input.id,
  });
  throwIfDbError(error);
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
  profileIds: string[];
}) {
  await requireAdmin();
  const stage = parseAssignableStage(input.stage);
  const profileIds = uniqueIds(input.profileIds);
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("approval_stage_members")
    .delete()
    .eq("stage", stage);
  throwIfDbError(deleteError);

  if (profileIds.length > 0) {
    const { error: insertError } = await supabase.from("approval_stage_members").insert(
      profileIds.map((profile_id) => ({
        stage,
        track: null,
        profile_id,
      }))
    );
    throwIfDbError(insertError);
  }

  revalidateApprovals();
}

export async function replaceApprovalCommitteeMembers(input: {
  committee: string;
  subcommittee?: string | null;
  profileIds: string[];
  chairId?: string | null;
}) {
  await requireAdmin();
  const committee = parseCommittee(input.committee);
  const subcommittee = parseSubcommittee(committee, input.subcommittee);
  const chairId = input.chairId?.trim() || null;
  const profileIds = uniqueIds([
    ...input.profileIds,
    ...(chairId ? [chairId] : []),
  ]);
  if (chairId && !profileIds.includes(chairId)) {
    throw new Error("Chair must be a committee member.");
  }

  const supabase = await createSupabaseServerClient();
  let deleteQuery = supabase.from("approval_committee_members").delete().eq("committee", committee);
  deleteQuery = subcommittee
    ? deleteQuery.eq("subcommittee", subcommittee)
    : deleteQuery.is("subcommittee", null);
  const { error: deleteError } = await deleteQuery;
  throwIfDbError(deleteError);

  if (profileIds.length > 0) {
    const { error: insertError } = await supabase.from("approval_committee_members").insert(
      profileIds.map((profile_id) => ({
        committee,
        subcommittee,
        profile_id,
        is_chair: profile_id === chairId,
      }))
    );
    throwIfDbError(insertError);
  }

  revalidateApprovals();
}

export async function loadApprovalBoardContext() {
  const profile = await requireCapability("approval_tracker");
  const [documents, members, committeeMembers] = await Promise.all([
    listApprovalDocuments({ includeArchived: true }),
    listApprovalStageMembers(),
    listApprovalCommitteeMembers(),
  ]);
  const votes = await listApprovalCommitteeVotes(
    documents.filter((doc) => doc.current_stage === "committee").map((doc) => doc.id)
  );
  return {
    profile,
    isAdminUser: isAdmin(profile),
    documents,
    stageMemberIds: groupStageMemberIds(members),
    committeeMembers,
    votes,
  };
}
