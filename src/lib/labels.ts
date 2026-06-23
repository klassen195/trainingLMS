import type { CourseCategory, UserRole } from "@/lib/training-lms-types";

const categoryLabels: Record<CourseCategory, string> = {
  fire: "Fire",
  engineer: "Engineer",
  officer: "Officer",
  battalion_chief: "Battalion Chief",
  ems: "EMS",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  instructor: "Instructor",
  learner: "Learner",
};

export function categoryLabel(category: CourseCategory) {
  return categoryLabels[category];
}

export function roleLabel(role: UserRole) {
  return roleLabels[role];
}

export const courseCategories = Object.keys(categoryLabels) as CourseCategory[];
