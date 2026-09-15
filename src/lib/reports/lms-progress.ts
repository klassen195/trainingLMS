import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadBulkProgramProgress } from "@/lib/program-module-progress";
import { personnelDisplayName } from "@/lib/personnel-types";
import type { Program } from "@/lib/training-lms-types";

export type LmsProgressReportRow = Record<string, unknown> & {
  person: string;
  program: string;
  status: string;
  progress: string;
  enrolledModules: number;
};

export async function loadLmsProgressReport(): Promise<{ rows: LmsProgressReportRow[] }> {
  const supabase = await createSupabaseServerClient();

  const [{ data: programs, error: programsError }, { data: links, error: linksError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from("programs").select("id, title, status").order("title"),
      supabase.from("program_modules").select("program_id, module_id"),
      supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name, email, is_active, is_platform_operator")
        .eq("is_active", true)
        .eq("is_platform_operator", false),
    ]);

  if (programsError) throw programsError;
  if (linksError) throw linksError;
  if (profilesError) throw profilesError;

  const programList = (programs ?? []).map(
    (row) =>
      ({
        id: row.id as string,
        title: (row.title as string) || "Program",
        description: null,
        tags: [],
        status: (row.status as Program["status"]) || "published",
        created_by: null,
        created_at: "",
        updated_at: "",
      }) satisfies Program
  );
  const modulesByProgram = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = modulesByProgram.get(link.program_id as string) ?? [];
    list.push(link.module_id as string);
    modulesByProgram.set(link.program_id as string, list);
  }

  const allModuleIds = [...new Set((links ?? []).map((row) => row.module_id as string))];
  const { data: enrollments, error: enrollmentsError } =
    allModuleIds.length > 0
      ? await supabase
          .from("module_enrollments")
          .select("user_id, module_id")
          .in("module_id", allModuleIds)
      : { data: [] as { user_id: string; module_id: string }[], error: null };
  if (enrollmentsError) throw enrollmentsError;

  const enrolledByUser = new Map<string, Set<string>>();
  for (const row of enrollments ?? []) {
    const set = enrolledByUser.get(row.user_id as string) ?? new Set<string>();
    set.add(row.module_id as string);
    enrolledByUser.set(row.user_id as string, set);
  }

  const candidateProfiles = (profiles ?? []).filter((profile) => {
    const enrolledModules = enrolledByUser.get(profile.id as string);
    return enrolledModules && enrolledModules.size > 0;
  });

  const progressByUser = new Map<
    string,
    Awaited<ReturnType<typeof loadBulkProgramProgress>>
  >();
  await Promise.all(
    candidateProfiles.map(async (profile) => {
      const userId = profile.id as string;
      const progress = await loadBulkProgramProgress(supabase, userId, programList);
      progressByUser.set(userId, progress);
    })
  );

  const rows: LmsProgressReportRow[] = [];

  for (const profile of candidateProfiles) {
    const userId = profile.id as string;
    const enrolledModules = enrolledByUser.get(userId)!;
    const progressByProgram = progressByUser.get(userId) ?? [];
    const person = personnelDisplayName({
      display_name: profile.display_name as string | null,
      first_name: profile.first_name as string | null,
      last_name: profile.last_name as string | null,
      email: profile.email as string | null,
    });

    for (const program of programList) {
      const moduleIds = modulesByProgram.get(program.id) ?? [];
      const enrolledCount = moduleIds.filter((id) => enrolledModules.has(id)).length;
      if (enrolledCount === 0) continue;

      const pct = progressByProgram.find((row) => row.program.id === program.id)?.pct ?? null;
      rows.push({
        person,
        program: program.title || "Program",
        status: program.status || "",
        progress: pct == null ? "—" : `${Math.round(pct)}%`,
        enrolledModules: enrolledCount,
      });
    }
  }

  rows.sort(
    (a, b) =>
      String(a.person).localeCompare(String(b.person)) ||
      String(a.program).localeCompare(String(b.program))
  );

  return { rows };
}

export const LMS_PROGRESS_COLUMNS = [
  { key: "person", header: "Person" },
  { key: "program", header: "Program" },
  { key: "status", header: "Program status" },
  { key: "progress", header: "Progress" },
  { key: "enrolledModules", header: "Enrolled modules" },
];
