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
} from "@/lib/maintenance-types";
import type {
  VehicleCheckFieldType,
  VehicleCheckItemResult,
  VehicleCheckLevel,
  VehicleChecklistKind,
  VehicleCheckType,
} from "@/lib/vehicle-checks-types";
import type { ProgramTag } from "@/lib/training-lms-types";

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
  "Fire Chief",
] as const;

export type FireRank = (typeof fireRanks)[number];

/** Ranks available for swing-up qualification (excludes entry and chief ranks). */
export const swingUpRanks = [
  "Engineer",
  "Captain",
  "Battalion Chief",
] as const satisfies readonly FireRank[];

export type SwingUpRank = (typeof swingUpRanks)[number];

/** Taskbook catalog grouped for display. */
export const taskbookGroups = [
  {
    id: "rank",
    label: "Rank",
    ranks: [
      "Firefighter",
      "Engineer",
      "Captain",
      "MSO",
      "Battalion Chief",
      "Deputy Fire Marshal",
    ],
  },
  {
    id: "specialty",
    label: "Specialty",
    ranks: ["Fire Boat Operator", "Rescue Boat Operator", "Drone Operator"],
  },
  {
    id: "ems",
    label: "EMS",
    ranks: ["EMT", "AEMT", "Paramedic", "Critical Care Transport"],
  },
  {
    id: "wildland",
    label: "Wildland",
    ranks: ["REMS", "FFT1 (Squad Boss)", "Single Resource Boss"],
  },
] as const;

export type TaskbookGroupId = (typeof taskbookGroups)[number]["id"];
export type TaskbookRank = (typeof taskbookGroups)[number]["ranks"][number];

/** All available taskbooks (rank progression + specialties), catalog order. */
export const taskbookRanks = taskbookGroups.flatMap(
  (group) => group.ranks
) as readonly TaskbookRank[];

/** Taskbooks issued automatically on hire (not requestable). */
export const autoIssuedTaskbooks = ["Firefighter"] as const satisfies readonly TaskbookRank[];

export type AutoIssuedTaskbook = (typeof autoIssuedTaskbooks)[number];

/** Taskbooks members can apply for. */
export const requestableTaskbooks = taskbookRanks.filter(
  (rank): rank is Exclude<TaskbookRank, AutoIssuedTaskbook> =>
    !(autoIssuedTaskbooks as readonly string[]).includes(rank)
);

export type TaskbookPrerequisite = {
  id: string;
  label: string;
};

/** Prerequisites per taskbook. Empty arrays mean no checklist for that book. */
export const taskbookPrerequisites: Record<TaskbookRank, readonly TaskbookPrerequisite[]> = {
  Firefighter: [],
  Engineer: [
    { id: "eng-driver-operator", label: "Driver Operator Certification or Equivalent" },
    { id: "eng-iso", label: "Incident Safety Officer Certification" },
    { id: "eng-ff-probation", label: "Successfully Passed Firefighter Probation" },
  ],
  Captain: [
    { id: "cap-eng-taskbook", label: "Completed Engineer Task Book" },
    { id: "cap-fo1", label: "Fire Officer 1 or meets NFPA 1021 Standards" },
    { id: "cap-ic300", label: "Incident Command (IC) 300" },
    {
      id: "cap-blue-card",
      label: "Blue Card / Calming the Chaos or an equivalent approved course",
    },
    { id: "cap-s131", label: "S-131/G-131 (preferred)" },
    {
      id: "cap-cfi-first-responders",
      label: "CFI Trainer - First Responders Impact Fire Investigations",
    },
    { id: "cap-cfi-fire-flow", label: "CFI Trainer - Fire Flow Analysis" },
    { id: "cap-cfi-wildland", label: "CFI Trainer - Wildland Investigations" },
    { id: "cap-cfi-vehicle", label: "CFI Trainer - Investigating Vehicle Fires" },
    { id: "cap-cfi-youth", label: "CFI Trainer - Youth Set Fires" },
    { id: "cap-building-construction", label: "Building Construction Course" },
    { id: "cap-leadership", label: "Leadership Training (32 Hours)" },
    { id: "cap-strategy-tactics", label: "Strategy & Tactics (32 Hours)" },
    { id: "cap-progressive-discipline", label: "Progressive Discipline Course (preferred)" },
  ],
  "Battalion Chief": [
    {
      id: "bc-12mo-captain",
      label: "Completion of twelve (12) months as a promoted Captain",
    },
    {
      id: "bc-fo2",
      label: "Meet NFPA 1021 knowledge and skill standards for Fire Officer II",
    },
    { id: "bc-media", label: "Working with the Media Course (AWR 209 – preferred)" },
    { id: "bc-ic300", label: "Incident Command (IC) FEMA Level 300" },
    { id: "bc-ic400", label: "Incident Command (IC) FEMA Level 400" },
    {
      id: "bc-blue-card",
      label: "Blue Card/Calming the Chaos or an equivalent approved course",
    },
  ],
  "Deputy Fire Marshal": [],
  MSO: [
    { id: "mso-ccp-fpc", label: "Completion of the CCP or FPC Certification" },
    { id: "mso-captain-qualified", label: "Captain Qualified" },
  ],
  "Critical Care Transport": [
    { id: "cct-ccp-fpc", label: "Completion of their CCP or FPC certification" },
  ],
  EMT: [{ id: "emt-idaho-card", label: "Current Idaho EMT Card" }],
  AEMT: [{ id: "aemt-idaho-card", label: "Current Idaho AEMT Card" }],
  Paramedic: [{ id: "paramedic-idaho-card", label: "Current Idaho Paramedic Card" }],
  "Fire Boat Operator": [
    { id: "boat-idaho-safety", label: "Completed Idaho Boater Safety Course" },
    { id: "boat-kcfr-crewmember", label: "Completed KCFR Crewmember Training" },
  ],
  "Rescue Boat Operator": [
    { id: "rescue-boat-idaho-safety", label: "Completed Idaho Boater Safety Course" },
    { id: "rescue-boat-swim-test", label: "Passed KCFR Swim Test" },
    { id: "rescue-boat-class", label: "Rescue Boat Class" },
    { id: "rescue-boat-swift-water", label: "Swift Water Class" },
  ],
  "Drone Operator": [
    {
      id: "drone-formal-training",
      label: "Completion of Formal Training Class (Online or Classroom)",
    },
  ],
  REMS: [
    { id: "rems-s130", label: "NWCG S-130 Wildland Firefighter Training" },
    { id: "rems-s131", label: "NWCG S-131 Firefighter Type I (preferred)" },
    { id: "rems-s190", label: "NWCG S-190 Introduction to Wildland Fire Behavior" },
    { id: "rems-l180", label: "NWCG L-180 Human Factors in the Wildland Fire Service" },
  ],
  "FFT1 (Squad Boss)": [{ id: "fft1-s131", label: "S-131" }],
  "Single Resource Boss": [
    { id: "srb-s230", label: "S-230" },
    { id: "srb-s290", label: "S-290" },
  ],
};

export function getTaskbookPrerequisites(rank: string): readonly TaskbookPrerequisite[] {
  if ((taskbookRanks as readonly string[]).includes(rank)) {
    return taskbookPrerequisites[rank as TaskbookRank];
  }
  return [];
}

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
