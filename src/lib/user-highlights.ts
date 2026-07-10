import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapProgramRows,
  PROGRAM_WITH_TAGS_SELECT,
  type ProgramQueryRow,
} from "@/lib/program-tags";
import type { Module, Program } from "@/lib/training-lms-types";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type HighlightedProgram = {
  kind: "program";
  program: Program;
  moduleCount: number;
  enrolledCount: number;
  progressPercent: number | null;
};

export type HighlightedModule = {
  kind: "module";
  module: Module;
  programId: string;
  programTitle: string;
};

export type UserHighlightItem = HighlightedProgram | HighlightedModule;

function isMissingHighlightsTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST205" || error.message?.includes("user_highlights") === true;
}

export async function loadUserHighlightIds(
  supabase: SupabaseServerClient,
  userId: string
): Promise<{ programIds: Set<string>; moduleIds: Set<string> }> {
  const { data, error } = await supabase
    .from("user_highlights")
    .select("program_id, module_id")
    .eq("user_id", userId);

  if (isMissingHighlightsTable(error)) {
    return { programIds: new Set(), moduleIds: new Set() };
  }
  if (error) throw error;

  const programIds = new Set<string>();
  const moduleIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.program_id) programIds.add(row.program_id);
    if (row.module_id) moduleIds.add(row.module_id);
  }
  return { programIds, moduleIds };
}

export async function loadUserHighlights(
  supabase: SupabaseServerClient,
  userId: string,
  progressByProgramId: Map<
    string,
    { pct: number | null; moduleCount: number; enrolledCount: number; program: Program }
  >
): Promise<UserHighlightItem[]> {
  const { data: rows, error } = await supabase
    .from("user_highlights")
    .select("program_id, module_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (isMissingHighlightsTable(error)) return [];
  if (error) throw error;
  if (!rows?.length) return [];

  const highlightProgramIds = rows.map((row) => row.program_id).filter(Boolean) as string[];
  const highlightModuleIds = rows.map((row) => row.module_id).filter(Boolean) as string[];

  let programsById = new Map<string, Program>();
  if (highlightProgramIds.length > 0) {
    const { data: programs, error: programsError } = await supabase
      .from("programs")
      .select(PROGRAM_WITH_TAGS_SELECT)
      .in("id", highlightProgramIds);
    if (programsError) throw programsError;
    programsById = new Map(
      mapProgramRows(programs as ProgramQueryRow[]).map((program) => [program.id, program])
    );
  }

  let modulesById = new Map<string, Module>();
  const moduleProgramMeta = new Map<string, { programId: string; programTitle: string }>();

  if (highlightModuleIds.length > 0) {
    const [{ data: modules, error: modulesError }, { data: programLinks, error: linksError }] =
      await Promise.all([
        supabase.from("modules").select("*").in("id", highlightModuleIds),
        supabase
          .from("program_modules")
          .select("module_id, program_id, programs(id, title, status)")
          .in("module_id", highlightModuleIds),
      ]);

    if (modulesError) throw modulesError;
    if (linksError) throw linksError;

    modulesById = new Map((modules ?? []).map((moduleRow) => [moduleRow.id, moduleRow as Module]));

    const linksByModule = new Map<
      string,
      { programId: string; programTitle: string; status: string }[]
    >();
    for (const link of programLinks ?? []) {
      const program = Array.isArray(link.programs) ? link.programs[0] : link.programs;
      if (!program) continue;
      const list = linksByModule.get(link.module_id) ?? [];
      list.push({
        programId: link.program_id,
        programTitle: program.title,
        status: program.status,
      });
      linksByModule.set(link.module_id, list);
    }

    for (const moduleId of highlightModuleIds) {
      const links = linksByModule.get(moduleId) ?? [];
      const preferred =
        links.find((link) => link.status === "published") ??
        links.sort((a, b) => a.programTitle.localeCompare(b.programTitle))[0];
      if (preferred) {
        moduleProgramMeta.set(moduleId, {
          programId: preferred.programId,
          programTitle: preferred.programTitle,
        });
      }
    }
  }

  const items: UserHighlightItem[] = [];

  for (const row of rows) {
    if (row.program_id) {
      const program = programsById.get(row.program_id);
      if (!program) continue;
      const progress = progressByProgramId.get(program.id);
      items.push({
        kind: "program",
        program,
        moduleCount: progress?.moduleCount ?? 0,
        enrolledCount: progress?.enrolledCount ?? 0,
        progressPercent: progress?.pct ?? null,
      });
      continue;
    }

    if (row.module_id) {
      const moduleRow = modulesById.get(row.module_id);
      const meta = moduleProgramMeta.get(row.module_id);
      if (!moduleRow || !meta) continue;
      items.push({
        kind: "module",
        module: moduleRow,
        programId: meta.programId,
        programTitle: meta.programTitle,
      });
    }
  }

  return items;
}

export function countProgramsByTag(programs: Program[]) {
  const counts = new Map<string, number>();
  for (const program of programs) {
    for (const tag of program.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

/** @deprecated Prefer countProgramsByTag */
export function countProgramsByCategory(programs: Program[]) {
  return countProgramsByTag(programs);
}
