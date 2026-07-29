import type {
  ApparatusType,
  AssetStatus,
  InspectionResult,
  PpeCategory,
} from "@/lib/assets-types";
import type {
  VehicleCheckFieldType,
  VehicleCheckItemResult,
  VehicleCheckLevel,
  VehicleCheckType,
} from "@/lib/vehicle-checks-types";
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
  tender: "Tender",
  boat: "Boat",
  other: "Other",
};

const inspectionResultLabels: Record<InspectionResult, string> = {
  pass: "Pass",
  fail: "Fail",
  needs_attention: "Needs attention",
};

const vehicleCheckTypeLabels: Record<VehicleCheckType, string> = {
  daily: "Daily",
  weekly: "Weekly",
};

const vehicleCheckFieldTypeLabels: Record<VehicleCheckFieldType, string> = {
  pass_fail: "Pass / Fail",
  level: "Level",
  short_answer: "Short answer",
};

const vehicleCheckItemResultLabels: Record<VehicleCheckItemResult, string> = {
  pass: "Pass",
  fail: "Fail",
};

const vehicleCheckLevelLabels: Record<VehicleCheckLevel, string> = {
  full: "Full",
  three_quarters: "3/4",
  half: "1/2",
  one_quarter: "1/4",
  empty: "Empty",
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

export function vehicleCheckTypeLabel(type: VehicleCheckType) {
  return vehicleCheckTypeLabels[type];
}

export function vehicleCheckFieldTypeLabel(type: VehicleCheckFieldType) {
  return vehicleCheckFieldTypeLabels[type];
}

export function vehicleCheckItemResultLabel(result: VehicleCheckItemResult) {
  return vehicleCheckItemResultLabels[result];
}

export function vehicleCheckLevelLabel(level: VehicleCheckLevel) {
  return vehicleCheckLevelLabels[level];
}

export const assetStatuses = Object.keys(assetStatusLabels) as AssetStatus[];
export const ppeCategories = Object.keys(ppeCategoryLabels) as PpeCategory[];
export const apparatusTypes = Object.keys(apparatusTypeLabels) as ApparatusType[];
export const inspectionResults = Object.keys(inspectionResultLabels) as InspectionResult[];
export const vehicleCheckTypes = Object.keys(vehicleCheckTypeLabels) as VehicleCheckType[];
export const vehicleCheckFieldTypes = Object.keys(
  vehicleCheckFieldTypeLabels
) as VehicleCheckFieldType[];
export const vehicleCheckItemResults = Object.keys(
  vehicleCheckItemResultLabels
) as VehicleCheckItemResult[];
export const vehicleCheckLevels = Object.keys(vehicleCheckLevelLabels) as VehicleCheckLevel[];
