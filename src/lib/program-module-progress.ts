import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { progressPercent } from "@/lib/program-progress";

export type ProgramModuleProgress = {
  enrolledModuleIds: Set<string>;
  completedModuleIds: Set<string>;
  enrolledCount: number;
  progressPercent: number | null;
};

export async function loadProgramModuleProgress(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  moduleIds: string[]
): Promise<ProgramModuleProgress> {
  if (moduleIds.length === 0) {
    return {
      enrolledModuleIds: new Set(),
      completedModuleIds: new Set(),
      enrolledCount: 0,
      progressPercent: null,
    };
  }

  const { data: enrollmentRows } = await supabase
    .from("module_enrollments")
    .select("module_id")
    .eq("user_id", userId)
    .in("module_id", moduleIds);

  const enrolledModuleIds = new Set((enrollmentRows ?? []).map((row) => row.module_id));
  const enrolledList = [...enrolledModuleIds];

  if (enrolledList.length === 0) {
    return {
      enrolledModuleIds,
      completedModuleIds: new Set(),
      enrolledCount: 0,
      progressPercent: null,
    };
  }

  const { data: progressRows } = await supabase
    .from("module_progress")
    .select("module_id")
    .eq("user_id", userId)
    .in("module_id", enrolledList);

  const completedModuleIds = new Set((progressRows ?? []).map((row) => row.module_id));

  return {
    enrolledModuleIds,
    completedModuleIds,
    enrolledCount: enrolledList.length,
    progressPercent: progressPercent(enrolledList.length, completedModuleIds.size),
  };
}
