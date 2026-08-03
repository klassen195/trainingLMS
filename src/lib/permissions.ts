import type { Profile, UserRole } from "@/lib/training-lms-types";

export function hasRole(profile: Profile, roles: UserRole[]) {
  return roles.includes(profile.role);
}

export function isAdmin(profile: Profile) {
  return profile.is_admin;
}

export function canAuthorTraining(profile: Profile) {
  return profile.is_admin || profile.role === "captain";
}

export function isRecruit(profile: Profile) {
  return profile.role === "recruit" && !profile.is_admin;
}
