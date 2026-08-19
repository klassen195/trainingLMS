import { redirect } from "next/navigation";
import {
  APP_CAPABILITIES,
  type AppCapability,
  profileHasCapability,
} from "@/lib/capabilities";
import { loadCapabilityMatrix } from "@/lib/capability-matrix";
import { requireUserProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import type { Profile } from "@/lib/training-lms-types";

export { loadCapabilityMatrix } from "@/lib/capability-matrix";

export async function currentUserHasCapability(capability: AppCapability): Promise<boolean> {
  const profile = await requireUserProfile();
  if (isAdmin(profile)) return true;
  const matrix = await loadCapabilityMatrix();
  return profileHasCapability(profile, capability, matrix);
}

export async function requireCapability(capability: AppCapability): Promise<Profile> {
  const profile = await requireUserProfile();
  if (isAdmin(profile)) return profile;
  const matrix = await loadCapabilityMatrix();
  if (!profileHasCapability(profile, capability, matrix)) redirect("/dashboard");
  return profile;
}

export async function assertCapability(capability: AppCapability): Promise<Profile> {
  const profile = await requireUserProfile();
  if (isAdmin(profile)) return profile;
  const matrix = await loadCapabilityMatrix();
  if (!profileHasCapability(profile, capability, matrix)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return profile;
}

export async function assertFleetShopAccess(): Promise<Profile> {
  const profile = await requireUserProfile();
  if (isAdmin(profile)) return profile;
  const matrix = await loadCapabilityMatrix();
  if (
    profileHasCapability(profile, "view_fleet", matrix) ||
    profileHasCapability(profile, "resolve_maintenance", matrix)
  ) {
    return profile;
  }
  throw new Error("You do not have permission to perform this action.");
}

export async function getProfileCapabilities(profile: Profile): Promise<Record<AppCapability, boolean>> {
  if (isAdmin(profile)) {
    return Object.fromEntries(APP_CAPABILITIES.map((capability) => [capability, true])) as Record<
      AppCapability,
      boolean
    >;
  }
  const matrix = await loadCapabilityMatrix();
  return { ...matrix[profile.role] };
}
