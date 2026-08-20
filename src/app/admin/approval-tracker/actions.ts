"use server";

import { listAdminApprovalProfiles, listApprovalStageMembers } from "@/app/approval-tracker/actions";
import { requireAdmin } from "@/lib/auth";

export async function loadApprovalStageMembersAdmin() {
  await requireAdmin();
  const [profiles, members] = await Promise.all([
    listAdminApprovalProfiles(),
    listApprovalStageMembers(),
  ]);
  return { profiles, members };
}
