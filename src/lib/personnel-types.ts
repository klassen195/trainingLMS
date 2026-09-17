import type { Profile } from "@/lib/training-lms-types";
import {
  formatPersonnelRankDisplay,
  isTitleOnlyRank,
  rankHasTitle,
  ranksWithoutProbation,
  swingUpRanks,
} from "@/lib/labels";
import { PROFILE_PERMISSION_LEVELS_EMBED } from "@/lib/permission-levels-types";

export { formatPersonnelRankDisplay, isTitleOnlyRank, rankHasTitle };

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
  anniversary: string | null;
  spouse_name: string | null;
  spouse_birthday: string | null;
  kids_birthdays: string | null;
  primary_location_id: string | null;
  supervisor_id: string | null;
  ems_cleared_level_id: string | null;
  primary_location?: PersonnelLocation | null;
  supervisor?: ProfileSummary | null;
  ems_cleared_level?: { id: string; name: string } | null;
};

export type PersonnelCertification = {
  id: string;
  profile_id: string;
  name: string;
  issuing_authority: string | null;
  issued_on: string | null;
  expires_on: string | null;
  notes: string | null;
  file_name: string | null;
  storage_path: string | null;
  mime_type: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  /** Signed URL for thumbnail/preview; populated when loading a personnel file. */
  preview_url?: string | null;
};

export type PersonnelCertificationSection = {
  id: string;
  profile_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type PersonnelCertificationLayoutItem =
  | { kind: "section"; id: string; section: PersonnelCertificationSection }
  | { kind: "cert"; id: string; cert: PersonnelCertification };

export function certificationLayoutSortOrder(item: PersonnelCertificationLayoutItem) {
  return item.kind === "section" ? item.section.sort_order : item.cert.sort_order;
}

export function buildPersonnelCertificationLayout(
  certifications: PersonnelCertification[],
  sections: PersonnelCertificationSection[]
): PersonnelCertificationLayoutItem[] {
  const items: PersonnelCertificationLayoutItem[] = [
    ...sections.map((section) => ({ kind: "section" as const, id: section.id, section })),
    ...certifications.map((cert) => ({ kind: "cert" as const, id: cert.id, cert })),
  ];
  items.sort((a, b) => {
    const order = certificationLayoutSortOrder(a) - certificationLayoutSortOrder(b);
    if (order !== 0) return order;
    if (a.kind !== b.kind) return a.kind === "section" ? -1 : 1;
    const nameA = a.kind === "section" ? a.section.name : a.cert.name;
    const nameB = b.kind === "section" ? b.section.name : b.cert.name;
    return nameA.localeCompare(nameB);
  });
  return items;
}

/** Section header plus the certifications that follow it until the next section. */
export function certificationLayoutSectionRange(
  items: PersonnelCertificationLayoutItem[],
  sectionIndex: number
): { start: number; end: number } {
  if (sectionIndex < 0 || items[sectionIndex]?.kind !== "section") {
    return { start: sectionIndex, end: sectionIndex };
  }
  let end = sectionIndex + 1;
  while (end < items.length && items[end].kind !== "section") {
    end += 1;
  }
  return { start: sectionIndex, end };
}

export function groupPersonnelCertificationLayout(items: PersonnelCertificationLayoutItem[]): {
  ungrouped: PersonnelCertification[];
  folders: { section: PersonnelCertificationSection; certs: PersonnelCertification[] }[];
} {
  const ungrouped: PersonnelCertification[] = [];
  const folders: { section: PersonnelCertificationSection; certs: PersonnelCertification[] }[] = [];
  let current: (typeof folders)[number] | null = null;

  for (const item of items) {
    if (item.kind === "section") {
      current = { section: item.section, certs: [] };
      folders.push(current);
      continue;
    }
    if (current) current.certs.push(item.cert);
    else ungrouped.push(item.cert);
  }

  return { ungrouped, folders };
}

function layoutItemIndex(items: PersonnelCertificationLayoutItem[], id: string) {
  return items.findIndex((item) => item.id === id);
}

/** Nearest section break above this row, if any. */
export function containingCertificationSectionId(
  items: PersonnelCertificationLayoutItem[],
  itemIndex: number
): string | null {
  for (let i = itemIndex; i >= 0; i -= 1) {
    if (items[i].kind === "section") return items[i].id;
  }
  return null;
}

/** Folder id for a row, or "ungrouped" for certs above the first section. */
export function certificationLayoutContainerId(
  items: PersonnelCertificationLayoutItem[],
  id: string
): string {
  const index = layoutItemIndex(items, id);
  if (index < 0) return "ungrouped";
  if (items[index].kind === "section") return items[index].id;
  return containingCertificationSectionId(items, index) ?? "ungrouped";
}

export function certificationLayoutOrderKey(items: PersonnelCertificationLayoutItem[]) {
  return items.map((item) => item.id).join(",");
}

/**
 * Reorder a certification layout. Section breaks move as folders: the header and
 * every certification beneath it until the next section stay together.
 */
export function movePersonnelCertificationLayout(
  items: PersonnelCertificationLayoutItem[],
  activeId: string,
  overId: string
): PersonnelCertificationLayoutItem[] {
  if (activeId === overId) return items;
  const from = layoutItemIndex(items, activeId);
  const to = layoutItemIndex(items, overId);
  if (from < 0 || to < 0) return items;

  const active = items[from];
  if (active.kind === "cert") {
    if (items[to].kind === "section") {
      const without = items.filter((item) => item.id !== activeId);
      const sectionIndex = layoutItemIndex(without, overId);
      if (sectionIndex < 0) return items;
      return [
        ...without.slice(0, sectionIndex + 1),
        active,
        ...without.slice(sectionIndex + 1),
      ];
    }
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  const { start, end } = certificationLayoutSectionRange(items, from);
  if (to >= start && to < end) return items;

  const block = items.slice(start, end);
  const rest = [...items.slice(0, start), ...items.slice(end)];
  const overSectionId = containingCertificationSectionId(items, to);
  const targetId = overSectionId && overSectionId !== activeId ? overSectionId : overId;
  const targetIndexInRest = layoutItemIndex(rest, targetId);
  if (targetIndexInRest < 0) return items;

  const target = rest[targetIndexInRest];
  // Keep ungrouped certs (those above the first section) outside folders.
  if (target.kind !== "section") return items;

  const insertAt =
    from < to
      ? certificationLayoutSectionRange(rest, targetIndexInRest).end
      : targetIndexInRest;
  return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
}

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

export type PersonnelQualification = {
  id: string;
  profile_id: string;
  qualification_id: string;
  earned_on: string | null;
  expires_on: string | null;
  notes: string | null;
  source_session_id: string | null;
  created_by: string | null;
  created_at: string;
  qualification?: { id: string; name: string } | null;
};

export const PERSONNEL_QUALIFICATION_SELECT =
  "id, profile_id, qualification_id, earned_on, expires_on, notes, source_session_id, created_by, created_at, qualification:qualifications!qualification_id(id, name)";

export type PersonnelEmsLicense = {
  id: string;
  profile_id: string;
  ems_level_id: string;
  issued_on: string | null;
  expires_on: string | null;
  license_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  ems_level?: { id: string; name: string } | null;
};

export const PERSONNEL_EMS_LICENSE_SELECT =
  "id, profile_id, ems_level_id, issued_on, expires_on, license_number, notes, created_by, created_at, ems_level:ems_levels!ems_level_id(id, name)";

export const EMS_CLEARANCE_NOT_SET_LABEL = "Not set";

export type PersonnelEmsClearanceLogEntry = {
  id: string;
  profile_id: string;
  clearance_level_id: string | null;
  clearance_level_name: string;
  previous_clearance_level_name: string | null;
  granted_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_profile?: ProfileSummary | null;
};

export const PERSONNEL_EMS_CLEARANCE_LOG_SELECT =
  "id, profile_id, clearance_level_id, clearance_level_name, previous_clearance_level_name, granted_on, notes, created_by, created_at, updated_at, created_by_profile:profiles!created_by(id, display_name, first_name, last_name, email)";

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

export const PROFILE_ORG_COLUMNS =
  "id, display_name, first_name, last_name, email, rank, swing_up, rank_promoted_on, is_admin, is_platform_operator, is_active, invited_at, created_at, employee_number, job_title, department, phone, hire_date, shift, home_address, emergency_contacts, hr_info, anniversary, spouse_name, spouse_birthday, kids_birthdays, primary_location_id, supervisor_id, ems_cleared_level_id";

export const PROFILE_ORG_SELECT = `${PROFILE_ORG_COLUMNS}, ${PROFILE_PERMISSION_LEVELS_EMBED}`;

// Use the FK constraint name — `profiles!supervisor_id` is ambiguous on self-joins
// and can resolve as "reports" (empty) instead of the assigned supervisor.
export const PERSONNEL_PROFILE_SELECT = `${PROFILE_ORG_SELECT}, primary_location:locations!profiles_primary_location_id_fkey(id, name), supervisor:profiles!profiles_supervisor_id_fkey(id, display_name, first_name, last_name, email), ems_cleared_level:ems_clearance_levels!profiles_ems_cleared_level_id_fkey(id, name)`;

export const PERSONNEL_CERTIFICATION_SELECT =
  "id, profile_id, name, issuing_authority, issued_on, expires_on, notes, file_name, storage_path, mime_type, sort_order, created_by, created_at";

export const PERSONNEL_CERTIFICATION_SECTION_SELECT =
  "id, profile_id, name, sort_order, created_at";

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

export function personnelFileExtension(fileName: string | null | undefined) {
  const name = fileName?.toLowerCase() ?? "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : "";
}

const PREVIEWABLE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const PREVIEWABLE_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
]);

export type PersonnelFilePreviewKind = "image" | "pdf" | "file";

export function personnelFilePreviewKind(
  mimeType: string | null | undefined,
  fileName: string | null | undefined
): PersonnelFilePreviewKind {
  const mime = mimeType?.toLowerCase() ?? "";
  const ext = personnelFileExtension(fileName);
  if (PREVIEWABLE_IMAGE_MIME_TYPES.has(mime) || PREVIEWABLE_IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === ".pdf") return "pdf";
  return "file";
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

/** Same path layout as documents so existing storage RLS applies. */
export function buildPersonnelCertificationStoragePath(
  profileId: string,
  certificationId: string,
  fileName: string
) {
  return buildPersonnelDocumentStoragePath(profileId, certificationId, fileName);
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

/** Sort key: last name, then first name, then display fallback. */
export function comparePersonnelByName(
  a: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    email?: string | null;
  },
  b: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    email?: string | null;
  }
) {
  const opts = { sensitivity: "base" as const };
  const lastCmp = (a.last_name?.trim() || "").localeCompare(b.last_name?.trim() || "", undefined, opts);
  if (lastCmp !== 0) return lastCmp;
  const firstCmp = (a.first_name?.trim() || "").localeCompare(
    b.first_name?.trim() || "",
    undefined,
    opts
  );
  if (firstCmp !== 0) return firstCmp;
  return personnelDisplayName({
    first_name: a.first_name,
    last_name: a.last_name,
    display_name: a.display_name ?? null,
    email: a.email ?? null,
  }).localeCompare(
    personnelDisplayName({
      first_name: b.first_name,
      last_name: b.last_name,
      display_name: b.display_name ?? null,
      email: b.email ?? null,
    }),
    undefined,
    opts
  );
}

export function isCertExpired(expiresOn: string | null | undefined) {
  if (!expiresOn) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${expiresOn}T00:00:00`) < today;
}

/** Whole days from local today until a calendar date (`YYYY-MM-DD`). Negative if past. */
export function daysUntilExpiry(expiresOn: string, now = new Date()) {
  const today = startOfLocalDay(now);
  const target = new Date(`${expiresOn}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export type ExpiringPersonnelItemKind = "certification" | "ems_license" | "qualification";

export type ExpiringPersonnelItem = {
  id: string;
  kind: ExpiringPersonnelItemKind;
  label: string;
  expiresOn: string;
  /** Negative when already expired */
  daysUntil: number;
  sectionId: "certifications" | "ems" | "qualifications";
};

export function expiringItemKindLabel(kind: ExpiringPersonnelItemKind) {
  if (kind === "certification") return "Certification";
  if (kind === "ems_license") return "EMS license";
  return "Qualification";
}

/**
 * Certifications, EMS licenses, and qualifications that are already expired
 * or expire within the next `withinMonths` months (default 6).
 */
export function collectExpiringPersonnelItems(
  input: {
    certifications?: { id: string; name: string; expires_on: string | null }[];
    emsLicenses?: {
      id: string;
      expires_on: string | null;
      ems_level?: { name: string } | null;
    }[];
    qualifications?: {
      id: string;
      expires_on: string | null;
      qualification?: { name: string } | null;
    }[];
  },
  options?: { withinMonths?: number; now?: Date }
): ExpiringPersonnelItem[] {
  const withinMonths = options?.withinMonths ?? 6;
  const now = options?.now ?? new Date();
  const today = startOfLocalDay(now);
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + withinMonths);

  const items: ExpiringPersonnelItem[] = [];

  for (const cert of input.certifications ?? []) {
    if (!cert.expires_on) continue;
    const daysUntil = daysUntilExpiry(cert.expires_on, now);
    if (daysUntil == null) continue;
    const expiresAt = new Date(`${cert.expires_on}T00:00:00`);
    if (expiresAt > horizon) continue;
    items.push({
      id: cert.id,
      kind: "certification",
      label: cert.name.trim() || "Certification",
      expiresOn: cert.expires_on,
      daysUntil,
      sectionId: "certifications",
    });
  }

  for (const license of input.emsLicenses ?? []) {
    if (!license.expires_on) continue;
    const daysUntil = daysUntilExpiry(license.expires_on, now);
    if (daysUntil == null) continue;
    const expiresAt = new Date(`${license.expires_on}T00:00:00`);
    if (expiresAt > horizon) continue;
    items.push({
      id: license.id,
      kind: "ems_license",
      label: license.ems_level?.name?.trim() || "EMS license",
      expiresOn: license.expires_on,
      daysUntil,
      sectionId: "ems",
    });
  }

  for (const row of input.qualifications ?? []) {
    if (!row.expires_on) continue;
    const daysUntil = daysUntilExpiry(row.expires_on, now);
    if (daysUntil == null) continue;
    const expiresAt = new Date(`${row.expires_on}T00:00:00`);
    if (expiresAt > horizon) continue;
    items.push({
      id: row.id,
      kind: "qualification",
      label: row.qualification?.name?.trim() || "Qualification",
      expiresOn: row.expires_on,
      daysUntil,
      sectionId: "qualifications",
    });
  }

  return items.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil ||
      a.expiresOn.localeCompare(b.expiresOn) ||
      a.label.localeCompare(b.label)
  );
}

export function expiringWhenLabel(daysUntil: number) {
  if (daysUntil < 0) {
    const ago = Math.abs(daysUntil);
    if (ago === 1) return "Expired yesterday";
    if (ago >= 365) return "Expired";
    return `Expired ${ago} days ago`;
  }
  if (daysUntil === 0) return "Expires today";
  if (daysUntil === 1) return "Expires tomorrow";
  return `Expires in ${daysUntil} days`;
}

export type FamilyDateEntry = {
  role: "spouse" | "anniversary" | "kid";
  /** Kid name when known */
  name: string | null;
  event: "birthday" | "anniversary";
  /** Original date string for display when available */
  date: string | null;
};

export type UpcomingFamilyDate = FamilyDateEntry & {
  daysUntil: number;
  /** Next occurrence as YYYY-MM-DD */
  nextOn: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function startOfLocalDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseMonthDay(value: string | null | undefined): { month: number; day: number } | null {
  if (!value) return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
    return null;
  }
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    // App displays MM/DD/YYYY
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }
  return null;
}

function nextOccurrenceWithinDays(
  month: number,
  day: number,
  from: Date,
  withinDays: number
): { daysUntil: number; nextOn: string } | null {
  const today = startOfLocalDay(from);
  for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
    const year = today.getFullYear() + yearOffset;
    // Feb 29 → Feb 28 in non-leap years
    const candidateDay =
      month === 2 && day === 29
        ? new Date(year, 1, 29).getMonth() === 1
          ? 29
          : 28
        : day;
    const candidate = new Date(year, month - 1, candidateDay);
    if (candidate.getMonth() !== month - 1) continue;
    const daysUntil = Math.round((candidate.getTime() - today.getTime()) / 86_400_000);
    if (daysUntil >= 0 && daysUntil <= withinDays) {
      return {
        daysUntil,
        nextOn: `${candidate.getFullYear()}-${pad2(candidate.getMonth() + 1)}-${pad2(candidate.getDate())}`,
      };
    }
  }
  return null;
}

function parseKidsBirthdayLines(
  text: string | null | undefined
): { name: string | null; month: number | null; day: number | null; date: string | null }[] {
  if (!text?.trim()) return [];
  const rows: {
    name: string | null;
    month: number | null;
    day: number | null;
    date: string | null;
  }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const isoInLine = line.match(/(\d{4}-\d{2}-\d{2})/);
    const slashInLine = line.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    const dateToken = isoInLine?.[1] ?? slashInLine?.[1] ?? null;
    const md = parseMonthDay(dateToken);

    let name: string | null = line;
    if (dateToken) {
      name =
        line
          .replace(dateToken, "")
          .replace(/[—–\-:,|/]+/g, " ")
          .replace(/\s+/g, " ")
          .trim() || null;
    }
    if (!name && !dateToken) continue;
    rows.push({
      name,
      month: md?.month ?? null,
      day: md?.day ?? null,
      date: dateToken,
    });
  }
  return rows;
}

export type FamilyKidInput = {
  name: string;
  birthday: string;
};

/** Parse kids_birthdays text into editable name + birthday rows. */
export function parseFamilyKids(text: string | null | undefined): FamilyKidInput[] {
  return parseKidsBirthdayLines(text).map((row) => ({
    name: row.name ?? "",
    birthday: row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : "",
  }));
}

/** Serialize kid rows back to kids_birthdays text storage. */
export function serializeFamilyKids(kids: FamilyKidInput[]): string | null {
  const lines = kids
    .map((kid) => {
      const name = kid.name.trim();
      const birthday = kid.birthday.trim();
      if (!name && !birthday) return null;
      if (name && birthday) return `${name} — ${birthday}`;
      return name || birthday;
    })
    .filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines.join("\n") : null;
}

/** All recorded family entries for demographics display. */
export function listFamilyDates(person: {
  anniversary?: string | null;
  spouse_name?: string | null;
  spouse_birthday?: string | null;
  kids_birthdays?: string | null;
}): FamilyDateEntry[] {
  const rows: FamilyDateEntry[] = [];
  const spouseName = person.spouse_name?.trim() || null;
  const spouseBirthday = person.spouse_birthday?.trim() || null;

  if (spouseName || spouseBirthday) {
    rows.push({
      role: "spouse",
      name: spouseName,
      event: "birthday",
      date: spouseBirthday,
    });
  }
  if (person.anniversary?.trim()) {
    rows.push({
      role: "anniversary",
      name: null,
      event: "anniversary",
      date: person.anniversary.trim(),
    });
  }
  for (const kid of parseKidsBirthdayLines(person.kids_birthdays)) {
    rows.push({
      role: "kid",
      name: kid.name,
      event: "birthday",
      date: kid.date,
    });
  }

  return rows;
}

/** Family dates whose next occurrence falls within the coming month (default 30 days). */
export function upcomingFamilyDates(
  person: {
    anniversary?: string | null;
    spouse_name?: string | null;
    spouse_birthday?: string | null;
    kids_birthdays?: string | null;
  },
  options?: { withinDays?: number; now?: Date }
): UpcomingFamilyDate[] {
  const withinDays = options?.withinDays ?? 30;
  const now = options?.now ?? new Date();
  const upcoming: UpcomingFamilyDate[] = [];

  for (const entry of listFamilyDates(person)) {
    const md = parseMonthDay(entry.date);
    if (!md) continue;
    const next = nextOccurrenceWithinDays(md.month, md.day, now, withinDays);
    if (!next) continue;
    upcoming.push({
      ...entry,
      daysUntil: next.daysUntil,
      nextOn: next.nextOn,
    });
  }

  const roleOrder = { spouse: 0, anniversary: 1, kid: 2 } as const;
  return upcoming.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil ||
      roleOrder[a.role] - roleOrder[b.role] ||
      (a.name ?? "").localeCompare(b.name ?? "")
  );
}

/** @deprecated Prefer upcomingFamilyDates */
export function upcomingImportantDates(
  person: {
    anniversary?: string | null;
    spouse_name?: string | null;
    spouse_birthday?: string | null;
    kids_birthdays?: string | null;
  },
  options?: { withinDays?: number; now?: Date }
) {
  return upcomingFamilyDates(person, options).map((row) => ({
    label: familyDateTitle(row),
    daysUntil: row.daysUntil,
    nextOn: row.nextOn,
  }));
}

/** Primary line: person name when known, otherwise role label. */
export function familyDateTitle(item: Pick<FamilyDateEntry, "role" | "name">) {
  if (item.name) return item.name;
  if (item.role === "spouse") return "Spouse";
  if (item.role === "anniversary") return "Anniversary";
  return "Kid";
}

/** Secondary role/event labels (excluding the date itself). */
export function familyDateEventLabel(item: Pick<FamilyDateEntry, "role" | "event" | "name">) {
  if (item.role === "spouse") return "Spouse";
  if (item.role === "kid") return "Kid";
  if (item.event === "anniversary") return "Anniversary";
  return null;
}

export function upcomingImportantDateWhenLabel(daysUntil: number) {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
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
export function isRankOnProbation(
  rank: string | null | undefined,
  rankPromotedOn: string | null | undefined,
  now = new Date()
) {
  if (!rank || !rankPromotedOn) return false;
  if ((ranksWithoutProbation as readonly string[]).includes(rank)) return false;
  const start = new Date(`${rankPromotedOn}T00:00:00`);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today >= start && today < end;
}

/** Rank promotion date shown in UI / used for probation. Firefighter uses hire date. */
export function effectiveRankPromotedOn(
  rank: string | null | undefined,
  rankPromotedOn: string | null | undefined,
  hireDate: string | null | undefined
) {
  if (rank === "Firefighter") return hireDate || null;
  return rankPromotedOn || null;
}

/** Entry firefighter rank has no separate promotion date. */
export function rankShowsPromotionDate(rank: string | null | undefined) {
  return Boolean(rank) && !isTitleOnlyRank(rank) && rank !== "Firefighter";
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

/** Next expiration for a qualification renew: current expiry + 1 year, or today + 1 year if expired/missing. */
export function nextQualificationRenewalExpiry(expiresOn: string | null | undefined, now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const current = expiresOn?.slice(0, 10) || null;
  const base = current && current >= today ? current : today;
  return addYearsToDate(base, 1);
}

export function formatTrainingHours(hours: number) {
  if (!Number.isFinite(hours) || hours === 0) return "0";
  const rounded = Math.round(hours * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}
