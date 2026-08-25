import type { Profile } from "@/lib/training-lms-types";
import { profilePermissionLevelIds } from "@/lib/permission-levels";

export const APP_CAPABILITIES = [
  "access_shift_exchange",
  "access_programs",
  "access_assets",
  "access_personnel",
  "browse_program_catalog",
  "self_enroll",
  "author_training",
  "ems_qi",
  "document_training",
  "delete_training_reports",
  "approval_tracker",
  "view_apparatus",
  "view_fleet",
  "view_all_ppe",
  "submit_vehicle_checks",
  "submit_maintenance",
  "manage_assets",
  "manage_locations",
  "manage_vehicle_check_templates",
  "manage_quiz_banks",
  "resolve_maintenance",
  "manage_users",
  "manage_incidents",
] as const;

export type AppCapability = (typeof APP_CAPABILITIES)[number];

export type CapabilityMatrix = Record<string, Record<AppCapability, boolean>>;

export type CapabilityPlacement = {
  capability: AppCapability;
  group: string;
  label: string;
};

export const DEFAULT_CAPABILITY_GROUPS = [
  "Modules",
  "Training",
  "Assets & operations",
  "Administration",
] as const;

export const capabilityMeta: Record<
  AppCapability,
  { label: string; description: string; group: string }
> = {
  access_shift_exchange: {
    group: "Modules",
    label: "Shift Exchange",
    description: "Show the Shift Exchange module in navigation and allow access.",
  },
  access_programs: {
    group: "Modules",
    label: "Programs",
    description: "Show the Programs module in navigation and allow access.",
  },
  access_assets: {
    group: "Modules",
    label: "Assets",
    description: "Show the Assets module in navigation and allow access.",
  },
  access_personnel: {
    group: "Modules",
    label: "Personnel",
    description: "Show the Personnel module in navigation and allow access.",
  },
  browse_program_catalog: {
    group: "Training",
    label: "Browse program catalog",
    description: "See all published programs, not only assigned enrollments.",
  },
  self_enroll: {
    group: "Training",
    label: "Self-enroll in training",
    description: "Enroll in programs and modules without staff assignment.",
  },
  author_training: {
    group: "Training",
    label: "Author training",
    description: "Create and edit programs and modules. Shows Instructor in navigation.",
  },
  ems_qi: {
    group: "Training",
    label: "EMS QI",
    description: "Access the EMS Call QA/QI review tool.",
  },
  document_training: {
    group: "Training",
    label: "Document training",
    description: "Log training sessions. Shows Training in navigation.",
  },
  delete_training_reports: {
    group: "Training",
    label: "Delete training reports",
    description: "Permanently delete documented training sessions.",
  },
  approval_tracker: {
    group: "Training",
    label: "Policy Tracker",
    description: "Track policies and training aids. Shows Policy Tracker in navigation.",
  },
  view_apparatus: {
    group: "Assets & operations",
    label: "View apparatus inventory",
    description: "Browse the apparatus roster and unit pages.",
  },
  view_fleet: {
    group: "Assets & operations",
    label: "View fleet shop",
    description: "Open the Fleet board. Shows Fleet in navigation.",
  },
  view_all_ppe: {
    group: "Assets & operations",
    label: "View all equipment",
    description: "See department equipment inventory, not only items assigned to you.",
  },
  submit_vehicle_checks: {
    group: "Assets & operations",
    label: "Submit vehicle checks",
    description: "Complete daily/weekly apparatus checklists.",
  },
  submit_maintenance: {
    group: "Assets & operations",
    label: "Submit maintenance requests",
    description: "File maintenance requests for equipment and apparatus.",
  },
  manage_assets: {
    group: "Administration",
    label: "Manage assets",
    description: "Create, edit, and delete equipment and apparatus records.",
  },
  manage_locations: {
    group: "Administration",
    label: "Manage locations",
    description: "Create and edit stations and sites.",
  },
  manage_vehicle_check_templates: {
    group: "Administration",
    label: "Manage check templates",
    description: "Edit vehicle check checklist templates.",
  },
  manage_quiz_banks: {
    group: "Administration",
    label: "Manage quiz banks",
    description: "Configure quiz questions and pass rules.",
  },
  resolve_maintenance: {
    group: "Administration",
    label: "Resolve maintenance",
    description: "Review and resolve maintenance requests. Shows Maintenance requests on Assets.",
  },
  manage_users: {
    group: "Administration",
    label: "Manage users",
    description: "Edit member profiles, permission levels, and admin flags.",
  },
  manage_incidents: {
    group: "Assets & operations",
    label: "Manage incidents",
    description: "Run ICS tactical boards. Shows Incidents in navigation.",
  },
};

export function emptyCapabilityRow(): Record<AppCapability, boolean> {
  return Object.fromEntries(APP_CAPABILITIES.map((capability) => [capability, false])) as Record<
    AppCapability,
    boolean
  >;
}

export function emptyCapabilityMatrix(levelIds: string[]): CapabilityMatrix {
  return Object.fromEntries(levelIds.map((id) => [id, emptyCapabilityRow()])) as CapabilityMatrix;
}

export function profileHasCapability(
  profile: Profile,
  capability: AppCapability,
  matrix: CapabilityMatrix
) {
  if (profile.is_admin) return true;
  return profilePermissionLevelIds(profile).some((levelId) => Boolean(matrix[levelId]?.[capability]));
}

export function defaultCapabilityPlacements(): CapabilityPlacement[] {
  return APP_CAPABILITIES.map((capability) => ({
    capability,
    group: capabilityMeta[capability].group,
    label: capabilityMeta[capability].label,
  }));
}

export function normalizeCapabilityPlacements(
  placements?: readonly { capability: string; group?: string | null; label?: string | null }[] | null
): CapabilityPlacement[] {
  const known = new Set<string>(APP_CAPABILITIES);
  const seen = new Set<AppCapability>();
  const result: CapabilityPlacement[] = [];

  for (const row of placements ?? []) {
    if (!known.has(row.capability)) continue;
    const capability = row.capability as AppCapability;
    if (seen.has(capability)) continue;
    seen.add(capability);
    const group = row.group?.trim() || capabilityMeta[capability].group;
    const label = row.label?.trim() || capabilityMeta[capability].label;
    result.push({ capability, group, label });
  }

  for (const capability of APP_CAPABILITIES) {
    if (seen.has(capability)) continue;
    result.push({
      capability,
      group: capabilityMeta[capability].group,
      label: capabilityMeta[capability].label,
    });
  }

  return result;
}

export function orderedCapabilities(
  placements?: readonly { capability: string; group?: string | null; label?: string | null }[] | null
): AppCapability[] {
  return normalizeCapabilityPlacements(placements).map((row) => row.capability);
}

export function capabilityGroups(
  placements?: readonly { capability: string; group?: string | null; label?: string | null }[] | null
) {
  const normalized = normalizeCapabilityPlacements(placements);
  const groups = new Map<string, AppCapability[]>();

  for (const group of DEFAULT_CAPABILITY_GROUPS) {
    groups.set(group, []);
  }

  for (const row of normalized) {
    const list = groups.get(row.group) ?? [];
    list.push(row.capability);
    groups.set(row.group, list);
  }

  return [...groups.entries()].filter(([, caps]) => caps.length > 0);
}

/** All group names currently used, including empty defaults for drop targets. */
export function capabilityGroupNames(
  placements?: readonly { capability: string; group?: string | null; label?: string | null }[] | null
): string[] {
  const normalized = normalizeCapabilityPlacements(placements);
  const names: string[] = [...DEFAULT_CAPABILITY_GROUPS];
  for (const row of normalized) {
    if (!names.includes(row.group)) names.push(row.group);
  }
  return names;
}

export function capabilityLabel(
  capability: AppCapability,
  placements?: readonly CapabilityPlacement[] | null
) {
  return (
    placements?.find((row) => row.capability === capability)?.label?.trim() ||
    capabilityMeta[capability].label
  );
}
