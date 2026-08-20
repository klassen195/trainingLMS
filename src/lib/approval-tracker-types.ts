import type { PersonnelShift } from "@/lib/personnel-types";

export const APPROVAL_DOC_TYPES = ["policy", "best_practice", "training_aid"] as const;
export type ApprovalDocType = (typeof APPROVAL_DOC_TYPES)[number];

export const APPROVAL_TRACKS = ["training", "ems"] as const;
export type ApprovalTrack = (typeof APPROVAL_TRACKS)[number];

export const APPROVAL_STAGES = [
  "creator",
  "working_committee",
  "assistant_chief",
  "policy_holder",
  "fire_chief",
  "approved",
] as const;
export type ApprovalStage = (typeof APPROVAL_STAGES)[number];

export const APPROVAL_ASSIGNABLE_STAGES = [
  "working_committee",
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
] as const;
export type ApprovalEventAction = (typeof APPROVAL_EVENT_ACTIONS)[number];

export type ApprovalAssignmentSlot = {
  key: string;
  stage: ApprovalAssignableStage;
  track: ApprovalTrack | null;
  label: string;
};

export const APPROVAL_ASSIGNMENT_SLOTS: ApprovalAssignmentSlot[] = [
  {
    key: "working_committee:training",
    stage: "working_committee",
    track: "training",
    label: "Working committee — Training",
  },
  {
    key: "working_committee:ems",
    stage: "working_committee",
    track: "ems",
    label: "Working committee — EMS",
  },
  {
    key: "assistant_chief:training",
    stage: "assistant_chief",
    track: "training",
    label: "Assistant chief — Training",
  },
  {
    key: "assistant_chief:ems",
    stage: "assistant_chief",
    track: "ems",
    label: "Assistant chief — EMS",
  },
  {
    key: "policy_holder",
    stage: "policy_holder",
    track: null,
    label: "Policy holder group",
  },
  {
    key: "fire_chief",
    stage: "fire_chief",
    track: null,
    label: "Fire Chief",
  },
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

export type ApprovalDocument = {
  id: string;
  title: string;
  doc_type: ApprovalDocType;
  track: ApprovalTrack;
  current_stage: ApprovalStage;
  notes: string | null;
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
  track: ApprovalTrack | null;
  profile_id: string;
  profile?: ApprovalProfileSummary | null;
};

export type ApprovalStageMemberIndex = {
  working_committee: Record<ApprovalTrack, string[]>;
  assistant_chief: Record<ApprovalTrack, string[]>;
  policy_holder: string[];
  fire_chief: string[];
};

export const APPROVAL_DOCUMENT_SELECT =
  "id, title, doc_type, track, current_stage, notes, created_by, stage_entered_at, archived_at, created_at, updated_at";

export const APPROVAL_DOCUMENT_LIST_SELECT = `${APPROVAL_DOCUMENT_SELECT}, creator:profiles!created_by(id, display_name, first_name, last_name, email)`;

export const APPROVAL_EVENT_SELECT =
  "id, document_id, from_stage, to_stage, action, comment, acted_by, created_at, actor:profiles!acted_by(id, display_name, first_name, last_name, email)";

export const APPROVAL_STAGE_MEMBER_SELECT =
  "id, stage, track, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, email)";

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

export function approvalTrackLabel(track: ApprovalTrack) {
  return track === "ems" ? "EMS" : "Training";
}

export function approvalStageLabel(stage: ApprovalStage) {
  switch (stage) {
    case "creator":
      return "Document creator";
    case "working_committee":
      return "Working committee";
    case "assistant_chief":
      return "Assistant chief";
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
    case "working_committee":
      return "Working";
    case "assistant_chief":
      return "Asst. chief";
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

export function emptyStageMemberIndex(): ApprovalStageMemberIndex {
  return {
    working_committee: { training: [], ems: [] },
    assistant_chief: { training: [], ems: [] },
    policy_holder: [],
    fire_chief: [],
  };
}

export function groupStageMemberIds(
  members: { stage: ApprovalAssignableStage; track?: ApprovalTrack | null; profile_id: string }[]
): ApprovalStageMemberIndex {
  const grouped = emptyStageMemberIndex();
  for (const member of members) {
    if (member.stage === "fire_chief" || member.stage === "policy_holder") {
      grouped[member.stage].push(member.profile_id);
      continue;
    }
    if (member.track === "training" || member.track === "ems") {
      grouped[member.stage][member.track].push(member.profile_id);
    }
  }
  return grouped;
}

export function memberIdsForStage(
  index: ApprovalStageMemberIndex,
  stage: ApprovalStage,
  track: ApprovalTrack
): string[] {
  if (stage === "working_committee" || stage === "assistant_chief") {
    return index[stage][track];
  }
  if (stage === "policy_holder") return index.policy_holder;
  if (stage === "fire_chief") return index.fire_chief;
  return [];
}

export function isWaitingOnApprovalUser(input: {
  userId: string;
  stage: ApprovalStage;
  track: ApprovalTrack;
  createdBy: string;
  stageMemberIds: ApprovalStageMemberIndex;
}) {
  if (input.stage === "approved") return false;
  if (input.stage === "creator") return input.createdBy === input.userId;
  return memberIdsForStage(input.stageMemberIds, input.stage, input.track).includes(input.userId);
}

export function isApprovalStageActor(input: {
  userId: string;
  isAdmin: boolean;
  stage: ApprovalStage;
  track: ApprovalTrack;
  createdBy: string;
  stageMemberIds: ApprovalStageMemberIndex;
}) {
  if (input.isAdmin) return true;
  return isWaitingOnApprovalUser(input);
}

export function daysInApprovalStageLabel(stageEnteredAt: string) {
  const entered = new Date(stageEnteredAt).getTime();
  if (Number.isNaN(entered)) return "";
  const days = Math.floor((Date.now() - entered) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function approvalBoardHref(input?: { track?: ApprovalTrack | "all"; archived?: boolean }) {
  const params = new URLSearchParams();
  if (input?.track && input.track !== "all") params.set("track", input.track);
  if (input?.archived) params.set("archived", "1");
  const query = params.toString();
  return query ? `/approval-tracker?${query}` : "/approval-tracker";
}
