import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { progressPercent } from "@/lib/program-progress";
import type { Program } from "@/lib/training-lms-types";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ProgramWithProgress = {
  program: Program;
  pct: number | null;
  moduleCount: number;
  enrolledCount: number;
};

export type ProgramModuleProgress = {
  enrolledModuleIds: Set<string>;
  completedModuleIds: Set<string>;
  enrolledCount: number;
  progressPercent: number | null;
};

export async function loadProgramModuleCounts(
  supabase: SupabaseServerClient,
  programIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (programIds.length === 0) return counts;

  for (const programId of programIds) counts.set(programId, 0);

  const { data: rows } = await supabase
    .from("program_modules")
    .select("program_id")
    .in("program_id", programIds);

  for (const row of rows ?? []) {
    counts.set(row.program_id, (counts.get(row.program_id) ?? 0) + 1);
  }

  return counts;
}

export async function loadBulkProgramProgress(
  supabase: SupabaseServerClient,
  userId: string,
  programs: Program[]
): Promise<ProgramWithProgress[]> {
  if (programs.length === 0) return [];

  const programIds = programs.map((program) => program.id);
  const { data: programModuleRows } = await supabase
    .from("program_modules")
    .select("program_id, module_id")
    .in("program_id", programIds);

  const modulesByProgram = new Map<string, string[]>();
  const allModuleIds = new Set<string>();

  for (const row of programModuleRows ?? []) {
    const moduleIds = modulesByProgram.get(row.program_id) ?? [];
    moduleIds.push(row.module_id);
    modulesByProgram.set(row.program_id, moduleIds);
    allModuleIds.add(row.module_id);
  }

  const allModuleIdsList = [...allModuleIds];
  let enrolledModuleIds = new Set<string>();
  let completedModuleIds = new Set<string>();

  if (allModuleIdsList.length > 0) {
    const [{ data: enrollmentRows }, { data: progressRows }] = await Promise.all([
      supabase
        .from("module_enrollments")
        .select("module_id")
        .eq("user_id", userId)
        .in("module_id", allModuleIdsList),
      supabase
        .from("module_progress")
        .select("module_id")
        .eq("user_id", userId)
        .in("module_id", allModuleIdsList),
    ]);

    enrolledModuleIds = new Set((enrollmentRows ?? []).map((row) => row.module_id));
    completedModuleIds = new Set((progressRows ?? []).map((row) => row.module_id));
  }

  return programs.map((program) => {
    const moduleIds = modulesByProgram.get(program.id) ?? [];
    const enrolledInProgram = moduleIds.filter((moduleId) => enrolledModuleIds.has(moduleId));
    const completedInProgram = enrolledInProgram.filter((moduleId) => completedModuleIds.has(moduleId));

    return {
      program,
      pct:
        enrolledInProgram.length === 0
          ? null
          : progressPercent(enrolledInProgram.length, completedInProgram.length),
      moduleCount: moduleIds.length,
      enrolledCount: enrolledInProgram.length,
    };
  });
}

export async function loadProgramModuleProgress(
  supabase: SupabaseServerClient,
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
