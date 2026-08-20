"use server";

import {
  listAdminApprovalProfiles,
  listApprovalCommitteeMembers,
  listApprovalStageMembers,
} from "@/app/approval-tracker/actions";
import { requireAdmin } from "@/lib/auth";

export async function loadApprovalStageMembersAdmin() {
  await requireAdmin();
  const [profiles, members, committeeMembers] = await Promise.all([
    listAdminApprovalProfiles(),
    listApprovalStageMembers(),
    listApprovalCommitteeMembers(),
  ]);
  return { profiles, members, committeeMembers };
}
