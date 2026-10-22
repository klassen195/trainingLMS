import { redirect } from "next/navigation";
import { getProfileCapabilities } from "@/lib/capability-access";
import { requireUserProfile } from "@/lib/auth";

export async function requireRopeAccess() {
  const profile = await requireUserProfile();
  const caps = await getProfileCapabilities(profile);
  if (!caps.view_rope_inventory && !caps.manage_rope_inventory) redirect("/assets");
  return {
    profile,
    caps,
    canManage: caps.manage_rope_inventory,
    showApparatus: caps.view_apparatus || caps.manage_assets,
    showMaintenance: caps.resolve_maintenance,
    showRope: true,
  };
}
