"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables, supabaseErrorMessage } from "@/lib/supabase/errors";
import type { ProgramCategory, ProgramStatus, UserRole } from "@/lib/training-lms-types";
import { buildModuleResourceStoragePath, parseYouTubeVideoId } from "@/lib/module-resources";
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
  return { supabase, userId: user.id };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function markModuleComplete(input: { programId: string; moduleId: string }) {
  const { supabase, userId } = await requireAuthUserId();
  const { error } = await supabase.from("module_progress").upsert(
    {
      module_id: input.moduleId,
      user_id: userId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "module_id,user_id" }
  );
  throwIfDbError(error);
  revalidatePath("/dashboard");
  revalidatePath(`/programs/${input.programId}`);
  revalidatePath(`/programs/${input.programId}/modules/${input.moduleId}`);
}

export async function createProgram(input: {
  title: string;
  description: string;
  category: ProgramCategory;
  status: ProgramStatus;
}) {
  const { supabase, userId } = await requireAuthUserId();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      title: input.title,
      description: input.description || null,
      category: input.category,
      status: input.status,
      created_by: userId,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (!data) throw new Error("Failed to create program");
  revalidatePath("/instructor");
  redirect(`/instructor/programs/${data.id}/edit`);
}

export async function updateProgram(input: {
  id: string;
  title: string;
  description: string;
  category: ProgramCategory;
  status: ProgramStatus;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase
    .from("programs")
    .update({
      title: input.title,
      description: input.description || null,
      category: input.category,
      status: input.status,
    })
    .eq("id", input.id);
  throwIfDbError(error);
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
  const { data: moduleRow, error: moduleError } = await supabase
    .from("modules")
    .insert({
      title: input.title,
      content: input.content,
      created_by: userId,
    })
    .select("id")
    .single();
  throwIfDbError(moduleError);
  if (!moduleRow) throw new Error("Failed to create module");

  const { error: linkError } = await supabase.from("program_modules").insert({
    program_id: input.programId,
    module_id: moduleRow.id,
    sort_order: input.sortOrder,
  });
  throwIfDbError(linkError);
  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/programs/${input.programId}`);
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
  revalidatePath(`/programs/${input.programId}`);
  revalidatePath(`/programs/${input.programId}/modules/${input.moduleId}`);
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
  revalidatePath(`/programs/${input.programId}/modules/${input.moduleId}`);

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
  revalidatePath(`/programs/${input.programId}/modules/${input.moduleId}`);
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
  revalidatePath(`/programs/${input.programId}/modules/${input.moduleId}`);
}

export async function updateUserRole(input: { userId: string; role: UserRole }) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase.from("profiles").update({ role: input.role }).eq("id", input.userId);
  throwIfDbError(error);
  revalidatePath("/admin");
}

export async function updateUserProfile(input: {
  userId: string;
  displayName: string;
  rank: string | null;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName.trim() || null,
      rank: input.rank?.trim() || null,
    })
    .eq("id", input.userId);
  throwIfDbError(error);
  revalidatePath("/admin");
}
