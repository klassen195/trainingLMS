import type { ProgramCategory, UserRole } from "@/lib/training-lms-types";

const categoryLabels: Record<ProgramCategory, string> = {
  fire: "Fire",
  engineer: "Engineer",
  officer: "Officer",
  battalion_chief: "Battalion Chief",
  ems: "EMS",
  administration: "Administration",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  instructor: "Instructor",
  learner: "Learner",
};

export function categoryLabel(category: ProgramCategory) {
  return categoryLabels[category];
}

export function roleLabel(role: UserRole) {
  return roleLabels[role];
}

export const programCategories = Object.keys(categoryLabels) as ProgramCategory[];

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
