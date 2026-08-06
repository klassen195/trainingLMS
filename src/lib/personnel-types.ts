import type { Profile, UserRole } from "@/lib/training-lms-types";
import { swingUpRanks } from "@/lib/labels";

export type ProfileSummary = {
  id: string;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
};

export type PersonnelLocation = {
  id: string;
  name: string;
};

export type PersonnelShift = "red" | "blue" | "green" | "white";

export const personnelShifts: PersonnelShift[] = ["red", "blue", "green", "white"];

export function personnelShiftLabel(shift: PersonnelShift | null | undefined) {
  if (!shift) return "—";
  return shift.charAt(0).toUpperCase() + shift.slice(1);
}

/** Rank that automatically supervises everyone on the same shift. */
export const BATTALION_CHIEF_RANK = "Battalion Chief";

export function isBattalionChiefRank(rank: string | null | undefined) {
  return rank === BATTALION_CHIEF_RANK;
}

type SupervisorViewer = {
  id: string;
  rank?: string | null;
  shift?: PersonnelShift | null;
};

type SupervisorTarget = {
  id: string;
  supervisor_id?: string | null;
  shift?: PersonnelShift | null;
};

/** Battalion Chiefs supervise everyone else on their assigned shift. */
export function isShiftBattalionChiefOf(viewer: SupervisorViewer, target: SupervisorTarget) {
  if (!isBattalionChiefRank(viewer.rank)) return false;
  if (!viewer.shift || !target.shift) return false;
  if (viewer.id === target.id) return false;
  return viewer.shift === target.shift;
}

/** Assigned captain supervisor OR shift Battalion Chief. */
export function isPersonnelSupervisorOf(viewer: SupervisorViewer, target: SupervisorTarget) {
  return target.supervisor_id === viewer.id || isShiftBattalionChiefOf(viewer, target);
}

export type PersonnelProfile = Profile & {
  employee_number: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  hire_date: string | null;
  shift: PersonnelShift | null;
  home_address: string | null;
  emergency_contacts: string | null;
  hr_info: string | null;
  primary_location_id: string | null;
  supervisor_id: string | null;
  primary_location?: PersonnelLocation | null;
  supervisor?: ProfileSummary | null;
};

export type PersonnelCertification = {
  id: string;
  profile_id: string;
  name: string;
  issuing_authority: string | null;
  issued_on: string | null;
  expires_on: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type PersonnelRecognition = {
  id: string;
  profile_id: string;
  award_id: string;
  awarded_on: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export const PERSONNEL_RECOGNITION_SELECT =
  "id, profile_id, award_id, awarded_on, notes, created_by, created_at";


export type PersonnelDocument = {
  id: string;
  profile_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type PersonnelNote = {
  id: string;
  profile_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  created_by_profile?: ProfileSummary | null;
};

export type PersonnelTaskbookStatus = "requested" | "denied" | "active" | "completed";

export type PersonnelTaskbook = {
  id: string;
  profile_id: string;
  rank: string;
  status: PersonnelTaskbookStatus;
  requested_at: string;
  approved_on: string | null;
  due_on: string | null;
  completed_on: string | null;
  denied_on: string | null;
  denial_reason: string | null;
  notes: string | null;
  requested_by: string | null;
  decided_by: string | null;
  created_at: string;
  profile?: ProfileSummary | null;
};

export type PersonnelTaskbookPrerequisiteCheck = {
  id: string;
  profile_id: string;
  rank: string;
  prerequisite_id: string;
  checked_at: string;
  created_at: string;
};

export const PERSONNEL_TASKBOOK_PREREQ_CHECK_SELECT =
  "id, profile_id, rank, prerequisite_id, checked_at, created_at";


export type PersonnelTrainingModule = {
  module_id: string;
  title: string;
  enrolled_at: string;
  completed_at: string | null;
};

export type PersonnelTrainingProgram = {
  program_id: string;
  title: string;
  status: string;
  modules: PersonnelTrainingModule[];
  enrolled_count: number;
  completed_count: number;
};

export const PROFILE_ORG_SELECT =
  "id, display_name, first_name, last_name, email, rank, swing_up, rank_promoted_on, role, is_admin, is_active, invited_at, created_at, employee_number, job_title, department, phone, hire_date, shift, home_address, emergency_contacts, hr_info, primary_location_id, supervisor_id";

export const PERSONNEL_PROFILE_SELECT = `${PROFILE_ORG_SELECT}, primary_location:locations!primary_location_id(id, name), supervisor:profiles!supervisor_id(id, display_name, first_name, last_name, email)`;

export const PERSONNEL_CERTIFICATION_SELECT =
  "id, profile_id, name, issuing_authority, issued_on, expires_on, notes, created_by, created_at";

export const PERSONNEL_DOCUMENT_SELECT =
  "id, profile_id, title, file_name, storage_path, mime_type, uploaded_by, created_at";

export const PERSONNEL_NOTE_SELECT =
  "id, profile_id, body, created_by, created_at, created_by_profile:profiles!created_by(id, display_name, first_name, last_name, email)";

export const PERSONNEL_TASKBOOK_SELECT =
  "id, profile_id, rank, status, requested_at, approved_on, due_on, completed_on, denied_on, denial_reason, notes, requested_by, decided_by, created_at";

export const PERSONNEL_TASKBOOK_WITH_PROFILE_SELECT = `${PERSONNEL_TASKBOOK_SELECT}, profile:profiles!profile_id(id, display_name, first_name, last_name, email)`;

export const PERSONNEL_DOCUMENTS_BUCKET = "personnel-documents";

export const PERSONNEL_DOCUMENT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx";

const DOC_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOC_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".doc",
  ".docx",
]);

export function isPersonnelDocumentFile(file: File) {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return DOC_MIME_TYPES.has(file.type) || DOC_EXTENSIONS.has(ext);
}

export function sanitizePersonnelFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned || "document";
}

export function buildPersonnelDocumentStoragePath(
  profileId: string,
  documentId: string,
  fileName: string
) {
  return `${profileId}/${documentId}/${sanitizePersonnelFileName(fileName)}`;
}

export function composePersonnelDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
) {
  const composed = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
  return composed || null;
}

export function personnelDisplayName(person: {
  first_name?: string | null;
  last_name?: string | null;
  display_name: string | null;
  email: string | null;
}) {
  return (
    composePersonnelDisplayName(person.first_name, person.last_name) ||
    person.display_name?.trim() ||
    person.email ||
    "Unnamed member"
  );
}

export function isCertExpired(expiresOn: string | null | undefined) {
  if (!expiresOn) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${expiresOn}T00:00:00`) < today;
}

/** Normalize DB/array/string swing-up values into a clean string list. */
export function normalizeSwingUpRanks(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function formatSwingUpRanks(ranks: string[] | null | undefined) {
  const list = normalizeSwingUpRanks(ranks);
  if (list.length === 0) return "—";
  const order = new Map<string, number>(swingUpRanks.map((rank, index) => [rank, index]));
  return [...list]
    .filter((rank) => order.has(rank))
    .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
    .join(", ");
}

/** True during the first year after promotion into the current rank. */
export function isRankOnProbation(rankPromotedOn: string | null | undefined, now = new Date()) {
  if (!rankPromotedOn) return false;
  const start = new Date(`${rankPromotedOn}T00:00:00`);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today >= start && today < end;
}

export function isTaskbookOverdue(taskbook: {
  status: PersonnelTaskbookStatus;
  due_on: string | null;
}, now = new Date()) {
  if (taskbook.status !== "active" || !taskbook.due_on) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return new Date(`${taskbook.due_on}T00:00:00`) < today;
}

/** Human-readable time remaining (or overdue) for an active taskbook due date. */
export function taskbookTimeLeftLabel(dueOn: string | null | undefined, now = new Date()) {
  if (!dueOn) return "—";
  const due = new Date(`${dueOn}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "—";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 1) return `${diffDays} days left`;
  if (diffDays === 1) return "1 day left";
  if (diffDays === 0) return "Due today";
  if (diffDays === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(diffDays)} days`;
}

export function taskbookStatusLabel(taskbook: {
  status: PersonnelTaskbookStatus;
  due_on: string | null;
}) {
  if (taskbook.status === "requested") return "Requested";
  if (taskbook.status === "denied") return "Denied";
  if (taskbook.status === "completed") return "Completed";
  if (isTaskbookOverdue(taskbook)) return "Overdue";
  return "In progress";
}

export function addYearsToDate(isoDate: string, years: number) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatTrainingHours(hours: number) {
  if (!Number.isFinite(hours) || hours === 0) return "0";
  const rounded = Math.round(hours * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

export const permissionLevels: UserRole[] = ["recruit", "firefighter", "captain"];
