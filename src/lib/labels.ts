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
