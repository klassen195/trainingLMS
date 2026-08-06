import type { Profile, UserRole } from "@/lib/training-lms-types";

export const APP_CAPABILITIES = [
  "browse_program_catalog",
  "self_enroll",
  "author_training",
  "ems_qi",
  "document_training",
  "view_apparatus",
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

export const PERMISSION_LEVELS: UserRole[] = ["recruit", "firefighter", "captain"];

export type CapabilityMatrix = Record<UserRole, Record<AppCapability, boolean>>;

export const capabilityMeta: Record<
  AppCapability,
  { label: string; description: string; group: string }
> = {
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
    description: "Create and edit programs and modules.",
  },
  ems_qi: {
    group: "Training",
    label: "EMS QI",
    description: "Access the EMS Call QA/QI review tool.",
  },
  document_training: {
    group: "Training",
    label: "Document training",
    description: "Log in-house training sessions and certification courses.",
  },
  view_apparatus: {
    group: "Assets & operations",
    label: "View apparatus inventory",
    description: "Browse the apparatus roster and unit pages.",
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
    description: "File apparatus maintenance requests.",
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
    description: "Review and resolve maintenance requests.",
  },
  manage_users: {
    group: "Administration",
    label: "Manage users",
    description: "Edit member profiles, permission levels, and admin flags.",
  },
  manage_incidents: {
    group: "Assets & operations",
    label: "Manage incidents",
    description: "Create and run ICS tactical boards: org chart, unit assignments, and map.",
  },
};

export function emptyCapabilityRow(): Record<AppCapability, boolean> {
  return Object.fromEntries(APP_CAPABILITIES.map((capability) => [capability, false])) as Record<
    AppCapability,
    boolean
  >;
}

export function emptyCapabilityMatrix(): CapabilityMatrix {
  return {
    recruit: emptyCapabilityRow(),
    firefighter: emptyCapabilityRow(),
    captain: emptyCapabilityRow(),
  };
}

export function profileHasCapability(
  profile: Profile,
  capability: AppCapability,
  matrix: CapabilityMatrix
) {
  if (profile.is_admin) return true;
  return Boolean(matrix[profile.role]?.[capability]);
}

export function capabilityGroups() {
  const groups = new Map<string, AppCapability[]>();
  for (const capability of APP_CAPABILITIES) {
    const group = capabilityMeta[capability].group;
    const list = groups.get(group) ?? [];
    list.push(capability);
    groups.set(group, list);
  }
  return [...groups.entries()];
}
