import type { PersonnelShift } from "@/lib/personnel-types";

export const APPROVAL_DOC_TYPES = ["policy", "best_practice", "training_aid"] as const;
export type ApprovalDocType = (typeof APPROVAL_DOC_TYPES)[number];

export const APPROVAL_COMMITTEES = ["admin", "operations", "logistics", "prevention"] as const;
export type ApprovalCommittee = (typeof APPROVAL_COMMITTEES)[number];

export const APPROVAL_SUBCOMMITTEES = ["training", "ems", "general_operations"] as const;
export type ApprovalSubcommittee = (typeof APPROVAL_SUBCOMMITTEES)[number];

export const APPROVAL_STAGES = [
  "creator",
  "special_projects_intake",
  "committee",
  "special_projects_review",
  "policy_holder",
  "fire_chief",
  "approved",
] as const;
export type ApprovalStage = (typeof APPROVAL_STAGES)[number];

export const APPROVAL_ASSIGNABLE_STAGES = [
  "assistant_chief",
  "policy_holder",
  "fire_chief",
] as const;
export type ApprovalAssignableStage = (typeof APPROVAL_ASSIGNABLE_STAGES)[number];

export const APPROVAL_EVENT_ACTIONS = [
  "created",
  "advanced",
  "kicked_back",
  "approved",
  "archived",
  "unarchived",
  "committee_approved",
] as const;
export type ApprovalEventAction = (typeof APPROVAL_EVENT_ACTIONS)[number];

export type ApprovalAssignmentSlot = {
  key: string;
  stage: ApprovalAssignableStage;
  label: string;
};

export const APPROVAL_ASSIGNMENT_SLOTS: ApprovalAssignmentSlot[] = [
  {
    key: "assistant_chief",
    stage: "assistant_chief",
    label: "Assistant Chief of Special Projects",
  },
  {
    key: "policy_holder",
    stage: "policy_holder",
    label: "Policy holder group",
  },
  {
    key: "fire_chief",
    stage: "fire_chief",
    label: "Fire Chief",
  },
];

export type ApprovalCommitteeSlot = {
  key: string;
  committee: ApprovalCommittee;
  subcommittee: ApprovalSubcommittee | null;
  label: string;
};

export const APPROVAL_COMMITTEE_SLOTS: ApprovalCommitteeSlot[] = [
  { key: "admin", committee: "admin", subcommittee: null, label: "Admin committee" },
  {
    key: "operations:training",
    committee: "operations",
    subcommittee: "training",
    label: "Operations — Training",
  },
  {
    key: "operations:ems",
    committee: "operations",
    subcommittee: "ems",
    label: "Operations — EMS",
  },
  {
    key: "operations:general_operations",
    committee: "operations",
    subcommittee: "general_operations",
    label: "Operations — General Operations",
  },
  { key: "logistics", committee: "logistics", subcommittee: null, label: "Logistics committee" },
  { key: "prevention", committee: "prevention", subcommittee: null, label: "Prevention committee" },
];

export type ApprovalProfileSummary = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type ApprovalProfileOption = ApprovalProfileSummary & {
  shift: PersonnelShift | null;
  primary_location_id: string | null;
  primary_location?: { id: string; name: string } | null;
};

export const APPROVAL_SUBMISSION_KINDS = ["new", "replacement"] as const;
export type ApprovalSubmissionKind = (typeof APPROVAL_SUBMISSION_KINDS)[number];

export const APPROVAL_FILES_BUCKET = "approval-tracker-files";

export type ApprovalDocument = {
  id: string;
  title: string;
  doc_type: ApprovalDocType;
  submission_kind: ApprovalSubmissionKind;
  committee: ApprovalCommittee | null;
  subcommittee: ApprovalSubcommittee | null;
  current_stage: ApprovalStage;
  notes: string | null;
  file_name: string | null;
  storage_path: string | null;
  mime_type: string | null;
  created_by: string;
  stage_entered_at: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprovalDocumentListItem = ApprovalDocument & {
  creator?: ApprovalProfileSummary | null;
};

export type ApprovalDocumentEvent = {
  id: string;
  document_id: string;
  from_stage: ApprovalStage | null;
  to_stage: ApprovalStage | null;
  action: ApprovalEventAction;
  comment: string | null;
  acted_by: string | null;
  created_at: string;
  actor?: ApprovalProfileSummary | null;
};

export type ApprovalDocumentDetail = ApprovalDocument & {
  creator?: ApprovalProfileSummary | null;
  events: ApprovalDocumentEvent[];
};

export type ApprovalStageMember = {
  id: string;
  stage: ApprovalAssignableStage;
  track: null;
  profile_id: string;
  profile?: ApprovalProfileSummary | null;
};

export type ApprovalCommitteeMember = {
  id: string;
  committee: ApprovalCommittee;
  subcommittee: ApprovalSubcommittee | null;
  profile_id: string;
  is_chair: boolean;
  profile?: ApprovalProfileSummary | null;
};

export type ApprovalCommitteeVote = {
  document_id: string;
  profile_id: string;
  created_at: string;
};

export type ApprovalStageMemberIndex = {
  assistant_chief: string[];
  policy_holder: string[];
  fire_chief: string[];
};

export const APPROVAL_DOCUMENT_SELECT =
  "id, title, doc_type, submission_kind, committee, subcommittee, current_stage, notes, file_name, storage_path, mime_type, created_by, stage_entered_at, archived_at, created_at, updated_at";

export const APPROVAL_DOCUMENT_LIST_SELECT = `${APPROVAL_DOCUMENT_SELECT}, creator:profiles!created_by(id, display_name, first_name, last_name, email)`;

export const APPROVAL_EVENT_SELECT =
  "id, document_id, from_stage, to_stage, action, comment, acted_by, created_at, actor:profiles!acted_by(id, display_name, first_name, last_name, email)";

export const APPROVAL_STAGE_MEMBER_SELECT =
  "id, stage, track, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, email)";

export const APPROVAL_COMMITTEE_MEMBER_SELECT =
  "id, committee, subcommittee, profile_id, is_chair, profile:profiles!profile_id(id, display_name, first_name, last_name, email)";

export const APPROVAL_PROFILE_OPTION_SELECT =
  "id, display_name, first_name, last_name, email, shift, primary_location_id, primary_location:locations!primary_location_id(id, name)";

export function approvalDocTypeLabel(type: ApprovalDocType) {
  switch (type) {
    case "policy":
      return "Policy";
    case "best_practice":
      return "Best practice";
    case "training_aid":
      return "Training aid";
  }
}

export function approvalSubmissionKindLabel(kind: ApprovalSubmissionKind) {
  return kind === "replacement" ? "Replacement" : "New";
}

const APPROVAL_FILE_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
]);

const APPROVAL_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".pps",
  ".ppsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
  ".mkv",
  ".mpeg",
  ".mpg",
  ".m4v",
]);

export const APPROVAL_FILE_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".pps",
  ".ppsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
  ".mkv",
  ".mpeg",
  ".mpg",
  ".m4v",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
].join(",");

export function isApprovalDocumentFile(file: File) {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return APPROVAL_FILE_MIME_TYPES.has(file.type) || APPROVAL_FILE_EXTENSIONS.has(ext);
}

export function sanitizeApprovalFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned || "document";
}

export function buildApprovalFileStoragePath(
  documentId: string,
  fileId: string,
  fileName: string
) {
  return `${documentId}/${fileId}/${sanitizeApprovalFileName(fileName)}`;
}

export function approvalCommitteeLabel(committee: ApprovalCommittee) {
  switch (committee) {
    case "admin":
      return "Admin";
    case "operations":
      return "Operations";
    case "logistics":
      return "Logistics";
    case "prevention":
      return "Prevention";
  }
}

export function approvalSubcommitteeLabel(subcommittee: ApprovalSubcommittee) {
  switch (subcommittee) {
    case "training":
      return "Training";
    case "ems":
      return "EMS";
    case "general_operations":
      return "General Operations";
  }
}

export function approvalCommitteeBodyLabel(
  committee: ApprovalCommittee | null,
  subcommittee?: ApprovalSubcommittee | null
) {
  if (!committee) return "Unassigned";
  if (committee === "operations" && subcommittee) {
    return `Operations — ${approvalSubcommitteeLabel(subcommittee)}`;
  }
  return `${approvalCommitteeLabel(committee)} committee`;
}

export function approvalStageLabel(stage: ApprovalStage) {
  switch (stage) {
    case "creator":
      return "Document creator";
    case "special_projects_intake":
      return "Assign committee";
    case "committee":
      return "Committee";
    case "special_projects_review":
      return "Special Projects review";
    case "policy_holder":
      return "Policy holder group";
    case "fire_chief":
      return "Fire Chief";
    case "approved":
      return "Approved";
  }
}

export function approvalStageShortLabel(stage: ApprovalStage) {
  switch (stage) {
    case "creator":
      return "Creator";
    case "special_projects_intake":
      return "Assign";
    case "committee":
      return "Committee";
    case "special_projects_review":
      return "Review";
    case "policy_holder":
      return "Holders";
    case "fire_chief":
      return "Fire Chief";
    case "approved":
      return "Approved";
  }
}

export function approvalEventActionLabel(action: ApprovalEventAction) {
  switch (action) {
    case "created":
      return "Created";
    case "advanced":
      return "Advanced";
    case "kicked_back":
      return "Kicked back";
    case "approved":
      return "Approved";
    case "archived":
      return "Archived";
    case "unarchived":
      return "Restored";
    case "committee_approved":
      return "Committee member approved";
  }
}

export function approvalStageIndex(stage: ApprovalStage) {
  return APPROVAL_STAGES.indexOf(stage);
}

export function nextApprovalStage(stage: ApprovalStage): ApprovalStage | null {
  const index = approvalStageIndex(stage);
  if (index < 0 || index >= APPROVAL_STAGES.length - 1) return null;
  return APPROVAL_STAGES[index + 1];
}

export function earlierApprovalStages(stage: ApprovalStage): ApprovalStage[] {
  const index = approvalStageIndex(stage);
  if (index <= 0) return [];
  return APPROVAL_STAGES.slice(0, index);
}

export function committeeSlotKey(
  committee: ApprovalCommittee,
  subcommittee?: ApprovalSubcommittee | null
) {
  return subcommittee ? `${committee}:${subcommittee}` : committee;
}

export function membersForCommitteeBody(
  members: ApprovalCommitteeMember[],
  committee: ApprovalCommittee | null,
  subcommittee?: ApprovalSubcommittee | null
) {
  if (!committee) return [];
  return members.filter((member) => {
    if (member.committee !== committee) return false;
    if (committee === "operations") return member.subcommittee === subcommittee;
    return member.subcommittee == null;
  });
}

export function emptyStageMemberIndex(): ApprovalStageMemberIndex {
  return {
    assistant_chief: [],
    policy_holder: [],
    fire_chief: [],
  };
}

export function groupStageMemberIds(
  members: { stage: ApprovalAssignableStage; profile_id: string }[]
): ApprovalStageMemberIndex {
  const grouped = emptyStageMemberIndex();
  for (const member of members) {
    grouped[member.stage].push(member.profile_id);
  }
  return grouped;
}

export function memberIdsForStage(
  index: ApprovalStageMemberIndex,
  stage: ApprovalStage
): string[] {
  if (stage === "special_projects_intake" || stage === "special_projects_review") {
    return index.assistant_chief;
  }
  if (stage === "policy_holder") return index.policy_holder;
  if (stage === "fire_chief") return index.fire_chief;
  return [];
}

export function isWaitingOnApprovalUser(input: {
  userId: string;
  isAdmin?: boolean;
  stage: ApprovalStage;
  createdBy: string;
  stageMemberIds: ApprovalStageMemberIndex;
  committee: ApprovalCommittee | null;
  subcommittee?: ApprovalSubcommittee | null;
  committeeMembers: ApprovalCommitteeMember[];
  votedProfileIds?: string[];
}) {
  if (input.stage === "approved") return false;
  if (input.stage === "creator") return input.createdBy === input.userId;
  if (input.stage === "committee") {
    const body = membersForCommitteeBody(
      input.committeeMembers,
      input.committee,
      input.subcommittee
    );
    const member = body.find((row) => row.profile_id === input.userId);
    if (!member) return false;
    if (member.is_chair) return true;
    return !(input.votedProfileIds ?? []).includes(input.userId);
  }
  return memberIdsForStage(input.stageMemberIds, input.stage).includes(input.userId);
}

export function isApprovalStageActor(input: {
  userId: string;
  isAdmin: boolean;
  stage: ApprovalStage;
  createdBy: string;
  stageMemberIds: ApprovalStageMemberIndex;
  committee: ApprovalCommittee | null;
  subcommittee?: ApprovalSubcommittee | null;
  committeeMembers: ApprovalCommitteeMember[];
}) {
  if (input.isAdmin) return true;
  if (input.stage === "approved") return false;
  if (input.stage === "creator") return input.createdBy === input.userId;
  if (input.stage === "committee") {
    return membersForCommitteeBody(
      input.committeeMembers,
      input.committee,
      input.subcommittee
    ).some((member) => member.profile_id === input.userId);
  }
  return memberIdsForStage(input.stageMemberIds, input.stage).includes(input.userId);
}

export function daysInApprovalStageLabel(stageEnteredAt: string) {
  const entered = new Date(stageEnteredAt).getTime();
  if (Number.isNaN(entered)) return "";
  const days = Math.floor((Date.now() - entered) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function approvalBoardHref(input?: {
  committee?: ApprovalCommittee | "all";
  archived?: boolean;
}) {
  const params = new URLSearchParams();
  if (input?.committee && input.committee !== "all") params.set("committee", input.committee);
  if (input?.archived) params.set("archived", "1");
  const query = params.toString();
  return query ? `/approval-tracker?${query}` : "/approval-tracker";
}
