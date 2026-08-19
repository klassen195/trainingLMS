import type { Profile } from "@/lib/training-lms-types";
import { profilePermissionLevelIds } from "@/lib/permission-levels";

export function hasRole(profile: Profile, permissionLevelIds: string[]) {
  const assigned = new Set(profilePermissionLevelIds(profile));
  return permissionLevelIds.some((id) => assigned.has(id));
}

export function isAdmin(profile: Profile) {
  return profile.is_admin;
}

export function canAuthorTraining(profile: Profile) {
  return profile.is_admin;
}

export function isRecruit(_profile: Profile) {
  return false;
}
