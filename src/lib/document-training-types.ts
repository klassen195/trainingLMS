import type { PersonnelShift } from "@/lib/personnel-types";
import { formatDate } from "@/lib/dates";

export type TrainingSessionType = "in_house" | "certification_course";

export type TrainingSession = {
  id: string;
  session_type: TrainingSessionType;
  category_id: string;
  title: string;
  hours: number | null;
  location: string | null;
  notes: string | null;
  occurred_on: string | null;
  instructor_name: string | null;
  provider: string | null;
  started_on: string | null;
  ended_on: string | null;
  expires_on: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingSessionCategory = {
  id: string;
  name: string;
};

export type TrainingSessionAttendee = {
  session_id: string;
  profile_id: string;
  created_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    email: string | null;
  } | null;
};

export type TrainingSessionFile = {
  id: string;
  session_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type TrainingSessionRecorder = {
  id: string;
  display_name: string | null;
  email: string | null;
};

export type TrainingSessionListItem = TrainingSession & {
  attendee_count: number;
  recorder?: TrainingSessionRecorder | null;
  category?: TrainingSessionCategory | null;
};

export type TrainingSessionDetail = TrainingSession & {
  recorder?: TrainingSessionRecorder | null;
  category?: TrainingSessionCategory | null;
  attendees: TrainingSessionAttendee[];
  files: TrainingSessionFile[];
};

export type TrainingSessionProfileOption = {
  id: string;
  display_name: string | null;
  email: string | null;
  shift: PersonnelShift | null;
  primary_location_id: string | null;
  primary_location?: { id: string; name: string } | null;
};

export const TRAINING_SESSION_SELECT =
  "id, session_type, category_id, title, hours, location, notes, occurred_on, instructor_name, provider, started_on, ended_on, expires_on, recorded_by, created_at, updated_at";

export const TRAINING_SESSION_WITH_RECORDER_SELECT = `${TRAINING_SESSION_SELECT}, recorder:profiles!recorded_by(id, display_name, email), category:training_categories!category_id(id, name)`;

export const TRAINING_SESSION_FILES_BUCKET = "training-session-files";

export const TRAINING_SESSION_FILE_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";

const FILE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const FILE_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);

export function isTrainingSessionFile(file: File) {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return FILE_MIME_TYPES.has(file.type) || FILE_EXTENSIONS.has(ext);
}

export function sanitizeTrainingSessionFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned || "document";
}

export function buildTrainingSessionFileStoragePath(
  sessionId: string,
  fileId: string,
  fileName: string
) {
  return `${sessionId}/${fileId}/${sanitizeTrainingSessionFileName(fileName)}`;
}

export function trainingSessionTypeLabel(type: TrainingSessionType) {
  return type === "in_house" ? "In-house training" : "Certification course";
}

export function trainingSessionDisplayDate(session: {
  session_type: TrainingSessionType;
  occurred_on: string | null;
  started_on: string | null;
  ended_on: string | null;
}) {
  if (session.session_type === "in_house") {
    return session.occurred_on ? formatDate(session.occurred_on) : null;
  }
  if (session.started_on && session.ended_on && session.started_on !== session.ended_on) {
    return `${formatDate(session.started_on)} – ${formatDate(session.ended_on)}`;
  }
  const single = session.started_on ?? session.ended_on ?? null;
  return single ? formatDate(single) : null;
}
