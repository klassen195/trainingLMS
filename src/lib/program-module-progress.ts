import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  aggregateModuleProgressUnits,
  computeModuleProgressUnits,
  groupChecklistItemsByResourceId,
  groupResourcesByModuleId,
} from "@/lib/module-progress";
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

type UserModuleProgressData = {
  completedResourceIds: Set<string>;
  completedChecklistItemIds: Set<string>;
  completedModuleIds: Set<string>;
  resourcesByModuleId: Map<string, { id: string; module_id: string; resource_type: import("@/lib/training-lms-types").ModuleResourceType }[]>;
  checklistItemsByResourceId: Map<string, string[]>;
};

async function loadUserModuleProgressData(
  supabase: SupabaseServerClient,
  userId: string,
  moduleIds: string[]
): Promise<UserModuleProgressData> {
  if (moduleIds.length === 0) {
    return {
      completedResourceIds: new Set(),
      completedChecklistItemIds: new Set(),
      completedModuleIds: new Set(),
      resourcesByModuleId: new Map(),
      checklistItemsByResourceId: new Map(),
    };
  }

  const { data: resourceRows } = await supabase
    .from("module_resources")
    .select("id, module_id, resource_type")
    .in("module_id", moduleIds);

  const resources = resourceRows ?? [];
  const resourcesByModuleId = groupResourcesByModuleId(resources);
  const resourceIds = resources.map((row) => row.id);
  const checklistResourceIds = resources.filter((row) => row.resource_type === "checklist").map((row) => row.id);

  const { data: checklistItemRows } =
    checklistResourceIds.length > 0
      ? await supabase.from("checklist_items").select("id, resource_id").in("resource_id", checklistResourceIds)
      : { data: [] as { id: string; resource_id: string }[] };

  const checklistItemIds = (checklistItemRows ?? []).map((item) => item.id);

  const [
    { data: resourceProgressRows },
    { data: checklistProgressRows },
    { data: moduleProgressRows },
  ] = await Promise.all([
    resourceIds.length > 0
      ? supabase.from("resource_progress").select("resource_id").eq("user_id", userId).in("resource_id", resourceIds)
      : Promise.resolve({ data: [] as { resource_id: string }[] }),
    checklistItemIds.length > 0
      ? supabase
          .from("checklist_item_progress")
          .select("item_id")
          .eq("user_id", userId)
          .in("item_id", checklistItemIds)
      : Promise.resolve({ data: [] as { item_id: string }[] }),
    supabase.from("module_progress").select("module_id").eq("user_id", userId).in("module_id", moduleIds),
  ]);

  return {
    completedResourceIds: new Set((resourceProgressRows ?? []).map((row) => row.resource_id)),
    completedChecklistItemIds: new Set((checklistProgressRows ?? []).map((row) => row.item_id)),
    completedModuleIds: new Set((moduleProgressRows ?? []).map((row) => row.module_id)),
    resourcesByModuleId,
    checklistItemsByResourceId: groupChecklistItemsByResourceId(checklistItemRows ?? []),
  };
}

function computeEnrolledProgramProgress(
  enrolledModuleIds: string[],
  progressData: UserModuleProgressData
): number | null {
  if (enrolledModuleIds.length === 0) return null;

  const moduleUnits = enrolledModuleIds.map((moduleId) =>
    computeModuleProgressUnits({
      resources: progressData.resourcesByModuleId.get(moduleId) ?? [],
      checklistItemsByResourceId: progressData.checklistItemsByResourceId,
      completedResourceIds: progressData.completedResourceIds,
      completedChecklistItemIds: progressData.completedChecklistItemIds,
      moduleMarkedComplete: progressData.completedModuleIds.has(moduleId),
    })
  );

  const totals = aggregateModuleProgressUnits(moduleUnits);
  return progressPercent(totals.totalUnits, totals.completedUnits);
}

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

  if (allModuleIdsList.length > 0) {
    const { data: enrollmentRows } = await supabase
      .from("module_enrollments")
      .select("module_id")
      .eq("user_id", userId)
      .in("module_id", allModuleIdsList);

    enrolledModuleIds = new Set((enrollmentRows ?? []).map((row) => row.module_id));
  }

  const enrolledModuleIdsList = [...enrolledModuleIds];
  const progressData = await loadUserModuleProgressData(supabase, userId, enrolledModuleIdsList);

  return programs.map((program) => {
    const moduleIds = modulesByProgram.get(program.id) ?? [];
    const enrolledInProgram = moduleIds.filter((moduleId) => enrolledModuleIds.has(moduleId));

    return {
      program,
      pct: computeEnrolledProgramProgress(enrolledInProgram, progressData),
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

  const progressData = await loadUserModuleProgressData(supabase, userId, enrolledList);

  return {
    enrolledModuleIds,
    completedModuleIds: new Set(
      enrolledList.filter((moduleId) => progressData.completedModuleIds.has(moduleId))
    ),
    enrolledCount: enrolledList.length,
    progressPercent: computeEnrolledProgramProgress(enrolledList, progressData),
  };
}
