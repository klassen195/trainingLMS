"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatAuthError, normalizeAuthEmail } from "@/lib/auth-messages";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables, supabaseErrorMessage } from "@/lib/supabase/errors";
import type { ProgramCategory, ProgramStatus, UserRole } from "@/lib/training-lms-types";
import { buildModuleResourceStoragePath, parseYouTubeVideoId } from "@/lib/module-resources";
import { scorePercent, shuffleArray } from "@/lib/quiz";
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

async function requireAdminUser() {
  const { supabase, userId } = await requireAuthUserId();
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", userId).single();
  throwIfDbError(error);
  if (profile?.role !== "admin") throw new Error("Admin access required");
  return { supabase, userId };
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

export async function signInWithMagicLink(input: { email: string; origin: string }) {
  const emailResult = parseAuthEmail(input.email);
  if ("error" in emailResult) return emailResult;

  const originResult = parseAuthOrigin(input.origin);
  if ("error" in originResult) return originResult;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: emailResult.email,
    options: {
      emailRedirectTo: `${originResult.origin.origin}/auth/callback?next=/dashboard`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  return { success: true as const };
}

export async function sendSignInCode(input: { email: string }) {
  const emailResult = parseAuthEmail(input.email);
  if ("error" in emailResult) return emailResult;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: emailResult.email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  return { success: true as const };
}

export async function verifySignInCode(input: { email: string; code: string }) {
  const emailResult = parseAuthEmail(input.email);
  if ("error" in emailResult) return emailResult;

  const token = input.code.trim();
  if (!/^\d{6}$/.test(token)) {
    return { error: "Enter the 6-digit code from your email." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: emailResult.email,
    token,
    type: "email",
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  return { success: true as const };
}

export async function signInWithPassword(input: { email: string; password: string }) {
  const emailResult = parseAuthEmail(input.email);
  if ("error" in emailResult) return emailResult;

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

  return { success: true as const };
}

export async function requestPasswordReset(input: { email: string; origin: string }) {
  const emailResult = parseAuthEmail(input.email);
  if ("error" in emailResult) return emailResult;

  const originResult = parseAuthOrigin(input.origin);
  if ("error" in originResult) return originResult;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(emailResult.email, {
    redirectTo: `${originResult.origin.origin}/auth/callback?next=/account`,
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  return { success: true as const };
}

export async function setAccountPassword(input: { password: string; confirmPassword: string }) {
  if (!input.password || input.password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (input.password !== input.confirmPassword) {
    return { error: "Passwords do not match." };
  }

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

  revalidatePath("/account");
  return { success: true as const };
}

export async function enrollInModule(input: { programId: string; moduleId: string }) {
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
  revalidatePath("/dashboard");
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, input.moduleId);
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

  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard");
  revalidatePath(`/programs/${input.programId}`);
  revalidateModuleViews(input.programId, input.moduleId);
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

export async function createQuestionBankItem(input: {
  resourceId: string;
  prompt: string;
  explanation: string;
  topic: string;
  options: { text: string; isCorrect: boolean }[];
}) {
  const { supabase, userId } = await requireAdminUser();
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
  const { supabase } = await requireAdminUser();
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
  const { supabase } = await requireAdminUser();
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

export async function updateQuizSettings(input: {
  resourceId: string;
  questionsPerAttempt: number;
  passPercent: number;
}) {
  const { supabase } = await requireAdminUser();
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
