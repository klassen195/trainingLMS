import { redirect } from "next/navigation";
import {
  APP_CAPABILITIES,
  emptyCapabilityRow,
  type AppCapability,
  profileHasCapability,
} from "@/lib/capabilities";
import { loadCapabilityMatrix } from "@/lib/capability-matrix";
import { getAuthContext, requireUserProfile } from "@/lib/auth";
import { gateCapabilitiesForClient } from "@/lib/client-modules-server";
import { isClientModuleKey } from "@/lib/client-modules";
import { isAdmin } from "@/lib/permissions";
import { profilePermissionLevelIds } from "@/lib/permission-levels";
import type { Profile } from "@/lib/training-lms-types";

export { loadCapabilityMatrix } from "@/lib/capability-matrix";

async function resolveClientId(profile: Profile): Promise<string> {
  const ctx = await getAuthContext();
  if (ctx.kind === "authenticated") return ctx.clientId;
  return profile.client_id;
}

async function profileHasEffectiveCapability(
  profile: Profile,
  capability: AppCapability
): Promise<boolean> {
  const clientId = await resolveClientId(profile);
  if (isAdmin(profile)) {
    if (!isClientModuleKey(capability)) return true;
    const gated = await gateCapabilitiesForClient(
      clientId,
      Object.fromEntries(APP_CAPABILITIES.map((cap) => [cap, true])) as Record<AppCapability, boolean>
    );
    return gated[capability];
  }
  const { matrix } = await loadCapabilityMatrix();
  if (!profileHasCapability(profile, capability, matrix)) return false;
  if (!isClientModuleKey(capability)) return true;
  const gated = await gateCapabilitiesForClient(
    clientId,
    Object.fromEntries(APP_CAPABILITIES.map((cap) => [cap, cap === capability])) as Record<
      AppCapability,
      boolean
    >
  );
  return gated[capability];
}

export async function currentUserHasCapability(capability: AppCapability): Promise<boolean> {
  const profile = await requireUserProfile();
  return profileHasEffectiveCapability(profile, capability);
}

export async function requireCapability(capability: AppCapability): Promise<Profile> {
  const profile = await requireUserProfile();
  if (!(await profileHasEffectiveCapability(profile, capability))) redirect("/");
  return profile;
}

export async function assertCapability(capability: AppCapability): Promise<Profile> {
  const profile = await requireUserProfile();
  if (!(await profileHasEffectiveCapability(profile, capability))) {
    throw new Error("You do not have permission to perform this action.");
  }
  return profile;
}

export async function assertFleetShopAccess(): Promise<Profile> {
  const profile = await requireUserProfile();
  if (await profileHasEffectiveCapability(profile, "view_fleet")) return profile;
  // Maintenance resolve is not a client-module gate.
  if (isAdmin(profile)) return profile;
  const { matrix } = await loadCapabilityMatrix();
  if (profileHasCapability(profile, "resolve_maintenance", matrix)) return profile;
  throw new Error("You do not have permission to perform this action.");
}

export async function getProfileCapabilities(profile: Profile): Promise<Record<AppCapability, boolean>> {
  const clientId = await resolveClientId(profile);
  let merged: Record<AppCapability, boolean>;

  if (isAdmin(profile)) {
    merged = Object.fromEntries(APP_CAPABILITIES.map((capability) => [capability, true])) as Record<
      AppCapability,
      boolean
    >;
  } else {
    const { matrix } = await loadCapabilityMatrix();
    merged = emptyCapabilityRow();
    for (const levelId of profilePermissionLevelIds(profile)) {
      const row = matrix[levelId];
      if (!row) continue;
      for (const capability of APP_CAPABILITIES) {
        if (row[capability]) merged[capability] = true;
      }
    }
  }

  return gateCapabilitiesForClient(clientId, merged);
}
