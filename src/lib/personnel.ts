import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  PERSONNEL_CERTIFICATION_SELECT,
  PERSONNEL_DOCUMENT_SELECT,
  PERSONNEL_NOTE_SELECT,
  PERSONNEL_PROFILE_SELECT,
  PROFILE_ORG_SELECT,
  type PersonnelCertification,
  type PersonnelDocument,
  type PersonnelNote,
  type PersonnelProfile,
  type PersonnelTrainingProgram,
} from "@/lib/personnel-types";

function asSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function normalizePersonnelProfile(row: Record<string, unknown>): PersonnelProfile {
  const base = row as unknown as PersonnelProfile;
  return {
    ...base,
    employee_number: (base.employee_number as string | null | undefined) ?? null,
    job_title: (base.job_title as string | null | undefined) ?? null,
    department: (base.department as string | null | undefined) ?? null,
    phone: (base.phone as string | null | undefined) ?? null,
    hire_date: (base.hire_date as string | null | undefined) ?? null,
    shift: (base.shift as PersonnelProfile["shift"] | undefined) ?? null,
    home_address: (base.home_address as string | null | undefined) ?? null,
    emergency_contacts: (base.emergency_contacts as string | null | undefined) ?? null,
    hr_info: (base.hr_info as string | null | undefined) ?? null,
    primary_location_id: (base.primary_location_id as string | null | undefined) ?? null,
    supervisor_id: (base.supervisor_id as string | null | undefined) ?? null,
    primary_location: asSingleRelation(row.primary_location as PersonnelProfile["primary_location"]),
    supervisor: asSingleRelation(row.supervisor as PersonnelProfile["supervisor"]),
  };
}

export async function fetchPersonnelDirectory(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select(PERSONNEL_PROFILE_SELECT)
    .order("display_name", { ascending: true, nullsFirst: false });

  if (error) {
    // Fallback if org join columns not migrated yet
    const fallback = await supabase
      .from("profiles")
      .select(PROFILE_ORG_SELECT)
      .order("display_name", { ascending: true, nullsFirst: false });
    if (fallback.error) return { rows: [] as PersonnelProfile[], error };
    return {
      rows: (fallback.data ?? []).map((row) => normalizePersonnelProfile(row as Record<string, unknown>)),
      error: null as PostgrestError | null,
    };
  }

  return {
    rows: (data ?? []).map((row) => normalizePersonnelProfile(row as Record<string, unknown>)),
    error: null as PostgrestError | null,
  };
}

export async function fetchPersonnelProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(PERSONNEL_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    const fallback = await supabase
      .from("profiles")
      .select(PROFILE_ORG_SELECT)
      .eq("id", userId)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return { profile: null as PersonnelProfile | null, error: error as PostgrestError };
    }
    return {
      profile: normalizePersonnelProfile(fallback.data as Record<string, unknown>),
      error: null as PostgrestError | null,
    };
  }

  if (!data) return { profile: null as PersonnelProfile | null, error: null as PostgrestError | null };
  return {
    profile: normalizePersonnelProfile(data as Record<string, unknown>),
    error: null as PostgrestError | null,
  };
}

export async function fetchPersonnelCertifications(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("personnel_certifications")
    .select(PERSONNEL_CERTIFICATION_SELECT)
    .eq("profile_id", profileId)
    .order("expires_on", { ascending: true, nullsFirst: false });

  return {
    rows: (data ?? []) as PersonnelCertification[],
    error: error as PostgrestError | null,
  };
}

export async function fetchPersonnelDocuments(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("personnel_documents")
    .select(PERSONNEL_DOCUMENT_SELECT)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  return {
    rows: (data ?? []) as PersonnelDocument[],
    error: error as PostgrestError | null,
  };
}

export async function fetchPersonnelNotes(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("personnel_notes")
    .select(PERSONNEL_NOTE_SELECT)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    return { rows: [] as PersonnelNote[], error: error as PostgrestError };
  }

  return {
    rows: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ...(r as unknown as PersonnelNote),
        created_by_profile: asSingleRelation(
          r.created_by_profile as PersonnelNote["created_by_profile"]
        ),
      };
    }),
    error: null as PostgrestError | null,
  };
}

export async function fetchPersonnelTraining(
  supabase: SupabaseClient,
  userId: string
): Promise<{ programs: PersonnelTrainingProgram[]; error: PostgrestError | null }> {
  const { data: enrollments, error: enrollError } = await supabase
    .from("module_enrollments")
    .select("module_id, enrolled_at")
    .eq("user_id", userId);

  if (enrollError) return { programs: [], error: enrollError };

  const enrolled = enrollments ?? [];
  if (enrolled.length === 0) return { programs: [], error: null };

  const moduleIds = enrolled.map((e) => e.module_id);
  const enrolledAtByModule = new Map(enrolled.map((e) => [e.module_id, e.enrolled_at]));

  const [{ data: modules, error: modulesError }, { data: progress, error: progressError }] =
    await Promise.all([
      supabase.from("modules").select("id, title").in("id", moduleIds),
      supabase.from("module_progress").select("module_id, completed_at").eq("user_id", userId).in("module_id", moduleIds),
    ]);

  if (modulesError) return { programs: [], error: modulesError };
  if (progressError) return { programs: [], error: progressError };

  const titleByModule = new Map((modules ?? []).map((m) => [m.id, m.title]));
  const completedAtByModule = new Map((progress ?? []).map((p) => [p.module_id, p.completed_at]));

  const { data: links, error: linksError } = await supabase
    .from("program_modules")
    .select("program_id, module_id, programs(id, title, status)")
    .in("module_id", moduleIds);

  if (linksError) return { programs: [], error: linksError };

  type Acc = {
    program_id: string;
    title: string;
    status: string;
    modules: Map<string, PersonnelTrainingProgram["modules"][number]>;
  };

  const byProgram = new Map<string, Acc>();
  const orphanModules: PersonnelTrainingProgram["modules"] = [];

  for (const link of links ?? []) {
    const program = asSingleRelation(
      link.programs as { id: string; title: string; status: string } | { id: string; title: string; status: string }[] | null
    );
    if (!program) continue;

    let acc = byProgram.get(program.id);
    if (!acc) {
      acc = {
        program_id: program.id,
        title: program.title,
        status: program.status,
        modules: new Map(),
      };
      byProgram.set(program.id, acc);
    }

    const moduleId = link.module_id as string;
    acc.modules.set(moduleId, {
      module_id: moduleId,
      title: titleByModule.get(moduleId) ?? "Module",
      enrolled_at: enrolledAtByModule.get(moduleId) ?? "",
      completed_at: completedAtByModule.get(moduleId) ?? null,
    });
  }

  const linkedModuleIds = new Set(
    [...byProgram.values()].flatMap((p) => [...p.modules.keys()])
  );
  for (const moduleId of moduleIds) {
    if (linkedModuleIds.has(moduleId)) continue;
    orphanModules.push({
      module_id: moduleId,
      title: titleByModule.get(moduleId) ?? "Module",
      enrolled_at: enrolledAtByModule.get(moduleId) ?? "",
      completed_at: completedAtByModule.get(moduleId) ?? null,
    });
  }

  const programs: PersonnelTrainingProgram[] = [...byProgram.values()].map((acc) => {
    const modulesList = [...acc.modules.values()].sort((a, b) =>
      a.title.localeCompare(b.title)
    );
    return {
      program_id: acc.program_id,
      title: acc.title,
      status: acc.status,
      modules: modulesList,
      enrolled_count: modulesList.length,
      completed_count: modulesList.filter((m) => m.completed_at).length,
    };
  });

  programs.sort((a, b) => a.title.localeCompare(b.title));

  if (orphanModules.length > 0) {
    programs.push({
      program_id: "_unlinked",
      title: "Other modules",
      status: "published",
      modules: orphanModules.sort((a, b) => a.title.localeCompare(b.title)),
      enrolled_count: orphanModules.length,
      completed_count: orphanModules.filter((m) => m.completed_at).length,
    });
  }

  return { programs, error: null };
}
