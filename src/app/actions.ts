"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables, supabaseErrorMessage } from "@/lib/supabase/errors";
import type { ProgramCategory, ProgramStatus, UserRole } from "@/lib/training-lms-types";

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

export async function enrollInProgram(programId: string) {
  const { supabase, userId } = await requireAuthUserId();
  const { error } = await supabase.from("enrollments").insert({
    program_id: programId,
    user_id: userId,
    status: "active",
  });
  throwIfDbError(error);
  revalidatePath("/dashboard");
  revalidatePath("/programs");
  revalidatePath(`/programs/${programId}`);
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
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase.from("modules").insert({
    program_id: input.programId,
    title: input.title,
    content: input.content,
    sort_order: input.sortOrder,
  });
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
  const { error } = await supabase
    .from("modules")
    .update({
      title: input.title,
      content: input.content,
      sort_order: input.sortOrder,
    })
    .eq("id", input.moduleId);
  throwIfDbError(error);
  revalidatePath(`/instructor/programs/${input.programId}/edit`);
  revalidatePath(`/programs/${input.programId}`);
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
