import { BATTALION_CHIEF_RANK } from "@/lib/personnel-types";
import { formatTime } from "@/lib/dates";

export const UPCOMING_TRAINING_STATUSES = ["draft", "open", "closed", "cancelled"] as const;
export type UpcomingTrainingStatus = (typeof UPCOMING_TRAINING_STATUSES)[number];

export const TRAINING_AUTHORIZATION_LEVELS = ["I", "II", "III", "IV"] as const;
export type TrainingAuthorizationLevel = (typeof TRAINING_AUTHORIZATION_LEVELS)[number];

export type TrainingAuthorizationFieldKey =
  | "time_off"
  | "shift_coverage"
  | "tuition_materials"
  | "transportation"
  | "hotel_flight_per_diem";

export type TrainingAuthorizationField = {
  key: TrainingAuthorizationFieldKey;
  label: string;
  value: string;
  included: boolean;
};

export type TrainingAuthorizationBadge = {
  level: TrainingAuthorizationLevel;
  label: string;
  badgeSrc: string;
  fields: TrainingAuthorizationField[];
};

const AUTHORIZATION_FIELD_LABELS: Record<TrainingAuthorizationFieldKey, string> = {
  time_off: "Time off",
  shift_coverage: "Shift coverage",
  tuition_materials: "Tuition / materials",
  transportation: "Transportation",
  hotel_flight_per_diem: "Hotel / flight / per diem",
};

function authorizationFields(
  values: Record<TrainingAuthorizationFieldKey, { value: string; included: boolean }>
): TrainingAuthorizationField[] {
  return (Object.keys(AUTHORIZATION_FIELD_LABELS) as TrainingAuthorizationFieldKey[]).map(
    (key) => ({
      key,
      label: AUTHORIZATION_FIELD_LABELS[key],
      value: values[key].value,
      included: values[key].included,
    })
  );
}

export const trainingAuthorizationBadges: TrainingAuthorizationBadge[] = [
  {
    level: "I",
    label: "Training Level I",
    badgeSrc: "/training-levels/level-I.png",
    fields: authorizationFields({
      time_off: { value: "Provided", included: true },
      shift_coverage: { value: "Provided", included: true },
      tuition_materials: { value: "Provided or reimbursed", included: true },
      transportation: { value: "Provided or reimbursed", included: true },
      hotel_flight_per_diem: { value: "Provided with advance approval", included: true },
    }),
  },
  {
    level: "II",
    label: "Training Level II",
    badgeSrc: "/training-levels/level-II.png",
    fields: authorizationFields({
      time_off: { value: "Provided if available at approval", included: true },
      shift_coverage: { value: "Not included", included: false },
      tuition_materials: { value: "Provided", included: true },
      transportation: { value: "Provided or reimbursed", included: true },
      hotel_flight_per_diem: { value: "Provided with advance approval", included: true },
    }),
  },
  {
    level: "III",
    label: "Training Level III",
    badgeSrc: "/training-levels/level-III.png",
    fields: authorizationFields({
      time_off: { value: "Not approved", included: false },
      shift_coverage: { value: "Not included", included: false },
      tuition_materials: { value: "Provided", included: true },
      transportation: { value: "Provided or reimbursed", included: true },
      hotel_flight_per_diem: { value: "Provided with advance approval", included: true },
    }),
  },
  {
    level: "IV",
    label: "Training Level IV",
    badgeSrc: "/training-levels/level-IV.png",
    fields: authorizationFields({
      time_off: { value: "Not approved", included: false },
      shift_coverage: { value: "Not included", included: false },
      tuition_materials: { value: "Provided", included: true },
      transportation: { value: "Not provided", included: false },
      hotel_flight_per_diem: { value: "Not provided", included: false },
    }),
  },
];

export function getTrainingAuthorizationBadge(
  level: string | null | undefined
): TrainingAuthorizationBadge | null {
  if (!level) return null;
  return trainingAuthorizationBadges.find((badge) => badge.level === level) ?? null;
}

export function trainingAuthorizationLevelLabel(
  level: TrainingAuthorizationLevel | null | undefined
) {
  const badge = getTrainingAuthorizationBadge(level);
  return badge?.label ?? "None";
}

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
  city: string;
  starts_on: string | null;
  ends_on: string | null;
  start_time: string | null;
  end_time: string | null;
  application_deadline: string | null;
  estimated_cost: number | null;
  external_url: string;
  notes: string;
  status: UpcomingTrainingStatus;
  authorization_level: TrainingAuthorizationLevel | null;
  flyer_file_name: string | null;
  flyer_storage_path: string | null;
  flyer_mime_type: string | null;
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
  "id, client_id, title, description, provider, location, city, starts_on, ends_on, start_time, end_time, application_deadline, estimated_cost, external_url, notes, status, authorization_level, flyer_file_name, flyer_storage_path, flyer_mime_type, created_by, created_at, updated_at";

export const UPCOMING_TRAINING_FLYERS_BUCKET = "upcoming-training-flyers";

const UPCOMING_TRAINING_FLYER_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const UPCOMING_TRAINING_FLYER_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);

export const UPCOMING_TRAINING_FLYER_ACCEPT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
].join(",");

export function isUpcomingTrainingFlyerFile(file: File) {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return (
    UPCOMING_TRAINING_FLYER_MIME_TYPES.has(file.type) ||
    UPCOMING_TRAINING_FLYER_EXTENSIONS.has(ext)
  );
}

export function sanitizeUpcomingTrainingFlyerFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "flyer";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned || "flyer";
}

export function buildUpcomingTrainingFlyerStoragePath(
  upcomingTrainingId: string,
  fileId: string,
  fileName: string
) {
  return `${upcomingTrainingId}/${fileId}/${sanitizeUpcomingTrainingFlyerFileName(fileName)}`;
}

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

export function upcomingTrainingTimeRange(listing: {
  start_time?: string | null;
  end_time?: string | null;
}) {
  const start = listing.start_time ? formatTime(listing.start_time, "") : "";
  const end = listing.end_time ? formatTime(listing.end_time, "") : "";
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return null;
}
