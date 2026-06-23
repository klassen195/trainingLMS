"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables, supabaseErrorMessage } from "@/lib/supabase/errors";
import type { CourseCategory, CourseStatus, UserRole } from "@/lib/training-lms-types";

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

export async function enrollInCourse(courseId: string) {
  const { supabase, userId } = await requireAuthUserId();
  const { error } = await supabase.from("enrollments").insert({
    course_id: courseId,
    user_id: userId,
    status: "active",
  });
  throwIfDbError(error);
  revalidatePath("/dashboard");
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
}

export async function markLessonComplete(input: { courseId: string; lessonId: string }) {
  const { supabase, userId } = await requireAuthUserId();
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      lesson_id: input.lessonId,
      user_id: userId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,user_id" }
  );
  throwIfDbError(error);
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${input.courseId}`);
  revalidatePath(`/courses/${input.courseId}/lessons/${input.lessonId}`);
}

export async function submitAssignment(input: {
  courseId: string;
  assignmentId: string;
  content: string;
}) {
  const { supabase, userId } = await requireAuthUserId();
  const { error } = await supabase.from("assignment_submissions").upsert(
    {
      assignment_id: input.assignmentId,
      user_id: userId,
      content: input.content,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,user_id" }
  );
  throwIfDbError(error);
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${input.courseId}`);
  revalidatePath(`/courses/${input.courseId}/assignments/${input.assignmentId}`);
}

export async function createCourse(input: {
  title: string;
  description: string;
  category: CourseCategory;
  status: CourseStatus;
}) {
  const { supabase, userId } = await requireAuthUserId();
  const { data, error } = await supabase
    .from("courses")
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
  if (!data) throw new Error("Failed to create course");
  revalidatePath("/instructor");
  redirect(`/instructor/courses/${data.id}/edit`);
}

export async function updateCourse(input: {
  id: string;
  title: string;
  description: string;
  category: CourseCategory;
  status: CourseStatus;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase
    .from("courses")
    .update({
      title: input.title,
      description: input.description || null,
      category: input.category,
      status: input.status,
    })
    .eq("id", input.id);
  throwIfDbError(error);
  revalidatePath("/instructor");
  revalidatePath(`/instructor/courses/${input.id}/edit`);
  revalidatePath(`/courses/${input.id}`);
}

export async function addLesson(input: {
  courseId: string;
  title: string;
  content: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase.from("lessons").insert({
    course_id: input.courseId,
    title: input.title,
    content: input.content,
    sort_order: input.sortOrder,
  });
  throwIfDbError(error);
  revalidatePath(`/instructor/courses/${input.courseId}/edit`);
  revalidatePath(`/courses/${input.courseId}`);
}

export async function updateLesson(input: {
  courseId: string;
  lessonId: string;
  title: string;
  content: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: input.title,
      content: input.content,
      sort_order: input.sortOrder,
    })
    .eq("id", input.lessonId);
  throwIfDbError(error);
  revalidatePath(`/instructor/courses/${input.courseId}/edit`);
  revalidatePath(`/courses/${input.courseId}`);
  revalidatePath(`/courses/${input.courseId}/lessons/${input.lessonId}`);
}

export async function addAssignment(input: {
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase.from("assignments").insert({
    course_id: input.courseId,
    title: input.title,
    description: input.description,
    sort_order: input.sortOrder,
  });
  throwIfDbError(error);
  revalidatePath(`/instructor/courses/${input.courseId}/edit`);
  revalidatePath(`/courses/${input.courseId}`);
}


export async function updateAssignment(input: {
  courseId: string;
  assignmentId: string;
  title: string;
  description: string;
  sortOrder: number;
}) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase
    .from("assignments")
    .update({
      title: input.title,
      description: input.description,
      sort_order: input.sortOrder,
    })
    .eq("id", input.assignmentId);
  throwIfDbError(error);
  revalidatePath(`/instructor/courses/${input.courseId}/edit`);
  revalidatePath(`/courses/${input.courseId}`);
  revalidatePath(`/courses/${input.courseId}/assignments/${input.assignmentId}`);
}
export async function updateUserRole(input: { userId: string; role: UserRole }) {
  const { supabase } = await requireAuthUserId();
  const { error } = await supabase.from("profiles").update({ role: input.role }).eq("id", input.userId);
  throwIfDbError(error);
  revalidatePath("/admin");
}


