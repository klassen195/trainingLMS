import { BATTALION_CHIEF_RANK } from "@/lib/personnel-types";

export const UPCOMING_TRAINING_STATUSES = ["draft", "open", "closed", "cancelled"] as const;
export type UpcomingTrainingStatus = (typeof UPCOMING_TRAINING_STATUSES)[number];

export const TRAINING_ATTENDANCE_STAGES = [
  "pending_captain",
  "pending_bc",
  "pending_ops",
  "approved",
  "denied",
  "withdrawn",
] as const;
export type TrainingAttendanceStage = (typeof TRAINING_ATTENDANCE_STAGES)[number];

export const TRAINING_ATTENDANCE_PENDING_STAGES = [
  "pending_captain",
  "pending_bc",
  "pending_ops",
] as const satisfies readonly TrainingAttendanceStage[];
export type TrainingAttendancePendingStage =
  (typeof TRAINING_ATTENDANCE_PENDING_STAGES)[number];

export type UpcomingTraining = {
  id: string;
  client_id: string;
  title: string;
  description: string;
  provider: string;
  location: string;
  starts_on: string | null;
  ends_on: string | null;
  application_deadline: string | null;
  estimated_cost: number | null;
  external_url: string;
  notes: string;
  status: UpcomingTrainingStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UpcomingTrainingListItem = UpcomingTraining & {
  created_by_profile?: {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export type TrainingAttendanceRequest = {
  id: string;
  client_id: string;
  applicant_id: string;
  upcoming_training_id: string | null;
  title: string;
  description: string;
  provider: string;
  location: string;
  starts_on: string | null;
  ends_on: string | null;
  estimated_cost: number | null;
  justification: string;
  current_stage: TrainingAttendanceStage;
  denial_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingAttendanceProfileSummary = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  rank: string | null;
  shift: string | null;
  supervisor_id: string | null;
};

export type TrainingAttendanceRequestListItem = TrainingAttendanceRequest & {
  applicant?: TrainingAttendanceProfileSummary | null;
  decided_by_profile?: {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  upcoming_training?: Pick<UpcomingTraining, "id" | "title" | "status"> | null;
};

export type TrainingAttendanceRequestEvent = {
  id: string;
  client_id: string;
  request_id: string;
  from_stage: string | null;
  to_stage: string | null;
  action: string;
  comment: string | null;
  acted_by: string | null;
  created_at: string;
  acted_by_profile?: {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export type TrainingAttendanceRequestDetail = TrainingAttendanceRequestListItem & {
  events: TrainingAttendanceRequestEvent[];
};

export type UpcomingTrainingOpsMember = {
  id: string;
  client_id: string;
  profile_id: string;
  created_at: string;
};

export const UPCOMING_TRAINING_SELECT =
  "id, client_id, title, description, provider, location, starts_on, ends_on, application_deadline, estimated_cost, external_url, notes, status, created_by, created_at, updated_at";

export const UPCOMING_TRAINING_LIST_SELECT = `${UPCOMING_TRAINING_SELECT}, created_by_profile:profiles!upcoming_trainings_created_by_fkey(id, display_name, first_name, last_name)`;

export const TRAINING_ATTENDANCE_REQUEST_SELECT =
  "id, client_id, applicant_id, upcoming_training_id, title, description, provider, location, starts_on, ends_on, estimated_cost, justification, current_stage, denial_reason, decided_by, decided_at, created_at, updated_at";

export const TRAINING_ATTENDANCE_REQUEST_LIST_SELECT = `${TRAINING_ATTENDANCE_REQUEST_SELECT}, applicant:profiles!training_attendance_requests_applicant_id_fkey(id, display_name, first_name, last_name, email, rank, shift, supervisor_id), decided_by_profile:profiles!training_attendance_requests_decided_by_fkey(id, display_name, first_name, last_name), upcoming_training:upcoming_trainings(id, title, status)`;

export const TRAINING_ATTENDANCE_EVENT_SELECT =
  "id, client_id, request_id, from_stage, to_stage, action, comment, acted_by, created_at, acted_by_profile:profiles!training_attendance_request_events_acted_by_fkey(id, display_name, first_name, last_name)";

export const UPCOMING_TRAINING_OPS_MEMBER_SELECT = "id, client_id, profile_id, created_at";

export function upcomingTrainingStatusLabel(status: UpcomingTrainingStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "cancelled":
      return "Cancelled";
  }
}

export function trainingAttendanceStageLabel(stage: TrainingAttendanceStage) {
  switch (stage) {
    case "pending_captain":
      return "Pending captain";
    case "pending_bc":
      return "Pending battalion chief";
    case "pending_ops":
      return "Pending Ops Team";
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "withdrawn":
      return "Withdrawn";
  }
}

export function isTrainingAttendancePending(
  stage: TrainingAttendanceStage
): stage is TrainingAttendancePendingStage {
  return (TRAINING_ATTENDANCE_PENDING_STAGES as readonly string[]).includes(stage);
}

export function initialStageForApplicant(
  rank: string | null | undefined
): TrainingAttendancePendingStage {
  if (rank === BATTALION_CHIEF_RANK) return "pending_ops";
  if (rank === "Captain") return "pending_bc";
  return "pending_captain";
}

export function nextStageAfterApproval(
  stage: TrainingAttendancePendingStage
): TrainingAttendanceStage {
  switch (stage) {
    case "pending_captain":
      return "pending_bc";
    case "pending_bc":
      return "pending_ops";
    case "pending_ops":
      return "approved";
  }
}

export function formatEstimatedCost(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
