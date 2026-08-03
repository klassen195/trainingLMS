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
  buildPersonnelDocumentStoragePath,
  PERSONNEL_DOCUMENTS_BUCKET,
  sanitizePersonnelFileName,
} from "@/lib/personnel-types";
import type { UserRole } from "@/lib/training-lms-types";
import { normalizeAuthEmail } from "@/lib/auth-messages";

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

export async function invitePersonnelMember(input: {
  email: string;
  displayName?: string;
  role?: UserRole;
}) {
  await requireAdmin();

  const email = normalizeAuthEmail(input.email);
  if (!email) throw new Error("Enter a valid email address.");

  const displayName = input.displayName?.trim() || null;
  const role = input.role ?? "firefighter";

  const admin = createSupabaseServiceClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: displayName ? { display_name: displayName } : undefined,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Invite failed — no user returned.");

  const userId = data.user.id;

  // Profile is created by handle_new_user; patch org/access fields via service role
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      display_name: displayName,
      email,
      role,
    })
    .eq("id", userId);

  if (updateError) {
    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: userId,
        display_name: displayName,
        email,
        role,
      },
      { onConflict: "id" }
    );
    if (upsertError) throw new Error(upsertError.message);
  }

  revalidatePersonnel(userId);
  redirect(`/personnel/${userId}`);
}

export async function updatePersonnelProfile(input: {
  userId: string;
  displayName: string;
  rank: string | null;
  employeeNumber: string | null;
  phone: string | null;
  hireDate: string | null;
  shift: "red" | "blue" | "green" | "white" | null;
  homeAddress: string | null;
  emergencyContacts: string | null;
  hrInfo: string | null;
  primaryLocationId: string | null;
  supervisorId: string | null;
  role: UserRole;
  isAdmin: boolean;
}) {
  const admin = await requireAdmin();
  if (input.userId === admin.id && !input.isAdmin) {
    throw new Error("You cannot remove your own system admin access.");
  }
  if (input.supervisorId && input.supervisorId === input.userId) {
    throw new Error("A person cannot be their own supervisor.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName.trim() || null,
      rank: input.rank?.trim() || null,
      employee_number: input.employeeNumber?.trim() || null,
      phone: input.phone?.trim() || null,
      hire_date: input.hireDate || null,
      shift: input.shift,
      home_address: input.homeAddress?.trim() || null,
      emergency_contacts: input.emergencyContacts?.trim() || null,
      hr_info: input.hrInfo?.trim() || null,
      primary_location_id: input.primaryLocationId || null,
      supervisor_id: input.supervisorId || null,
      role: input.role,
      is_admin: input.isAdmin,
    })
    .eq("id", input.userId);

  throwIfDbError(error);
  revalidatePersonnel(input.userId);
  redirect(`/personnel/${input.userId}`);
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
}) {
  const admin = await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Certification name is required.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("personnel_certifications").insert({
    profile_id: input.profileId,
    name,
    issuing_authority: input.issuingAuthority?.trim() || null,
    issued_on: input.issuedOn || null,
    expires_on: input.expiresOn || null,
    notes: input.notes?.trim() || null,
    created_by: admin.id,
  });
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function updatePersonnelCertification(input: {
  id: string;
  profileId: string;
  name: string;
  issuingAuthority?: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
}) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Certification name is required.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personnel_certifications")
    .update({
      name,
      issuing_authority: input.issuingAuthority?.trim() || null,
      issued_on: input.issuedOn || null,
      expires_on: input.expiresOn || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id)
    .eq("profile_id", input.profileId);
  throwIfDbError(error);
  revalidatePersonnel(input.profileId);
}

export async function deletePersonnelCertification(input: { id: string; profileId: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personnel_certifications")
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
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
  revalidatePath("/programs");
  if (input.programId) revalidatePath(`/programs/${input.programId}`);
}
