import type { Profile, UserRole } from "@/lib/training-lms-types";

export type ProfileSummary = {
  id: string;
  display_name: string | null;
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
  "id, display_name, email, rank, role, is_admin, created_at, employee_number, job_title, department, phone, hire_date, shift, home_address, emergency_contacts, hr_info, primary_location_id, supervisor_id";

export const PERSONNEL_PROFILE_SELECT = `${PROFILE_ORG_SELECT}, primary_location:locations!primary_location_id(id, name), supervisor:profiles!supervisor_id(id, display_name, email)`;

export const PERSONNEL_CERTIFICATION_SELECT =
  "id, profile_id, name, issuing_authority, issued_on, expires_on, notes, created_by, created_at";

export const PERSONNEL_DOCUMENT_SELECT =
  "id, profile_id, title, file_name, storage_path, mime_type, uploaded_by, created_at";

export const PERSONNEL_NOTE_SELECT =
  "id, profile_id, body, created_by, created_at, created_by_profile:profiles!created_by(id, display_name, email)";

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

export function personnelDisplayName(person: {
  display_name: string | null;
  email: string | null;
}) {
  return person.display_name?.trim() || person.email || "Unnamed member";
}

export function isCertExpired(expiresOn: string | null | undefined) {
  if (!expiresOn) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${expiresOn}T00:00:00`) < today;
}

export const permissionLevels: UserRole[] = ["recruit", "firefighter", "captain"];
