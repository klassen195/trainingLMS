"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin, requireUserProfile } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPersonnelCertificationStoragePath,
  buildPersonnelDocumentStoragePath,
  PERSONNEL_DOCUMENTS_BUCKET,
  sanitizePersonnelFileName,
  composePersonnelDisplayName,
  addYearsToDate,
  effectiveRankPromotedOn,
  normalizeSwingUpRanks,
  isPersonnelSupervisorOf,
  isTitleOnlyRank,
  rankHasTitle,
  type PersonnelShift,
} from "@/lib/personnel-types";
import { listShiftBattalionChiefIds, personHasSupervisorCoverage } from "@/lib/personnel";
import { autoIssuedTaskbooks, swingUpRanks, taskbookRanks, getTaskbookPrerequisites } from "@/lib/labels";
import { isRecognitionAwardId } from "@/lib/recognition-awards";
import { normalizeAuthEmail } from "@/lib/auth-messages";
import { formatPhoneInput } from "@/lib/phone";
import { serializePostalAddress, parsePostalAddress } from "@/lib/address";
import {
  generateTemporaryPassword,
  withMustChangePassword,
} from "@/lib/auth-password";
import { isAdmin } from "@/lib/permissions";
import { replaceProfilePermissionLevels } from "@/lib/permission-levels";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingPersonnelTables(error) || isMissingTrainingLmsTables(error)) {
    throw new Error(
      "Personnel tables not set up yet. Run supabase/migrations/20260729420000_personnel_module.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidatePersonnel(userId?: string) {
  revalidatePath("/personnel");
  revalidatePath("/admin");
  if (userId) {
    revalidatePath(`/personnel/${userId}`);
    revalidatePath(`/personnel/${userId}/edit`);
  }
}

function personnelFilePath(userId: string, section?: string | null) {
  const id = section?.replace(/^#/, "").trim();
  return id ? `/personnel/${userId}#${id}` : `/personnel/${userId}`;
}

export async function createPersonnelMember(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  permissionLevelIds?: string[];
}) {
  const adminProfile = await requireAdmin();

  const email = normalizeAuthEmail(input.email);
  if (!email) throw new Error("Enter a valid email address.");

  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const displayName = composePersonnelDisplayName(firstName, lastName);
  const clientId = adminProfile.client_id;
  if (!clientId) throw new Error("Your account is missing an organization. Sign out and sign back in.");
  const supabase = await createSupabaseServerClient();
  let permissionLevelIds = [...new Set((input.permissionLevelIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (permissionLevelIds.length === 0) {
    const { data: defaultLevel, error: defaultError } = await supabase
      .from("permission_levels")
      .select("id")
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (defaultError) throw new Error(defaultError.message);
    if (defaultLevel?.id) permissionLevelIds = [defaultLevel.id];
  }
  if (permissionLevelIds.length === 0) throw new Error("Create a permission level before adding members.");

  const { data: levels, error: levelError } = await supabase
    .from("permission_levels")
    .select("id")
    .in("id", permissionLevelIds);
  if (levelError) throw new Error(levelError.message);
  if ((levels?.length ?? 0) !== permissionLevelIds.length) throw new Error("Permission level not found.");

  const admin = createSupabaseServiceClient();

  // Create Auth user without sending email; a temporary password is issued from their file.
  // client_id must also go in user_metadata: GoTrue applies custom app_metadata
  // in a follow-up UPDATE, so the handle_new_user INSERT trigger never sees it.
  const userMetadata = {
    client_id: clientId,
    ...(firstName || lastName || displayName
      ? {
          first_name: firstName,
          last_name: lastName,
          display_name: displayName,
        }
      : {}),
  };
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    app_metadata: { client_id: clientId },
    user_metadata: userMetadata,
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      throw new Error("A user with that email already exists.");
    }
    throw new Error(error.message?.trim() || "Could not create the sign-in account for this member.");
  }
  if (!data.user) throw new Error("Could not create user.");

  const userId = data.user.id;

  // Profile is created by handle_new_user; patch org/access fields via service role
  const profileFields = {
    display_name: displayName,
    first_name: firstName,
    last_name: lastName,
    email,
    client_id: clientId,
    invited_at: null as string | null,
  };

  const { error: updateError } = await admin.from("profiles").update(profileFields).eq("id", userId);

  if (updateError) {
    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: userId,
        ...profileFields,
      },
      { onConflict: "id" }
    );
    if (upsertError) throw new Error(upsertError.message);
  }

  await replaceProfilePermissionLevels(admin, {
    profileId: userId,
    clientId,
    permissionLevelIds,
  });

  const approvedOn = new Date().toISOString().slice(0, 10);
  const dueOn = addYearsToDate(approvedOn, 1);
  const { error: taskbookError } = await admin.from("personnel_taskbooks").insert({
    profile_id: userId,
    client_id: clientId,
    rank: "Firefighter",
    status: "active",
    approved_on: approvedOn,
    due_on: dueOn,
    notes: "Issued automatically upon hire.",
    requested_by: userId,
    decided_by: null,
  });
  if (taskbookError && taskbookError.code !== "23505") {
    throw new Error(taskbookError.message);
  }

  revalidatePersonnel(userId);
  redirect(`/personnel/${userId}/edit`);
}

export async function issueTemporaryPassword(input: { userId: string }) {
  await requireAdmin();

  const admin = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, client_id, is_active")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("User not found.");
  if (profile.is_active === false) {
    throw new Error("Reactivate this account before issuing a password.");
  }

  const email = normalizeAuthEmail(profile.email ?? "");
  if (!email) throw new Error("This person needs an email address before you can issue a password.");

  const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(input.userId);
  if (authLookupError) throw new Error(authLookupError.message);
  if (!authData.user) throw new Error("Sign-in account not found.");

  const temporaryPassword = generateTemporaryPassword();
  const { error: updateAuthError } = await admin.auth.admin.updateUserById(input.userId, {
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: withMustChangePassword(
      {
        ...authData.user.app_metadata,
        client_id: authData.user.app_metadata?.client_id ?? profile.client_id,
      },
      true
    ),
  });
  if (updateAuthError) throw new Error(updateAuthError.message);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", input.userId);
  if (updateError) throw new Error(updateError.message);

  revalidatePersonnel(input.userId);
  return { password: temporaryPassword };
}

export async function updatePersonnelProfile(input: {
  userId: string;
  firstName: string;
  lastName: string;
  rank: string | null;
  jobTitle: string | null;
  swingUp: string[];
  rankPromotedOn: string | null;
  employeeNumber: string | null;
  phone: string | null;
  hireDate: string | null;
  shift: "red" | "blue" | "green" | "white" | null;
  homeAddress: string | null;
  emergencyContacts: string | null;
  hrInfo: string | null;
  anniversary: string | null;
  spouseName: string | null;
  spouseBirthday: string | null;
  kidsBirthdays: string | null;
  primaryLocationId: string | null;
  supervisorId: string | null;
  permissionLevelIds: string[];
  isAdmin: boolean;
  section?: string | null;
}) {
  const admin = await requireAdmin();
  if (input.userId === admin.id && !input.isAdmin) {
    throw new Error("You cannot remove your own system admin access.");
  }
  if (input.supervisorId && input.supervisorId === input.userId) {
    throw new Error("A person cannot be their own supervisor.");
  }

  const firstName = input.firstName.trim() || null;
  const lastName = input.lastName.trim() || null;
  const displayName = composePersonnelDisplayName(firstName, lastName);
  const rank = input.rank?.trim() || null;
  const jobTitle = rankHasTitle(rank) ? input.jobTitle?.trim() || null : null;
  const hireDate = input.hireDate || null;
  const rankPromotedOn = isTitleOnlyRank(rank)
    ? null
    : effectiveRankPromotedOn(rank, input.rankPromotedOn || null, hireDate);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      first_name: firstName,
      last_name: lastName,
      rank,
      job_title: jobTitle,
      swing_up: (() => {
        const allowed = new Set<string>(swingUpRanks);
        const selected = input.swingUp
          .map((r) => r.trim())
          .filter((r) => r && allowed.has(r));
        const order = new Map<string, number>(swingUpRanks.map((rank, index) => [rank, index]));
        return [...selected].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
      })(),
      rank_promoted_on: rankPromotedOn,
      employee_number: input.employeeNumber?.trim() || null,
      phone: input.phone ? formatPhoneInput(input.phone.trim()) || null : null,
      hire_date: hireDate,
      shift: input.shift,
      home_address: input.homeAddress
        ? serializePostalAddress(parsePostalAddress(input.homeAddress))
        : null,
      emergency_contacts: input.emergencyContacts?.trim() || null,
      hr_info: input.hrInfo?.trim() || null,
      anniversary: input.anniversary || null,
      spouse_name: input.spouseName?.trim() || null,
      spouse_birthday: input.spouseBirthday || null,
      kids_birthdays: input.kidsBirthdays?.trim() || null,
      primary_location_id: input.primaryLocationId || null,
      supervisor_id: input.supervisorId || null,
      is_admin: input.isAdmin,
    })
    .eq("id", input.userId);

  throwIfDbError(error);
  await replaceProfilePermissionLevels(supabase, {
    profileId: input.userId,
    clientId: admin.client_id,
    permissionLevelIds: input.permissionLevelIds,
  });
  revalidatePersonnel(input.userId);
  redirect(personnelFilePath(input.userId, input.section));
}

export async function setPersonnelActive(input: {
  userId: string;
  isActive: boolean;
  section?: string | null;
}) {
  const admin = await requireAdmin();
  if (input.userId === admin.id) {
    throw new Error("You cannot deactivate your own account.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: input.isActive })
    .eq("id", input.userId);
  throwIfDbError(error);

  const service = createSupabaseServiceClient();
  const { error: banError } = await service.auth.admin.updateUserById(input.userId, {
    ban_duration: input.isActive ? "none" : "876000h",
  });
  if (banError) {
    // Roll back profile flag if auth ban/unban failed
    await supabase.from("profiles").update({ is_active: !input.isActive }).eq("id", input.userId);
    throw new Error(banError.message);
  }

  revalidatePersonnel(input.userId);
  redirect(personnelFilePath(input.userId, input.section));
}

export async function deletePersonnelMember(input: { userId: string }) {
  const admin = await requireAdmin();
  if (input.userId === admin.id) {
    throw new Error("You cannot delete your own account.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: target, error: lookupError } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name, email")
    .eq("id", input.userId)
    .maybeSingle();
  throwIfDbError(lookupError);
  if (!target) throw new Error("User not found.");

  // Auth delete cascades to profiles; RESTRICT FKs (e.g. maintenance, shift exchange) will block.
  const service = createSupabaseServiceClient();
  const { error: deleteError } = await service.auth.admin.deleteUser(input.userId);
  if (deleteError) {
    const message = deleteError.message || "Failed to delete user.";
    if (/foreign key|restrict|violates|referenced|database error deleting user/i.test(message)) {
      throw new Error(
        "This user cannot be deleted because other records still reference them. Deactivate the account instead."
      );
    }
    throw new Error(message);
  }

  revalidatePersonnel();
  redirect("/personnel");
}

export async function createPersonnelNote(input: {
  profileId: string;
  body: string;
}) {
  const admin = await requireAdmin();
  const body = input.body.trim();
  if (!body) throw new Error("Note text is required.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("personnel_notes").insert({
    profile_id: input.profileId,
    body,
    created_by: admin.id,
  });
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function deletePersonnelNote(input: { id: string; profileId: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("personnel_notes").delete().eq("id", input.id);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function createPersonnelCertification(input: {
  profileId: string;
  name: string;
  issuingAuthority?: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const admin = await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Certification name is required.");

  const hasFile = Boolean(input.fileName?.trim());
  const fileName = hasFile ? sanitizePersonnelFileName(input.fileName!) : null;
  if (hasFile && !fileName) throw new Error("File name is required.");

  const certificationId = crypto.randomUUID();
  const storagePath =
    hasFile && fileName
      ? buildPersonnelCertificationStoragePath(input.profileId, certificationId, fileName)
      : null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("personnel_certifications").insert({
    id: certificationId,
    profile_id: input.profileId,
    name,
    issuing_authority: input.issuingAuthority?.trim() || null,
    issued_on: input.issuedOn || null,
    expires_on: input.expiresOn || null,
    notes: input.notes?.trim() || null,
    file_name: fileName,
    storage_path: storagePath,
    mime_type: hasFile ? input.mimeType?.trim() || null : null,
    created_by: admin.id,
  });
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
  return { certificationId, storagePath };
}

export async function updatePersonnelCertification(input: {
  id: string;
  profileId: string;
  name: string;
  issuingAuthority?: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
  /** When set with fileName, attach or replace the certification file. */
  fileName?: string | null;
  mimeType?: string | null;
  /** When true, remove any attached file. */
  removeFile?: boolean;
}) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Certification name is required.");

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("personnel_certifications")
    .select("id, storage_path")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Certification not found.");

  const patch: Record<string, string | null> = {
    name,
    issuing_authority: input.issuingAuthority?.trim() || null,
    issued_on: input.issuedOn || null,
    expires_on: input.expiresOn || null,
    notes: input.notes?.trim() || null,
  };

  let storagePath: string | null = null;
  const attachingFile = Boolean(input.fileName?.trim()) && !input.removeFile;

  if (input.removeFile || attachingFile) {
    if (existing.storage_path) {
      await supabase.storage.from(PERSONNEL_DOCUMENTS_BUCKET).remove([existing.storage_path]);
    }
    if (input.removeFile) {
      patch.file_name = null;
      patch.storage_path = null;
      patch.mime_type = null;
    } else if (attachingFile) {
      const fileName = sanitizePersonnelFileName(input.fileName!);
      if (!fileName) throw new Error("File name is required.");
      storagePath = buildPersonnelCertificationStoragePath(input.profileId, input.id, fileName);
      patch.file_name = fileName;
      patch.storage_path = storagePath;
      patch.mime_type = input.mimeType?.trim() || null;
    }
  }

  const { error } = await supabase
    .from("personnel_certifications")
    .update(patch)
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
  return { storagePath };
}

export async function deletePersonnelCertification(input: {
  id: string;
  profileId: string;
  storagePath?: string | null;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  let storagePath = input.storagePath ?? null;
  if (!storagePath) {
    const { data, error: fetchError } = await supabase
      .from("personnel_certifications")
      .select("storage_path")
      .eq("id", input.id)
      .eq("profile_id", input.profileId)
      .maybeSingle();
    throwIfDbError(fetchError);
    storagePath = data?.storage_path ?? null;
  }

  if (storagePath) {
    await supabase.storage.from(PERSONNEL_DOCUMENTS_BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from("personnel_certifications")
    .delete()
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function getPersonnelCertificationDownloadUrl(input: {
  id: string;
  profileId: string;
}) {
  const profile = await requireUserProfile();
  if (!profile.is_admin && profile.id !== input.profileId) {
    throw new Error("Not allowed to download this certification.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: cert, error } = await supabase
    .from("personnel_certifications")
    .select("storage_path, profile_id")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(error);
  if (!cert?.storage_path) throw new Error("Certification file not found.");

  const { data, error: signedError } = await supabase.storage
    .from(PERSONNEL_DOCUMENTS_BUCKET)
    .createSignedUrl(cert.storage_path, 60);
  if (signedError) throw new Error(signedError.message);
  if (!data?.signedUrl) throw new Error("Could not create download link.");
  return { url: data.signedUrl };
}

export async function createPersonnelQualification(input: {
  profileId: string;
  qualificationId: string;
  earnedOn?: string;
  expiresOn?: string;
  notes?: string;
}) {
  const admin = await requireAdmin();
  const qualificationId = input.qualificationId.trim();
  if (!qualificationId) throw new Error("Select a qualification.");

  const supabase = await createSupabaseServerClient();

  const { data: qualification, error: qualificationError } = await supabase
    .from("qualifications")
    .select("id, is_active")
    .eq("id", qualificationId)
    .maybeSingle();
  throwIfDbError(qualificationError);
  if (!qualification) throw new Error("Qualification not found.");
  if (!qualification.is_active) throw new Error("That qualification is inactive.");

  const { error } = await supabase.from("personnel_qualifications").insert({
    profile_id: input.profileId,
    qualification_id: qualificationId,
    earned_on: input.earnedOn || null,
    expires_on: input.expiresOn || null,
    notes: input.notes?.trim() || null,
    created_by: admin.id,
  });
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function updatePersonnelQualification(input: {
  id: string;
  profileId: string;
  qualificationId: string;
  earnedOn?: string;
  expiresOn?: string;
  notes?: string;
}) {
  await requireAdmin();
  const qualificationId = input.qualificationId.trim();
  if (!qualificationId) throw new Error("Select a qualification.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("personnel_qualifications")
    .select("id, qualification_id")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Qualification assignment not found.");

  const { data: qualification, error: qualificationError } = await supabase
    .from("qualifications")
    .select("id, is_active")
    .eq("id", qualificationId)
    .maybeSingle();
  throwIfDbError(qualificationError);
  if (!qualification) throw new Error("Qualification not found.");
  if (!qualification.is_active && qualification.id !== existing.qualification_id) {
    throw new Error("That qualification is inactive.");
  }

  const { error } = await supabase
    .from("personnel_qualifications")
    .update({
      qualification_id: qualificationId,
      earned_on: input.earnedOn || null,
      expires_on: input.expiresOn || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function deletePersonnelQualification(input: { id: string; profileId: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personnel_qualifications")
    .delete()
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function setPersonnelEmsClearance(input: {
  profileId: string;
  clearanceLevelId: string | null;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const clearanceLevelId = input.clearanceLevelId?.trim() || null;

  if (clearanceLevelId) {
    const [{ data: level, error: levelError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("ems_clearance_levels")
          .select("id, is_active")
          .eq("id", clearanceLevelId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("ems_cleared_level_id")
          .eq("id", input.profileId)
          .maybeSingle(),
      ]);
    throwIfDbError(levelError);
    throwIfDbError(profileError);
    if (!level) throw new Error("EMS clearance level not found.");
    if (!level.is_active && level.id !== profile?.ems_cleared_level_id) {
      throw new Error("That clearance level is inactive.");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ems_cleared_level_id: clearanceLevelId })
    .eq("id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function createPersonnelEmsLicense(input: {
  profileId: string;
  emsLevelId: string;
  issuedOn?: string;
  expiresOn?: string;
  licenseNumber?: string;
  notes?: string;
}) {
  const admin = await requireAdmin();
  const emsLevelId = input.emsLevelId.trim();
  if (!emsLevelId) throw new Error("Select an EMS level.");

  const supabase = await createSupabaseServerClient();

  const { data: level, error: levelError } = await supabase
    .from("ems_levels")
    .select("id, is_active")
    .eq("id", emsLevelId)
    .maybeSingle();
  throwIfDbError(levelError);
  if (!level) throw new Error("EMS level not found.");
  if (!level.is_active) throw new Error("That EMS level is inactive.");

  const { error } = await supabase.from("personnel_ems_licenses").insert({
    profile_id: input.profileId,
    ems_level_id: emsLevelId,
    issued_on: input.issuedOn || null,
    expires_on: input.expiresOn || null,
    license_number: input.licenseNumber?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: admin.id,
  });
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function updatePersonnelEmsLicense(input: {
  id: string;
  profileId: string;
  emsLevelId: string;
  issuedOn?: string;
  expiresOn?: string;
  licenseNumber?: string;
  notes?: string;
}) {
  await requireAdmin();
  const emsLevelId = input.emsLevelId.trim();
  if (!emsLevelId) throw new Error("Select an EMS level.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("personnel_ems_licenses")
    .select("id, ems_level_id")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("EMS license not found.");

  const { data: level, error: levelError } = await supabase
    .from("ems_levels")
    .select("id, is_active")
    .eq("id", emsLevelId)
    .maybeSingle();
  throwIfDbError(levelError);
  if (!level) throw new Error("EMS level not found.");
  if (!level.is_active && level.id !== existing.ems_level_id) {
    throw new Error("That EMS level is inactive.");
  }

  const { error } = await supabase
    .from("personnel_ems_licenses")
    .update({
      ems_level_id: emsLevelId,
      issued_on: input.issuedOn || null,
      expires_on: input.expiresOn || null,
      license_number: input.licenseNumber?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function deletePersonnelEmsLicense(input: { id: string; profileId: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personnel_ems_licenses")
    .delete()
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function createPersonnelRecognition(input: {
  profileId: string;
  awardId: string;
  awardedOn?: string;
  notes?: string;
}) {
  const admin = await requireAdmin();
  if (!isRecognitionAwardId(input.awardId)) {
    throw new Error("Select a valid award.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("personnel_recognitions").insert({
    profile_id: input.profileId,
    award_id: input.awardId,
    awarded_on: input.awardedOn || null,
    notes: input.notes?.trim() || null,
    created_by: admin.id,
  });
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function updatePersonnelRecognition(input: {
  id: string;
  profileId: string;
  awardId: string;
  awardedOn?: string;
  notes?: string;
}) {
  await requireAdmin();
  if (!isRecognitionAwardId(input.awardId)) {
    throw new Error("Select a valid award.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personnel_recognitions")
    .update({
      award_id: input.awardId,
      awarded_on: input.awardedOn || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function deletePersonnelRecognition(input: { id: string; profileId: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personnel_recognitions")
    .delete()
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function createPersonnelDocument(input: {
  profileId: string;
  title: string;
  fileName: string;
  mimeType?: string | null;
}) {
  const admin = await requireAdmin();
  const title = input.title.trim();
  if (!title) throw new Error("Document title is required.");
  const fileName = sanitizePersonnelFileName(input.fileName);
  if (!fileName) throw new Error("File name is required.");

  const supabase = await createSupabaseServerClient();
  const documentId = crypto.randomUUID();
  const storagePath = buildPersonnelDocumentStoragePath(input.profileId, documentId, fileName);

  const { error } = await supabase.from("personnel_documents").insert({
    id: documentId,
    profile_id: input.profileId,
    title,
    file_name: fileName,
    storage_path: storagePath,
    mime_type: input.mimeType?.trim() || null,
    uploaded_by: admin.id,
  });
  throwIfDbError(error);

  revalidatePersonnel(input.profileId);
  return { documentId, storagePath };
}

export async function deletePersonnelDocument(input: {
  id: string;
  profileId: string;
  storagePath: string;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  if (input.storagePath) {
    await supabase.storage.from(PERSONNEL_DOCUMENTS_BUCKET).remove([input.storagePath]);
  }

  const { error } = await supabase
    .from("personnel_documents")
    .delete()
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function getPersonnelDocumentDownloadUrl(input: {
  id: string;
  profileId: string;
}) {
  const profile = await requireUserProfile();
  if (!profile.is_admin && profile.id !== input.profileId) {
    throw new Error("Not allowed to download this document.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: doc, error } = await supabase
    .from("personnel_documents")
    .select("storage_path, profile_id")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(error);
  if (!doc) throw new Error("Document not found.");

  const { data, error: signedError } = await supabase.storage
    .from(PERSONNEL_DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, 60);
  if (signedError) throw new Error(signedError.message);
  if (!data?.signedUrl) throw new Error("Could not create download link.");
  return { url: data.signedUrl };
}

export async function assignProgramToUser(input: { userId: string; programId: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: programModuleRows, error: moduleError } = await supabase
    .from("program_modules")
    .select("module_id")
    .eq("program_id", input.programId);
  throwIfDbError(moduleError);

  const moduleIds = (programModuleRows ?? []).map((row) => row.module_id);
  if (moduleIds.length === 0) {
    throw new Error("This program has no modules to enroll in.");
  }

  const enrolledAt = new Date().toISOString();
  const { error } = await supabase.from("module_enrollments").upsert(
    moduleIds.map((moduleId) => ({
      module_id: moduleId,
      user_id: input.userId,
      enrolled_at: enrolledAt,
    })),
    { onConflict: "module_id,user_id" }
  );
  throwIfDbError(error);

  revalidatePersonnel(input.userId);
  revalidatePath("/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
}

export async function unassignProgramFromUser(input: { userId: string; programId: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: programModuleRows, error: moduleError } = await supabase
    .from("program_modules")
    .select("module_id")
    .eq("program_id", input.programId);
  throwIfDbError(moduleError);

  const moduleIds = (programModuleRows ?? []).map((row) => row.module_id);
  if (moduleIds.length === 0) return;

  const { error } = await supabase
    .from("module_enrollments")
    .delete()
    .eq("user_id", input.userId)
    .in("module_id", moduleIds);
  throwIfDbError(error);

  revalidatePersonnel(input.userId);
  revalidatePath("/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
}

export async function assignModuleToUser(input: { userId: string; moduleId: string; programId?: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("module_enrollments").upsert(
    {
      module_id: input.moduleId,
      user_id: input.userId,
      enrolled_at: new Date().toISOString(),
    },
    { onConflict: "module_id,user_id" }
  );
  throwIfDbError(error);

  revalidatePersonnel(input.userId);
  revalidatePath("/programs");
  revalidatePath("/programs");
  if (input.programId) revalidatePath(`/programs/${input.programId}`);
}

export async function unassignModuleFromUser(input: {
  userId: string;
  moduleId: string;
  programId?: string;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("module_enrollments")
    .delete()
    .eq("module_id", input.moduleId)
    .eq("user_id", input.userId);
  throwIfDbError(error);

  revalidatePersonnel(input.userId);
  revalidatePath("/programs");
  revalidatePath("/programs");
  if (input.programId) revalidatePath(`/programs/${input.programId}`);
}

function assertTaskbookRank(rank: string) {
  if (!(taskbookRanks as readonly string[]).includes(rank)) {
    throw new Error("Invalid taskbook rank.");
  }
  return rank;
}

async function requireTaskbookDecider(profileId: string) {
  const viewer = await requireUserProfile();
  if (isAdmin(viewer)) return viewer;

  const supabase = await createSupabaseServerClient();
  const { data: target, error } = await supabase
    .from("profiles")
    .select("id, supervisor_id, shift")
    .eq("id", profileId)
    .maybeSingle();
  throwIfDbError(error);
  if (!target) throw new Error("Person not found.");
  if (!isPersonnelSupervisorOf(viewer, target)) {
    throw new Error("Only this person's supervisor or a system admin can do that.");
  }
  return viewer;
}

async function grantSwingUpForRank(profileId: string, rank: string) {
  if (!(swingUpRanks as readonly string[]).includes(rank)) return;

  const admin = createSupabaseServiceClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("swing_up")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Person not found.");

  const current = normalizeSwingUpRanks(profile.swing_up);
  if (current.includes(rank)) return;

  const allowed = new Set<string>(swingUpRanks);
  const next = [...current, rank].filter((r) => allowed.has(r));
  const order = new Map<string, number>(swingUpRanks.map((r, i) => [r, i]));
  next.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));

  const { error: updateError } = await admin
    .from("profiles")
    .update({ swing_up: next })
    .eq("id", profileId);
  if (updateError) throw new Error(updateError.message);
}

export async function requestPersonnelTaskbook(input: {
  rank: string;
  notes?: string;
}) {
  const viewer = await requireUserProfile();
  const rank = assertTaskbookRank(input.rank);
  if ((autoIssuedTaskbooks as readonly string[]).includes(rank)) {
    throw new Error("The Firefighter taskbook is issued automatically upon hire.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, supervisor_id, shift")
    .eq("id", viewer.id)
    .maybeSingle();
  throwIfDbError(profileError);
  if (!profile) throw new Error("Person not found.");

  const { hasSupervisor, error: coverageError } = await personHasSupervisorCoverage(
    supabase,
    profile
  );
  throwIfDbError(coverageError);
  if (!hasSupervisor) {
    throw new Error(
      "You need an assigned captain supervisor or a Battalion Chief on your shift before requesting a taskbook."
    );
  }

  const { error } = await supabase.from("personnel_taskbooks").insert({
    profile_id: viewer.id,
    rank,
    status: "requested",
    notes: input.notes?.trim() || null,
    requested_by: viewer.id,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("You already have an open taskbook request or active book for that rank.");
    }
    throwIfDbError(error);
  }

  revalidatePersonnel(viewer.id);
  if (profile.supervisor_id) revalidatePersonnel(profile.supervisor_id);
  if (profile.shift) {
    const { ids: bcIds } = await listShiftBattalionChiefIds(
      supabase,
      profile.shift as PersonnelShift,
      viewer.id
    );
    for (const bcId of bcIds) revalidatePersonnel(bcId);
  }
  revalidatePath("/personnel/supervisor");
}

export async function approvePersonnelTaskbook(input: { id: string; profileId: string }) {
  const decider = await requireTaskbookDecider(input.profileId);
  const supabase = await createSupabaseServerClient();

  const { data: row, error: lookupError } = await supabase
    .from("personnel_taskbooks")
    .select("id, status")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(lookupError);
  if (!row) throw new Error("Taskbook not found.");
  if (row.status !== "requested") throw new Error("Only requested taskbooks can be approved.");

  const approvedOn = new Date().toISOString().slice(0, 10);
  const dueOn = addYearsToDate(approvedOn, 1);

  const { error } = await supabase
    .from("personnel_taskbooks")
    .update({
      status: "active",
      approved_on: approvedOn,
      due_on: dueOn,
      denied_on: null,
      denial_reason: null,
      decided_by: decider.id,
    })
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);

  revalidatePersonnel(input.profileId);
  revalidatePersonnel(decider.id);
  revalidatePath("/personnel/supervisor");
}

export async function denyPersonnelTaskbook(input: {
  id: string;
  profileId: string;
  reason?: string;
}) {
  const decider = await requireTaskbookDecider(input.profileId);
  const supabase = await createSupabaseServerClient();

  const { data: row, error: lookupError } = await supabase
    .from("personnel_taskbooks")
    .select("id, status")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(lookupError);
  if (!row) throw new Error("Taskbook not found.");
  if (row.status !== "requested") throw new Error("Only requested taskbooks can be denied.");

  const { error } = await supabase
    .from("personnel_taskbooks")
    .update({
      status: "denied",
      denied_on: new Date().toISOString().slice(0, 10),
      denial_reason: input.reason?.trim() || null,
      decided_by: decider.id,
    })
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);

  revalidatePersonnel(input.profileId);
  revalidatePersonnel(decider.id);
  revalidatePath("/personnel/supervisor");
}

export async function issuePersonnelTaskbook(input: {
  profileId: string;
  rank: string;
  approvedOn?: string;
  dueOn?: string;
  notes?: string;
}) {
  const admin = await requireAdmin();
  const rank = assertTaskbookRank(input.rank);
  const approvedOn = input.approvedOn || new Date().toISOString().slice(0, 10);
  const dueOn = input.dueOn || addYearsToDate(approvedOn, 1);
  if (dueOn < approvedOn) throw new Error("Due date must be on or after the approval date.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("personnel_taskbooks").insert({
    profile_id: input.profileId,
    rank,
    status: "active",
    approved_on: approvedOn,
    due_on: dueOn,
    notes: input.notes?.trim() || null,
    requested_by: admin.id,
    decided_by: admin.id,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("This person already has an open request or active taskbook for that rank.");
    }
    throwIfDbError(error);
  }

  revalidatePersonnel(input.profileId);
}

export async function completePersonnelTaskbook(input: {
  id: string;
  profileId: string;
  completedOn?: string;
}) {
  await requireTaskbookDecider(input.profileId);
  const supabase = await createSupabaseServerClient();

  const { data: row, error: lookupError } = await supabase
    .from("personnel_taskbooks")
    .select("id, status, rank")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(lookupError);
  if (!row) throw new Error("Taskbook not found.");
  if (row.status !== "active") throw new Error("Only active taskbooks can be completed.");

  const completedOn = input.completedOn || new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("personnel_taskbooks")
    .update({
      status: "completed",
      completed_on: completedOn,
    })
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);

  await grantSwingUpForRank(input.profileId, row.rank);
  revalidatePersonnel(input.profileId);
  revalidatePath("/personnel/supervisor");
}

export async function updatePersonnelTaskbookCompletedOn(input: {
  id: string;
  profileId: string;
  completedOn: string;
}) {
  await requireAdmin();
  const completedOn = input.completedOn.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(completedOn)) {
    throw new Error("Enter a valid completion date.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error: lookupError } = await supabase
    .from("personnel_taskbooks")
    .select("id, status")
    .eq("id", input.id)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  throwIfDbError(lookupError);
  if (!row) throw new Error("Taskbook not found.");
  if (row.status !== "completed") {
    throw new Error("Only completed taskbooks have a completion date to adjust.");
  }

  const { error } = await supabase
    .from("personnel_taskbooks")
    .update({ completed_on: completedOn })
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);

  revalidatePersonnel(input.profileId);
  revalidatePath("/personnel/supervisor");
}

export async function deletePersonnelTaskbook(input: { id: string; profileId: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personnel_taskbooks")
    .delete()
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function setPersonnelTaskbookPrerequisiteCheck(input: {
  rank: string;
  prerequisiteId: string;
  checked: boolean;
}) {
  const viewer = await requireUserProfile();
  const rank = assertTaskbookRank(input.rank);
  const prerequisiteId = input.prerequisiteId.trim();
  if (!prerequisiteId) throw new Error("Invalid prerequisite.");

  const items = getTaskbookPrerequisites(rank);
  if (!items.some((item) => item.id === prerequisiteId)) {
    throw new Error("Unknown prerequisite for that taskbook.");
  }

  const supabase = await createSupabaseServerClient();

  if (input.checked) {
    const { error } = await supabase.from("personnel_taskbook_prerequisite_checks").upsert(
      {
        profile_id: viewer.id,
        rank,
        prerequisite_id: prerequisiteId,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,rank,prerequisite_id" }
    );
    throwIfDbError(error);
  } else {
    const { error } = await supabase
      .from("personnel_taskbook_prerequisite_checks")
      .delete()
      .eq("profile_id", viewer.id)
      .eq("rank", rank)
      .eq("prerequisite_id", prerequisiteId);
    throwIfDbError(error);
  }

  revalidatePersonnel(viewer.id);
}
