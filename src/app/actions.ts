"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatAuthError, normalizeAuthEmail } from "@/lib/auth-messages";
import {
  userMustChangePassword,
  validateNewPassword,
  withMustChangePassword,
} from "@/lib/auth-password";
import { normalizeClientCode } from "@/lib/clients";
import { assertClientMembership, resolveClientIdByCode } from "@/lib/clients-server";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables, supabaseErrorMessage } from "@/lib/supabase/errors";
import { programTags } from "@/lib/labels";
import type { ProgramStatus, ProgramTag } from "@/lib/training-lms-types";
import { buildModuleResourceStoragePath, normalizeWebsiteUrl, parseYouTubeVideoId } from "@/lib/module-resources";
import { scorePercent, shuffleArray } from "@/lib/quiz";
import { assertCapability } from "@/lib/capability-access";
import { replaceProfilePermissionLevels } from "@/lib/permission-levels";
import type { ModuleResourceType } from "@/lib/training-lms-types";

function throwIfDbError(error: import("@supabase/supabase-js").PostgrestError | null) {
  if (!error) return;
  if (isMissingTrainingLmsTables(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260623120000_training_lms_schema.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

async function requireAuthUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Not authenticated");
  if (userMustChangePassword(user)) {
    throw new Error("Set a new password before continuing.");
  }
  return { supabase, userId: user.id };
}

async function requireAdminUser() {
  const { supabase, userId } = await requireAuthUserId();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();
  throwIfDbError(error);
  if (!profile?.is_admin) throw new Error("Admin access required");
  return { supabase, userId };
}

async function requireQuizBankManager() {
  const profile = await assertCapability("manage_quiz_banks");
  const supabase = await createSupabaseServerClient();
  return { supabase, userId: profile.id };
}

function revalidateModuleViews(programId: string, moduleId: string) {
  revalidatePath(`/programs/${programId}/modules/${moduleId}`, "layout");
  revalidatePath(`/programs/${programId}/modules/${moduleId}`);
}

async function requireModuleEnrollment(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  moduleId: string
) {
  const { data } = await supabase
    .from("module_enrollments")
    .select("id")
    .eq("module_id", moduleId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Enroll in this module to track progress");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function parseAuthEmail(email: string) {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) {
    return { error: "Enter your email address." as const };
  }
  return { email: normalized };
}

function parseAuthOrigin(origin: string) {
  try {
    return { origin: new URL(origin) };
  } catch {
    return { error: "Invalid request origin." as const };
  }
}

function parseClientCode(clientCode: string) {
  const normalized = normalizeClientCode(clientCode);
  if (!normalized) {
    return { error: "Enter your Client ID." as const };
  }
  return { clientCode: normalized };
}

async function ensureSessionMatchesClient(clientCode: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign-in failed. Try again." as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("client_id")
    .eq("id", user.id)
    .maybeSingle();

  const membership = await assertClientMembership({
    profileClientId: profile?.client_id,
    clientCode,
  });
  if ("error" in membership) {
    await supabase.auth.signOut();
    return { error: membership.error };
  }
  return {
    success: true as const,
    clientId: membership.clientId,
    mustChangePassword: userMustChangePassword(user),
  };
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  clientCode: string;
}) {
  const emailResult = parseAuthEmail(input.email);
  if ("error" in emailResult) return emailResult;

  const codeResult = parseClientCode(input.clientCode);
  if ("error" in codeResult) return codeResult;

  if (!input.password) {
    return { error: "Enter your password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailResult.email,
    password: input.password,
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  return ensureSessionMatchesClient(codeResult.clientCode);
}

export async function requestPasswordReset(input: {
  email: string;
  origin: string;
  clientCode: string;
}) {
  const emailResult = parseAuthEmail(input.email);
  if ("error" in emailResult) return emailResult;

  const originResult = parseAuthOrigin(input.origin);
  if ("error" in originResult) return originResult;

  const codeResult = parseClientCode(input.clientCode);
  if ("error" in codeResult) return codeResult;

  const clientId = await resolveClientIdByCode(codeResult.clientCode);
  if (!clientId) {
    return { error: "Invalid Client ID. Check the code from your administrator." };
  }

  const supabase = await createSupabaseServerClient();
  const redirect = new URL("/auth/callback", originResult.origin.origin);
  redirect.searchParams.set("next", "/account");
  redirect.searchParams.set("client", codeResult.clientCode);

  const { error } = await supabase.auth.resetPasswordForEmail(emailResult.email, {
    redirectTo: redirect.toString(),
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  return { success: true as const };
}

export async function setAccountPassword(input: { password: string; confirmPassword: string }) {
  const passwordError = validateNewPassword(input.password, input.confirmPassword);
  if (passwordError) return { error: passwordError };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) return { error: formatAuthError(userError.message) };
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    return { error: formatAuthError(error.message) };
  }

  if (userMustChangePassword(user)) {
    const admin = createSupabaseServiceClient();
    const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: withMustChangePassword(user.app_metadata, false),
    });
    if (metaError) return { error: formatAuthError(metaError.message) };
    await supabase.auth.refreshSession();
  }

  revalidatePath("/account");
  revalidatePath("/account/change-password");
  return { success: true as const };
}

export async function enrollInModule(input: { programId: string; moduleId: string }) {
  await assertCapability("self_enroll");
  const { supabase, userId } = await requireAuthUserId();
  const { error } = await supabase.from("module_enrollments").upsert(
    {
      module_id: input.moduleId,
      user_id: userId,
      enrolled_at: new Date().toISOString(),
    },
    { onConflict: "module_id,user_id" }
  );
  throwIfDbError(error);
  revalidatePath("/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function enrollInProgram(input: { programId: string }) {
  await assertCapability("self_enroll");
  const { supabase, userId } = await requireAuthUserId();

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
      user_id: userId,
      enrolled_at: enrolledAt,
    })),
    { onConflict: "module_id,user_id" }
  );
  throwIfDbError(error);

  revalidatePath("/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  for (const moduleId of moduleIds) {
    revalidateModuleViews(input.programId, moduleId);
  }
}

export async function unenrollFromModule(input: { programId: string; moduleId: string }) {
  const { supabase, userId } = await requireAuthUserId();
  const { error } = await supabase
    .from("module_enrollments")
    .delete()
    .eq("module_id", input.moduleId)
    .eq("user_id", userId);
  throwIfDbError(error);
  revalidatePath("/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function unenrollFromProgram(input: { programId: string }) {
  const { supabase, userId } = await requireAuthUserId();

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
    .eq("user_id", userId)
    .in("module_id", moduleIds);
  throwIfDbError(error);

  revalidatePath("/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  for (const moduleId of moduleIds) {
    revalidateModuleViews(input.programId, moduleId);
  }
}

export async function setModuleComplete(input: {
  programId: string;
  moduleId: string;
  completed: boolean;
}) {
  const { supabase, userId } = await requireAuthUserId();
  await requireModuleEnrollment(supabase, userId, input.moduleId);

  if (input.completed) {
    const { error } = await supabase.from("module_progress").upsert(
      {
        module_id: input.moduleId,
        user_id: userId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "module_id,user_id" }
    );
    throwIfDbError(error);
  } else {
    const { error } = await supabase
      .from("module_progress")
      .delete()
      .eq("module_id", input.moduleId)
      .eq("user_id", userId);
    throwIfDbError(error);
  }

  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function setResourceComplete(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
  completed: boolean;
}) {
  const { supabase, userId } = await requireAuthUserId();
  await requireModuleEnrollment(supabase, userId, input.moduleId);

  if (input.completed) {
    const { error } = await supabase.from("resource_progress").upsert(
      {
        resource_id: input.resourceId,
        user_id: userId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "resource_id,user_id" }
    );
    throwIfDbError(error);
  } else {
    const { error: resourceError } = await supabase
      .from("resource_progress")
      .delete()
      .eq("resource_id", input.resourceId)
      .eq("user_id", userId);
    throwIfDbError(resourceError);

    const { error: moduleError } = await supabase
      .from("module_progress")
      .delete()
      .eq("module_id", input.moduleId)
      .eq("user_id", userId);
    throwIfDbError(moduleError);
  }

  if (input.completed) {
    const { data: resources } = await supabase
      .from("module_resources")
      .select("id")
      .eq("module_id", input.moduleId);
    const resourceIds = (resources ?? []).map((row) => row.id);

    if (resourceIds.length > 0) {
      const { count } = await supabase
        .from("resource_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("resource_id", resourceIds);

      if (count === resourceIds.length) {
        const { error: moduleError } = await supabase.from("module_progress").upsert(
          {
            module_id: input.moduleId,
            user_id: userId,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "module_id,user_id" }
        );
        throwIfDbError(moduleError);
      }
    }
  }

  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, input.moduleId);
}

function normalizeProgramTags(tags: ProgramTag[]): ProgramTag[] {
  const unique = [...new Set(tags)].filter((tag) => programTags.includes(tag));
  if (unique.length === 0) {
    throw new Error("Select at least one tag");
  }
  return programTags.filter((tag) => unique.includes(tag));
}

export async function createProgram(input: {
  title: string;
  description: string;
  tags: ProgramTag[];
  status: ProgramStatus;
}) {
  const tags = normalizeProgramTags(input.tags);
  const { supabase, userId } = await requireAuthUserId();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      title: input.title,
      description: input.description || null,
      status: input.status,
      created_by: userId,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (!data) throw new Error("Failed to create program");

  const { error: tagsError } = await supabase.from("program_tags").insert(
    tags.map((tag) => ({
      program_id: data.id,
      tag,
    }))
  );
  throwIfDbError(tagsError);

  revalidatePath("/instructor");
  redirect(`/instructor/programs/${data.id}/edit`);
}

export async function updateProgram(input: {
  id: string;
  title: string;
  description: string;
  tags: ProgramTag[];
  status: ProgramStatus;
}) {
  const tags = normalizeProgramTags(input.tags);
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase
    .from("programs")
    .update({
      title: input.title,
      description: input.description || null,
      status: input.status,
    })
    .eq("id", input.id);
  throwIfDbError(error);

  const { error: deleteError } = await supabase.from("program_tags").delete().eq("program_id", input.id);
  throwIfDbError(deleteError);

  const { error: tagsError } = await supabase.from("program_tags").insert(
    tags.map((tag) => ({
      program_id: input.id,
      tag,
    }))
  );
  throwIfDbError(tagsError);

  revalidatePath("/instructor");
  revalidatePath(`/instructor/programs/${input.id}/edit`);
  revalidatePath(`/programs/${input.id}`);
}

export async function addModule(input: {
  programId: string;
  title: string;
  content: string;
  sortOrder: number;
}) {
  const { supabase, userId } = await requireAuthUserId();
  const moduleId = crypto.randomUUID();
  const { error: moduleError } = await supabase.from("modules").insert({
    id: moduleId,
    title: input.title,
    content: input.content,
    created_by: userId,
  });
  throwIfDbError(moduleError);

  const { error: linkError } = await supabase.from("program_modules").insert({
    program_id: input.programId,
    module_id: moduleId,
    sort_order: input.sortOrder,
  });
  throwIfDbError(linkError);
  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/instructor/programs/${input.programId}/modules/${moduleId}/edit`);
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, moduleId);
  return moduleId;
}

export async function linkModuleToProgram(input: {
  programId: string;
  moduleId: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase.from("program_modules").insert({
    program_id: input.programId,
    module_id: input.moduleId,
    sort_order: input.sortOrder,
  });
  throwIfDbError(error);
  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/programs/${input.programId}`);
}

export async function unlinkModuleFromProgram(input: { programId: string; moduleId: string }) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase
    .from("program_modules")
    .delete()
    .eq("program_id", input.programId)
    .eq("module_id", input.moduleId);
  throwIfDbError(error);
  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/programs/${input.programId}`);
}

export async function updateProgramModuleOrder(input: {
  programId: string;
  moduleId: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase
    .from("program_modules")
    .update({ sort_order: input.sortOrder })
    .eq("program_id", input.programId)
    .eq("module_id", input.moduleId);
  throwIfDbError(error);
  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/programs/${input.programId}`);
}

export async function reorderProgramModules(input: { programId: string; moduleIds: string[] }) {
  const { supabase } = await requireAuthUserId();

  for (let index = 0; index < input.moduleIds.length; index++) {
    const { error } = await supabase
      .from("program_modules")
      .update({ sort_order: index + 1 })
      .eq("program_id", input.programId)
      .eq("module_id", input.moduleIds[index]);
    throwIfDbError(error);
  }

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/programs/${input.programId}`);
}

export async function reorderModuleResources(input: {
  programId: string;
  moduleId: string;
  resourceIds: string[];
}) {
  const { supabase } = await requireAuthUserId();

  for (let index = 0; index < input.resourceIds.length; index++) {
    const { error } = await supabase
      .from("module_resources")
      .update({ sort_order: index + 1 })
      .eq("id", input.resourceIds[index])
      .eq("module_id", input.moduleId);
    throwIfDbError(error);
  }

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function updateModule(input: {
  programId: string;
  moduleId: string;
  title: string;
  content: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const { error: moduleError } = await supabase
    .from("modules")
    .update({
      title: input.title,
      content: input.content,
    })
    .eq("id", input.moduleId);
  throwIfDbError(moduleError);

  const { error: sortError } = await supabase
    .from("program_modules")
    .update({ sort_order: input.sortOrder })
    .eq("program_id", input.programId)
    .eq("module_id", input.moduleId);
  throwIfDbError(sortError);

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function prepareModuleResourceUpload(input: {
  programId: string;
  moduleId: string;
  title: string;
  resourceType: ModuleResourceType;
  fileName: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const resourceId = crypto.randomUUID();
  const storagePath = buildModuleResourceStoragePath(input.moduleId, resourceId, input.fileName);

  const { data, error } = await supabase
    .from("module_resources")
    .insert({
      id: resourceId,
      module_id: input.moduleId,
      title: input.title.trim(),
      resource_type: input.resourceType,
      storage_path: storagePath,
      file_name: input.fileName,
      sort_order: input.sortOrder,
    })
    .select("id, storage_path")
    .single();

  throwIfDbError(error);
  if (!data) throw new Error("Failed to create module resource");

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);

  return { resourceId: data.id as string, storagePath: data.storage_path as string };
}

export async function addModuleResourceYoutube(input: {
  programId: string;
  moduleId: string;
  title: string;
  youtubeUrl: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const videoId = parseYouTubeVideoId(input.youtubeUrl);
  if (!videoId) throw new Error("Enter a valid YouTube URL.");

  const { error } = await supabase.from("module_resources").insert({
    module_id: input.moduleId,
    title: input.title.trim(),
    resource_type: "youtube",
    storage_path: null,
    file_name: videoId,
    external_url: input.youtubeUrl.trim(),
    sort_order: input.sortOrder,
  });
  throwIfDbError(error);

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function addModuleResourceLink(input: {
  programId: string;
  moduleId: string;
  title: string;
  url: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const externalUrl = normalizeWebsiteUrl(input.url);
  if (!externalUrl) throw new Error("Enter a valid website URL.");

  const { error } = await supabase.from("module_resources").insert({
    module_id: input.moduleId,
    title: input.title.trim(),
    resource_type: "link",
    storage_path: null,
    file_name: null,
    external_url: externalUrl,
    sort_order: input.sortOrder,
  });
  throwIfDbError(error);

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function updateModuleResourceLink(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
  title: string;
  url: string;
}) {
  const { supabase } = await requireAuthUserId();
  const title = input.title.trim();
  const externalUrl = normalizeWebsiteUrl(input.url);
  if (!title) throw new Error("Enter a link title.");
  if (!externalUrl) throw new Error("Enter a valid website URL.");

  const { error } = await supabase
    .from("module_resources")
    .update({
      title,
      external_url: externalUrl,
    })
    .eq("id", input.resourceId)
    .eq("module_id", input.moduleId)
    .eq("resource_type", "link");
  throwIfDbError(error);

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function deleteModuleResource(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
  storagePath: string | null;
}) {
  const { supabase } = await requireAuthUserId();

  if (input.storagePath) {
    await supabase.storage.from("module-resources").remove([input.storagePath]);
  }

  const { error } = await supabase.from("module_resources").delete().eq("id", input.resourceId);
  throwIfDbError(error);

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function updateUserAccess(input: {
  userId: string;
  permissionLevelIds: string[];
  isAdmin: boolean;
}) {
  const { supabase, userId } = await requireAdminUser();

  if (input.userId === userId && !input.isAdmin) {
    throw new Error("You cannot remove your own system admin access.");
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, client_id")
    .eq("id", input.userId)
    .maybeSingle();
  if (targetError) throwIfDbError(targetError);
  if (!target?.client_id) throw new Error("User not found.");

  const { error } = await supabase.from("profiles").update({ is_admin: input.isAdmin }).eq("id", input.userId);
  throwIfDbError(error);
  await replaceProfilePermissionLevels(supabase, {
    profileId: input.userId,
    clientId: target.client_id,
    permissionLevelIds: input.permissionLevelIds,
  });
  revalidatePath("/admin");
  revalidatePath("/personnel");
  revalidatePath(`/personnel/${input.userId}`);
}

/** @deprecated Prefer updateUserAccess */
export async function updateUserRole(input: { userId: string; permissionLevelIds: string[] }) {
  const { supabase } = await requireAdminUser();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, client_id")
    .eq("id", input.userId)
    .maybeSingle();
  if (targetError) throwIfDbError(targetError);
  if (!target?.client_id) throw new Error("User not found.");
  await replaceProfilePermissionLevels(supabase, {
    profileId: input.userId,
    clientId: target.client_id,
    permissionLevelIds: input.permissionLevelIds,
  });
  revalidatePath("/admin");
}

export async function updateUserProfile(input: {
  userId: string;
  displayName: string;
  rank: string | null;
}) {
  const { supabase } = await requireAdminUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName.trim() || null,
      rank: input.rank?.trim() || null,
    })
    .eq("id", input.userId);
  throwIfDbError(error);
  revalidatePath("/admin");
  revalidatePath("/personnel");
  revalidatePath(`/personnel/${input.userId}`);
}

export async function createQuestionBankItem(input: {
  resourceId: string;
  prompt: string;
  explanation: string;
  topic: string;
  options: { text: string; isCorrect: boolean }[];
}) {
  const { supabase, userId } = await requireQuizBankManager();
  if (input.options.filter((o) => o.isCorrect).length !== 1) {
    throw new Error("Each question must have exactly one correct answer.");
  }
  if (input.options.length < 2) throw new Error("Add at least two answer options.");

  const { data: question, error } = await supabase
    .from("question_bank_items")
    .insert({
      resource_id: input.resourceId,
      prompt: input.prompt.trim(),
      explanation: input.explanation.trim() || null,
      topic: input.topic.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (!question) throw new Error("Failed to create question");

  const { error: optionsError } = await supabase.from("question_bank_options").insert(
    input.options.map((option, index) => ({
      question_id: question.id,
      option_text: option.text.trim(),
      is_correct: option.isCorrect,
      sort_order: index + 1,
    }))
  );
  throwIfDbError(optionsError);
  revalidatePath(`/admin/quizzes/${input.resourceId}/edit`);
}

export async function updateQuestionBankItem(input: {
  resourceId: string;
  questionId: string;
  prompt: string;
  explanation: string;
  topic: string;
  options: { id?: string; text: string; isCorrect: boolean }[];
}) {
  const { supabase } = await requireQuizBankManager();
  if (input.options.filter((o) => o.isCorrect).length !== 1) {
    throw new Error("Each question must have exactly one correct answer.");
  }
  if (input.options.length < 2) throw new Error("Add at least two answer options.");

  const { error: questionError } = await supabase
    .from("question_bank_items")
    .update({
      prompt: input.prompt.trim(),
      explanation: input.explanation.trim() || null,
      topic: input.topic.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.questionId)
    .eq("resource_id", input.resourceId);
  throwIfDbError(questionError);

  const { error: deleteError } = await supabase
    .from("question_bank_options")
    .delete()
    .eq("question_id", input.questionId);
  throwIfDbError(deleteError);

  const { error: optionsError } = await supabase.from("question_bank_options").insert(
    input.options.map((option, index) => ({
      question_id: input.questionId,
      option_text: option.text.trim(),
      is_correct: option.isCorrect,
      sort_order: index + 1,
    }))
  );
  throwIfDbError(optionsError);
  revalidatePath(`/admin/quizzes/${input.resourceId}/edit`);
}

export async function deleteQuestionBankItem(input: { resourceId: string; questionId: string }) {
  const { supabase } = await requireQuizBankManager();
  const { error } = await supabase
    .from("question_bank_items")
    .delete()
    .eq("id", input.questionId)
    .eq("resource_id", input.resourceId);
  throwIfDbError(error);
  revalidatePath(`/admin/quizzes/${input.resourceId}/edit`);
}

export async function addModuleResourceQuiz(input: {
  programId: string;
  moduleId: string;
  title: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const { data: resource, error } = await supabase
    .from("module_resources")
    .insert({
      module_id: input.moduleId,
      title: input.title.trim(),
      resource_type: "quiz",
      storage_path: null,
      file_name: null,
      external_url: null,
      sort_order: input.sortOrder,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (!resource) throw new Error("Failed to create quiz resource");

  const { error: settingsError } = await supabase.from("quiz_settings").insert({
    resource_id: resource.id,
    questions_per_attempt: 5,
    pass_percent: 80,
  });
  throwIfDbError(settingsError);

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
  return resource.id as string;
}

export async function addModuleResourceChecklist(input: {
  programId: string;
  moduleId: string;
  title: string;
  items: string[];
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const labels = input.items.map((item) => item.trim()).filter(Boolean);
  if (labels.length === 0) throw new Error("Add at least one checklist item.");

  const { data: resource, error } = await supabase
    .from("module_resources")
    .insert({
      module_id: input.moduleId,
      title: input.title.trim(),
      resource_type: "checklist",
      storage_path: null,
      file_name: null,
      external_url: null,
      sort_order: input.sortOrder,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (!resource) throw new Error("Failed to create checklist resource");

  const { error: itemsError } = await supabase.from("checklist_items").insert(
    labels.map((label, index) => ({
      resource_id: resource.id,
      label,
      sort_order: index + 1,
    }))
  );
  throwIfDbError(itemsError);

  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
  return resource.id as string;
}

export async function addChecklistItem(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
  label: string;
}) {
  const { supabase } = await requireAuthUserId();
  const label = input.label.trim();
  if (!label) throw new Error("Enter a checklist item.");

  const { data: existing } = await supabase
    .from("checklist_items")
    .select("sort_order")
    .eq("resource_id", input.resourceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("checklist_items").insert({
    resource_id: input.resourceId,
    label,
    sort_order: (existing?.sort_order ?? 0) + 1,
  });
  throwIfDbError(error);

  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function updateChecklistItem(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
  itemId: string;
  label: string;
}) {
  const { supabase } = await requireAuthUserId();
  const label = input.label.trim();
  if (!label) throw new Error("Checklist item cannot be empty.");

  const { error } = await supabase
    .from("checklist_items")
    .update({ label })
    .eq("id", input.itemId)
    .eq("resource_id", input.resourceId);
  throwIfDbError(error);

  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function deleteChecklistItem(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
  itemId: string;
}) {
  const { supabase } = await requireAuthUserId();

  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", input.itemId)
    .eq("resource_id", input.resourceId);
  throwIfDbError(error);

  revalidatePath(`/instructor/programs/${input.programId}/modules/${input.moduleId}/edit`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function setChecklistItemComplete(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
  itemId: string;
  completed: boolean;
}) {
  const { supabase, userId } = await requireAuthUserId();
  await requireModuleEnrollment(supabase, userId, input.moduleId);

  if (input.completed) {
    const { error } = await supabase.from("checklist_item_progress").upsert(
      {
        item_id: input.itemId,
        user_id: userId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "item_id,user_id" }
    );
    throwIfDbError(error);
  } else {
    const { error } = await supabase
      .from("checklist_item_progress")
      .delete()
      .eq("item_id", input.itemId)
      .eq("user_id", userId);
    throwIfDbError(error);

    await setResourceComplete({
      programId: input.programId,
      moduleId: input.moduleId,
      resourceId: input.resourceId,
      completed: false,
    });
  }

  const { data: items } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("resource_id", input.resourceId);
  const itemIds = (items ?? []).map((row) => row.id as string);

  if (itemIds.length === 0) {
    revalidateModuleViews(input.programId, input.moduleId);
    return;
  }

  const { count } = await supabase
    .from("checklist_item_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("item_id", itemIds);

  if (input.completed && count === itemIds.length) {
    await setResourceComplete({
      programId: input.programId,
      moduleId: input.moduleId,
      resourceId: input.resourceId,
      completed: true,
    });
  }

  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, input.moduleId);
}

export async function updateQuizSettings(input: {
  resourceId: string;
  questionsPerAttempt: number;
  passPercent: number;
}) {
  const { supabase } = await requireQuizBankManager();
  const { error } = await supabase
    .from("quiz_settings")
    .update({
      questions_per_attempt: input.questionsPerAttempt,
      pass_percent: input.passPercent,
      updated_at: new Date().toISOString(),
    })
    .eq("resource_id", input.resourceId);
  throwIfDbError(error);
  revalidatePath(`/admin/quizzes/${input.resourceId}/edit`);
}

export async function startQuizAttempt(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
}) {
  const { supabase, userId } = await requireAuthUserId();
  await requireModuleEnrollment(supabase, userId, input.moduleId);

  const { data: settings } = await supabase
    .from("quiz_settings")
    .select("questions_per_attempt")
    .eq("resource_id", input.resourceId)
    .maybeSingle();
  if (!settings) throw new Error("Quiz is not configured yet.");

  const { data: bankRows } = await supabase
    .from("question_bank_items")
    .select("id")
    .eq("resource_id", input.resourceId);
  const poolIds = (bankRows ?? []).map((row) => row.id);
  if (poolIds.length === 0) throw new Error("This quiz has no questions yet.");

  const drawCount = Math.min(settings.questions_per_attempt, poolIds.length);
  const selectedIds = shuffleArray(poolIds).slice(0, drawCount);

  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({
      resource_id: input.resourceId,
      user_id: userId,
    })
    .select("id")
    .single();
  throwIfDbError(attemptError);
  if (!attempt) throw new Error("Failed to start quiz");

  const { error: questionsError } = await supabase.from("quiz_attempt_questions").insert(
    selectedIds.map((questionId, index) => ({
      attempt_id: attempt.id,
      question_id: questionId,
      sort_order: index + 1,
    }))
  );
  throwIfDbError(questionsError);

  revalidateModuleViews(input.programId, input.moduleId);
  return attempt.id as string;
}

export async function submitQuizAttempt(input: {
  programId: string;
  moduleId: string;
  resourceId: string;
  attemptId: string;
  answers: { questionId: string; selectedOptionId: string }[];
}) {
  const { supabase, userId } = await requireAuthUserId();
  await requireModuleEnrollment(supabase, userId, input.moduleId);

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, completed_at")
    .eq("id", input.attemptId)
    .eq("user_id", userId)
    .eq("resource_id", input.resourceId)
    .maybeSingle();
  if (!attempt) throw new Error("Quiz attempt not found");
  if (attempt.completed_at) throw new Error("This quiz attempt is already submitted.");

  const { data: attemptQuestions } = await supabase
    .from("quiz_attempt_questions")
    .select("question_id")
    .eq("attempt_id", input.attemptId);
  const expectedQuestionIds = new Set((attemptQuestions ?? []).map((row) => row.question_id));

  const { data: correctOptions } = await supabase
    .from("question_bank_options")
    .select("id, question_id, is_correct")
    .in("question_id", [...expectedQuestionIds]);
  const correctByQuestion = new Map(
    (correctOptions ?? []).filter((row) => row.is_correct).map((row) => [row.question_id, row.id])
  );

  let correctCount = 0;
  const answerRows = [...expectedQuestionIds].map((questionId) => {
    const selectedOptionId = input.answers.find((a) => a.questionId === questionId)?.selectedOptionId ?? null;
    const isCorrect = selectedOptionId !== null && selectedOptionId === correctByQuestion.get(questionId);
    if (isCorrect) correctCount++;
    return {
      attempt_id: input.attemptId,
      question_id: questionId,
      selected_option_id: selectedOptionId,
      is_correct: isCorrect,
    };
  });

  const { error: answersError } = await supabase.from("quiz_attempt_answers").insert(answerRows);
  throwIfDbError(answersError);

  const total = expectedQuestionIds.size;
  const pct = scorePercent(correctCount, total);

  const { data: settings } = await supabase
    .from("quiz_settings")
    .select("pass_percent")
    .eq("resource_id", input.resourceId)
    .single();
  const passed = pct >= (settings?.pass_percent ?? 80);

  const { error: attemptError } = await supabase
    .from("quiz_attempts")
    .update({
      score_percent: pct,
      passed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.attemptId);
  throwIfDbError(attemptError);

  if (passed) {
    await setResourceComplete({
      programId: input.programId,
      moduleId: input.moduleId,
      resourceId: input.resourceId,
      completed: true,
    });
  }

  revalidateModuleViews(input.programId, input.moduleId);
  return { scorePercent: pct, passed, correctCount, total };
}

export async function toggleProgramHighlight(input: { programId: string }) {
  const { supabase, userId } = await requireAuthUserId();

  const { data: existing, error: selectError } = await supabase
    .from("user_highlights")
    .select("id")
    .eq("user_id", userId)
    .eq("program_id", input.programId)
    .maybeSingle();
  throwIfDbError(selectError);

  if (existing) {
    const { error } = await supabase.from("user_highlights").delete().eq("id", existing.id);
    throwIfDbError(error);
  } else {
    const { error } = await supabase.from("user_highlights").insert({
      user_id: userId,
      program_id: input.programId,
    });
    throwIfDbError(error);
  }

  revalidatePath("/programs");
  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
}

export async function toggleModuleHighlight(input: { moduleId: string; programId: string }) {
  const { supabase, userId } = await requireAuthUserId();

  const { data: existing, error: selectError } = await supabase
    .from("user_highlights")
    .select("id")
    .eq("user_id", userId)
    .eq("module_id", input.moduleId)
    .maybeSingle();
  throwIfDbError(selectError);

  if (existing) {
    const { error } = await supabase.from("user_highlights").delete().eq("id", existing.id);
    throwIfDbError(error);
  } else {
    const { error } = await supabase.from("user_highlights").insert({
      user_id: userId,
      module_id: input.moduleId,
    });
    throwIfDbError(error);
  }

  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  revalidatePath(`/programs/${input.programId}/modules/${input.moduleId}`);
}