import type {
  ApparatusType,
  AssetStatus,
  InspectionResult,
  PpeCategory,
} from "@/lib/assets-types";
import type {
  MaintenanceRequestStatus,
  MaintenanceRequestType,
  MaintenanceServiceStatus,
  MaintenanceShopStatus,
} from "@/lib/maintenance-types";
import type {
  VehicleCheckFieldType,
  VehicleCheckItemResult,
  VehicleCheckLevel,
  VehicleChecklistKind,
  VehicleCheckType,
} from "@/lib/vehicle-checks-types";
import type { ProgramTag } from "@/lib/training-lms-types";
import { rankBehavior } from "@/lib/ranks-types";

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
  brush: "Brush",
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
  moved_status: "Moved / Not moved",
  level: "Level",
  short_answer: "Short answer",
};

const vehicleChecklistKindLabels: Record<VehicleChecklistKind, string> = {
  check: "Check",
  swap: "Swap",
};

const vehicleCheckItemResultLabels: Record<VehicleCheckItemResult, string> = {
  pass: "Pass",
  fail: "Fail",
  moved: "Moved",
  not_moved: "Not moved",
  not_applicable: "N/A",
};

const vehicleCheckLevelLabels: Record<VehicleCheckLevel, string> = {
  full: "Full",
  three_quarters: "3/4",
  half: "1/2",
  one_quarter: "1/4",
  empty: "Empty",
};

const maintenanceRequestTypeLabels: Record<MaintenanceRequestType, string> = {
  major: "Major",
  minor: "Minor",
  scheduled: "Scheduled",
};

const maintenanceServiceStatusLabels: Record<MaintenanceServiceStatus, string> = {
  in_service: "Remaining in service",
  out_of_service: "Out of service",
};

const maintenanceRequestStatusLabels: Record<MaintenanceRequestStatus, string> = {
  open: "Open",
  resolved: "Resolved",
};

const maintenanceShopStatusLabels: Record<MaintenanceShopStatus, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In progress",
  on_hold: "On hold",
};

export function tagLabel(tag: ProgramTag) {
  return tagLabels[tag];
}

/** @deprecated Prefer tagLabel */
export function categoryLabel(category: ProgramTag) {
  return tagLabel(category);
}

export const programTags = Object.keys(tagLabels) as ProgramTag[];

/** @deprecated Prefer programTags */
export const programCategories = programTags;

export const fireRanks = [
  "Firefighter",
  "Engineer",
  "Captain",
  "Battalion Chief",
  "Assistant Chief",
  "Division Chief",
  "Fire Chief",
  "Administration",
] as const;

export type FireRank = (typeof fireRanks)[number];

/** @deprecated Prefer personnel_ranks.no_probation via rankBehavior() */
export const ranksWithoutProbation = [
  "Assistant Chief",
  "Division Chief",
  "Fire Chief",
  "Administration",
] as const satisfies readonly FireRank[];

/** @deprecated Prefer personnel_ranks.has_title via rankBehavior() */
export const ranksWithTitle = [
  "Assistant Chief",
  "Division Chief",
  "Administration",
] as const satisfies readonly FireRank[];

/** @deprecated Prefer personnel_ranks.title_only via rankBehavior() */
export const titleOnlyRanks = ["Administration"] as const satisfies readonly FireRank[];

export function rankHasTitle(rank: string | null | undefined) {
  return rankBehavior(rank).has_title;
}

export function isTitleOnlyRank(rank: string | null | undefined) {
  return rankBehavior(rank).title_only;
}

/** Rank column / badge text: title-only ranks show the title, never the rank name. */
export function formatPersonnelRankDisplay(
  rank: string | null | undefined,
  jobTitle?: string | null
) {
  if (isTitleOnlyRank(rank)) {
    return jobTitle?.trim() || "—";
  }
  if (!rank) return "—";
  if (rankHasTitle(rank) && jobTitle?.trim()) {
    return `${rank} · ${jobTitle.trim()}`;
  }
  return rank;
}

/** @deprecated Prefer personnel_ranks.swing_up_eligible via swingUpRanksFromCatalog() */
export const swingUpRanks = [
  "Engineer",
  "Captain",
  "Battalion Chief",
] as const satisfies readonly FireRank[];

export type SwingUpRank = (typeof swingUpRanks)[number];

/** Taskbook catalog lives in `taskbook_types` (Admin → Taskbooks). */
export type TaskbookPrerequisite = {
  id: string;
  label: string;
};

export function assetStatusLabel(status: AssetStatus) {
  return assetStatusLabels[status];
}

export function assetStatusBadgeClass(status: AssetStatus) {
  switch (status) {
    case "in_service":
      return "border-transparent bg-emerald-100 text-emerald-800";
    case "out_of_service":
      return "border-transparent bg-red-100 text-red-800";
    case "reserve":
      return "border-transparent bg-amber-100 text-amber-900";
    case "retired":
      return "border-transparent bg-slate-200 text-slate-700";
  }
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

export function vehicleChecklistKindLabel(kind: VehicleChecklistKind) {
  return vehicleChecklistKindLabels[kind];
}

export function vehicleCheckItemResultLabel(result: VehicleCheckItemResult) {
  return vehicleCheckItemResultLabels[result];
}

export function vehicleCheckLevelLabel(level: VehicleCheckLevel) {
  return vehicleCheckLevelLabels[level];
}

export function maintenanceRequestTypeLabel(type: MaintenanceRequestType) {
  return maintenanceRequestTypeLabels[type];
}

export function maintenanceServiceStatusLabel(status: MaintenanceServiceStatus) {
  return maintenanceServiceStatusLabels[status];
}

export function maintenanceRequestStatusLabel(status: MaintenanceRequestStatus) {
  return maintenanceRequestStatusLabels[status];
}

export function maintenanceRequestStatusBadgeClass(status: MaintenanceRequestStatus) {
  switch (status) {
    case "open":
      return "border-transparent bg-amber-100 text-amber-900";
    case "resolved":
      return "border-transparent bg-slate-200 text-slate-700";
  }
}

export function maintenanceShopStatusLabel(status: MaintenanceShopStatus) {
  return maintenanceShopStatusLabels[status];
}

export function maintenanceShopStatusBadgeClass(status: MaintenanceShopStatus) {
  switch (status) {
    case "new":
      return "border-transparent bg-sky-100 text-sky-900";
    case "assigned":
      return "border-transparent bg-indigo-100 text-indigo-900";
    case "in_progress":
      return "border-transparent bg-amber-100 text-amber-900";
    case "on_hold":
      return "border-transparent bg-slate-200 text-slate-700";
  }
}

export const assetStatuses = Object.keys(assetStatusLabels) as AssetStatus[];
export const ppeCategories = Object.keys(ppeCategoryLabels) as PpeCategory[];
export const apparatusTypes = Object.keys(apparatusTypeLabels) as ApparatusType[];
export const inspectionResults = Object.keys(inspectionResultLabels) as InspectionResult[];
export const vehicleCheckTypes = Object.keys(vehicleCheckTypeLabels) as VehicleCheckType[];
export const vehicleChecklistKinds = Object.keys(
  vehicleChecklistKindLabels
) as VehicleChecklistKind[];
export const vehicleCheckFieldTypes = Object.keys(
  vehicleCheckFieldTypeLabels
) as VehicleCheckFieldType[];
export const maintenanceRequestTypes = Object.keys(
  maintenanceRequestTypeLabels
) as MaintenanceRequestType[];
export const maintenanceServiceStatuses = Object.keys(
  maintenanceServiceStatusLabels
) as MaintenanceServiceStatus[];
export const maintenanceShopStatuses = Object.keys(
  maintenanceShopStatusLabels
) as MaintenanceShopStatus[];

export function fieldTypesForChecklistKind(kind: VehicleChecklistKind): VehicleCheckFieldType[] {
  if (kind === "swap") {
    return ["moved_status", "level", "short_answer"];
  }
  return ["pass_fail", "level", "short_answer"];
}

export function defaultFieldTypeForChecklistKind(kind: VehicleChecklistKind): VehicleCheckFieldType {
  return kind === "swap" ? "moved_status" : "pass_fail";
}
export const vehicleCheckItemResults = Object.keys(
  vehicleCheckItemResultLabels
) as VehicleCheckItemResult[];
export const vehicleCheckLevels = Object.keys(vehicleCheckLevelLabels) as VehicleCheckLevel[];
