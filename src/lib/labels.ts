import type {
  ApparatusType,
  AssetStatus,
  InspectionResult,
  PpeCategory,
} from "@/lib/assets-types";
import type { ProgramTag, UserRole } from "@/lib/training-lms-types";

const tagLabels: Record<ProgramTag, string> = {
  fire: "Fire",
  engineer: "Engineer",
  officer: "Officer",
  battalion_chief: "Battalion Chief",
  ems: "EMS",
  administration: "Administration",
  taskbooks: "Taskbooks",
  special_operations: "Special Operations",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  instructor: "Instructor",
  learner: "Learner",
};

const assetStatusLabels: Record<AssetStatus, string> = {
  in_service: "In service",
  out_of_service: "Out of service",
  reserve: "Reserve",
  retired: "Retired",
};

const ppeCategoryLabels: Record<PpeCategory, string> = {
  turnout_coat: "Turnout coat",
  turnout_pants: "Turnout pants",
  helmet: "Helmet",
  boots: "Boots",
  gloves: "Gloves",
  hood: "Hood",
  scba_facepiece: "SCBA facepiece",
  other: "Other",
};

const apparatusTypeLabels: Record<ApparatusType, string> = {
  engine: "Engine",
  ladder: "Ladder",
  ambulance: "Ambulance",
  rescue: "Rescue",
  boat: "Boat",
  other: "Other",
};

const inspectionResultLabels: Record<InspectionResult, string> = {
  pass: "Pass",
  fail: "Fail",
  needs_attention: "Needs attention",
};

export function tagLabel(tag: ProgramTag) {
  return tagLabels[tag];
}

/** @deprecated Prefer tagLabel */
export function categoryLabel(category: ProgramTag) {
  return tagLabel(category);
}

export function roleLabel(role: UserRole) {
  return roleLabels[role];
}

export const programTags = Object.keys(tagLabels) as ProgramTag[];

/** @deprecated Prefer programTags */
export const programCategories = programTags;

export const fireRanks = [
  "Probationary Firefighter",
  "Firefighter",
  "Engineer",
  "Lieutenant",
  "Captain",
  "Battalion Chief",
  "Deputy Chief",
  "Fire Chief",
] as const;

export type FireRank = (typeof fireRanks)[number];

export function assetStatusLabel(status: AssetStatus) {
  return assetStatusLabels[status];
}

export function ppeCategoryLabel(category: PpeCategory) {
  return ppeCategoryLabels[category];
}

export function apparatusTypeLabel(type: ApparatusType) {
  return apparatusTypeLabels[type];
}

export function inspectionResultLabel(result: InspectionResult) {
  return inspectionResultLabels[result];
}

export const assetStatuses = Object.keys(assetStatusLabels) as AssetStatus[];
export const ppeCategories = Object.keys(ppeCategoryLabels) as PpeCategory[];
export const apparatusTypes = Object.keys(apparatusTypeLabels) as ApparatusType[];
export const inspectionResults = Object.keys(inspectionResultLabels) as InspectionResult[];
