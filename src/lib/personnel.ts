import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  PERSONNEL_CERTIFICATION_SELECT,
  PERSONNEL_DOCUMENT_SELECT,
  PERSONNEL_EMS_LICENSE_SELECT,
  PERSONNEL_NOTE_SELECT,
  PERSONNEL_PROFILE_SELECT,
  PERSONNEL_QUALIFICATION_SELECT,
  PERSONNEL_RECOGNITION_SELECT,
  PERSONNEL_TASKBOOK_SELECT,
  PERSONNEL_TASKBOOK_WITH_PROFILE_SELECT,
  PERSONNEL_TASKBOOK_PREREQ_CHECK_SELECT,
  PROFILE_ORG_COLUMNS,
  isBattalionChiefRank,
  normalizeSwingUpRanks,
  type PersonnelCertification,
  type PersonnelDocument,
  type PersonnelEmsLicense,
  type PersonnelNote,
  type PersonnelProfile,
  type PersonnelQualification,
  type PersonnelRecognition,
  type PersonnelShift,
  type PersonnelTaskbook,
  type PersonnelTaskbookPrerequisiteCheck,
  type PersonnelTrainingProgram,
} from "@/lib/personnel-types";
import { isMissingTrainingSessionsTable } from "@/lib/supabase/errors";
import { attachProfilePermissionLevels, parseProfilePermissionLevels } from "@/lib/permission-levels";
import { excludePlatformOperatorsFromRoster } from "@/lib/department-roster";

type SupervisorViewer = {
  id: string;
  rank?: string | null;
  shift?: PersonnelShift | null;
};

function mergeProfilesById(lists: PersonnelProfile[][]) {
  const byId = new Map<string, PersonnelProfile>();
  for (const list of lists) {
    for (const person of list) {
      byId.set(person.id, person);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const an = (a.display_name || a.email || "").toLowerCase();
    const bn = (b.display_name || b.email || "").toLowerCase();
    return an.localeCompare(bn);
  });
}

async function fetchAssignedReports(supabase: SupabaseClient, supervisorId: string) {
  const { data, error } = await excludePlatformOperatorsFromRoster(
    supabase.from("profiles").select(PERSONNEL_PROFILE_SELECT)
  )
    .eq("supervisor_id", supervisorId)
    .eq("is_active", true)
    .order("display_name", { ascending: true, nullsFirst: false });

  if (error) {
    const fallback = await excludePlatformOperatorsFromRoster(
      supabase.from("profiles").select(PROFILE_ORG_COLUMNS)
    )
      .eq("supervisor_id", supervisorId)
      .eq("is_active", true)
      .order("display_name", { ascending: true, nullsFirst: false });
    if (fallback.error) {
      return { rows: [] as PersonnelProfile[], error: error as PostgrestError };
    }
    return {
      rows: await finalizePersonnelProfiles(
        supabase,
        (fallback.data ?? []).map((row) => normalizePersonnelProfile(row as Record<string, unknown>))
      ),
      error: null as PostgrestError | null,
    };
  }

  return {
    rows: await finalizePersonnelProfiles(
      supabase,
      (data ?? []).map((row) => normalizePersonnelProfile(row as Record<string, unknown>))
    ),
    error: null as PostgrestError | null,
  };
}

async function fetchShiftReports(
  supabase: SupabaseClient,
  viewer: SupervisorViewer
) {
  if (!isBattalionChiefRank(viewer.rank) || !viewer.shift) {
    return { rows: [] as PersonnelProfile[], error: null as PostgrestError | null };
  }

  const { data, error } = await excludePlatformOperatorsFromRoster(
    supabase.from("profiles").select(PERSONNEL_PROFILE_SELECT)
  )
    .eq("shift", viewer.shift)
    .eq("is_active", true)
    .neq("id", viewer.id)
    .order("display_name", { ascending: true, nullsFirst: false });

  if (error) {
    const fallback = await excludePlatformOperatorsFromRoster(
      supabase.from("profiles").select(PROFILE_ORG_COLUMNS)
    )
      .eq("shift", viewer.shift)
      .eq("is_active", true)
      .neq("id", viewer.id)
      .order("display_name", { ascending: true, nullsFirst: false });
    if (fallback.error) {
      return { rows: [] as PersonnelProfile[], error: error as PostgrestError };
    }
    return {
      rows: await finalizePersonnelProfiles(
        supabase,
        (fallback.data ?? []).map((row) => normalizePersonnelProfile(row as Record<string, unknown>))
      ),
      error: null as PostgrestError | null,
    };
  }

  return {
    rows: await finalizePersonnelProfiles(
      supabase,
      (data ?? []).map((row) => normalizePersonnelProfile(row as Record<string, unknown>))
    ),
    error: null as PostgrestError | null,
  };
}

async function fetchOpenTaskbooksByProfileIds(
  supabase: SupabaseClient,
  reportIds: string[]
) {
  if (reportIds.length === 0) {
    return {
      taskbooksByProfile: {} as Record<string, PersonnelTaskbook[]>,
      error: null as PostgrestError | null,
    };
  }

  const { data: taskbookRows, error: taskbooksError } = await supabase
    .from("personnel_taskbooks")
    .select(PERSONNEL_TASKBOOK_SELECT)
    .in("profile_id", reportIds)
    .in("status", ["requested", "active"])
    .order("requested_at", { ascending: true });

  if (taskbooksError) {
    return {
      taskbooksByProfile: {} as Record<string, PersonnelTaskbook[]>,
      error: taskbooksError as PostgrestError,
    };
  }

  const taskbooksByProfile: Record<string, PersonnelTaskbook[]> = {};
  for (const row of (taskbookRows ?? []) as PersonnelTaskbook[]) {
    const list = taskbooksByProfile[row.profile_id] ?? [];
    list.push(row);
    taskbooksByProfile[row.profile_id] = list;
  }

  return {
    taskbooksByProfile,
    error: null as PostgrestError | null,
  };
}

async function fetchQualificationsByProfileIds(
  supabase: SupabaseClient,
  reportIds: string[]
) {
  if (reportIds.length === 0) {
    return {
      qualificationsByProfile: {} as Record<string, PersonnelQualification[]>,
      error: null as PostgrestError | null,
    };
  }

  const { data, error } = await supabase
    .from("personnel_qualifications")
    .select(PERSONNEL_QUALIFICATION_SELECT)
    .in("profile_id", reportIds)
    .order("earned_on", { ascending: false, nullsFirst: false });

  if (error) {
    return {
      qualificationsByProfile: {} as Record<string, PersonnelQualification[]>,
      error: error as PostgrestError,
    };
  }

  const qualificationsByProfile: Record<string, PersonnelQualification[]> = {};
  for (const row of (data ?? []) as unknown as PersonnelQualification[]) {
    const list = qualificationsByProfile[row.profile_id] ?? [];
    list.push(row);
    qualificationsByProfile[row.profile_id] = list;
  }

  return {
    qualificationsByProfile,
    error: null as PostgrestError | null,
  };
}

function asSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function normalizePersonnelProfile(row: Record<string, unknown>): PersonnelProfile {
  const base = row as unknown as PersonnelProfile;
  const permissionLevels = parseProfilePermissionLevels(row);
  return {
    ...base,
    ...permissionLevels,
    is_active: base.is_active !== false,
    invited_at: (base.invited_at as string | null | undefined) ?? null,
    swing_up: normalizeSwingUpRanks(base.swing_up),
    rank_promoted_on: (base.rank_promoted_on as string | null | undefined) ?? null,
    employee_number: (base.employee_number as string | null | undefined) ?? null,
    job_title: (base.job_title as string | null | undefined) ?? null,
    department: (base.department as string | null | undefined) ?? null,
    phone: (base.phone as string | null | undefined) ?? null,
    hire_date: (base.hire_date as string | null | undefined) ?? null,
    shift: (base.shift as PersonnelProfile["shift"] | undefined) ?? null,
    home_address: (base.home_address as string | null | undefined) ?? null,
    emergency_contacts: (base.emergency_contacts as string | null | undefined) ?? null,
    hr_info: (base.hr_info as string | null | undefined) ?? null,
    anniversary: (base.anniversary as string | null | undefined) ?? null,
    spouse_name: (base.spouse_name as string | null | undefined) ?? null,
    spouse_birthday: (base.spouse_birthday as string | null | undefined) ?? null,
    kids_birthdays: (base.kids_birthdays as string | null | undefined) ?? null,
    primary_location_id: (base.primary_location_id as string | null | undefined) ?? null,
    supervisor_id: (base.supervisor_id as string | null | undefined) ?? null,
    ems_cleared_level_id: (base.ems_cleared_level_id as string | null | undefined) ?? null,
    primary_location: asSingleRelation(row.primary_location as PersonnelProfile["primary_location"]),
    supervisor: asSingleRelation(row.supervisor as PersonnelProfile["supervisor"]),
    ems_cleared_level: asSingleRelation(
      row.ems_cleared_level as PersonnelProfile["ems_cleared_level"]
    ),
  };
}

async function attachSupervisors(supabase: SupabaseClient, rows: PersonnelProfile[]) {
  const missingIds = [
    ...new Set(
      rows
        .filter((row) => row.supervisor_id && !row.supervisor)
        .map((row) => row.supervisor_id as string)
    ),
  ];
  if (missingIds.length === 0) return rows;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name, email")
    .in("id", missingIds);
  if (error || !data?.length) return rows;

  const byId = new Map(data.map((row) => [row.id as string, row]));
  return rows.map((row) => {
    if (row.supervisor || !row.supervisor_id) return row;
    const supervisor = byId.get(row.supervisor_id);
    return supervisor ? { ...row, supervisor } : row;
  });
}

async function finalizePersonnelProfiles(supabase: SupabaseClient, rows: PersonnelProfile[]) {
  const withPermissions = await attachProfilePermissionLevels(supabase, rows);
  return attachSupervisors(supabase, withPermissions);
}

export async function fetchPersonnelDirectory(supabase: SupabaseClient) {
  const { data, error } = await excludePlatformOperatorsFromRoster(
    supabase.from("profiles").select(PERSONNEL_PROFILE_SELECT)
  ).order("display_name", { ascending: true, nullsFirst: false });

  if (error) {
    const fallback = await excludePlatformOperatorsFromRoster(
      supabase.from("profiles").select(PROFILE_ORG_COLUMNS)
    ).order("display_name", { ascending: true, nullsFirst: false });
    if (fallback.error) return { rows: [] as PersonnelProfile[], error };
    return {
      rows: await finalizePersonnelProfiles(
        supabase,
        (fallback.data ?? []).map((row) => normalizePersonnelProfile(row as Record<string, unknown>))
      ),
      error: null as PostgrestError | null,
    };
  }

  return {
    rows: await finalizePersonnelProfiles(
      supabase,
      (data ?? []).map((row) => normalizePersonnelProfile(row as Record<string, unknown>))
    ),
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
      .select(PROFILE_ORG_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return { profile: null as PersonnelProfile | null, error: error as PostgrestError };
    }
    const [profile] = await finalizePersonnelProfiles(supabase, [
      normalizePersonnelProfile(fallback.data as Record<string, unknown>),
    ]);
    return {
      profile,
      error: null as PostgrestError | null,
    };
  }

  if (!data) return { profile: null as PersonnelProfile | null, error: null as PostgrestError | null };
  const [profile] = await finalizePersonnelProfiles(supabase, [
    normalizePersonnelProfile(data as Record<string, unknown>),
  ]);
  return {
    profile,
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

export async function fetchPersonnelQualifications(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("personnel_qualifications")
    .select(PERSONNEL_QUALIFICATION_SELECT)
    .eq("profile_id", profileId)
    .order("earned_on", { ascending: false, nullsFirst: false });

  return {
    rows: (data ?? []) as unknown as PersonnelQualification[],
    error: error as PostgrestError | null,
  };
}

export async function fetchPersonnelEmsLicenses(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("personnel_ems_licenses")
    .select(PERSONNEL_EMS_LICENSE_SELECT)
    .eq("profile_id", profileId)
    .order("expires_on", { ascending: true, nullsFirst: false });

  return {
    rows: (data ?? []) as unknown as PersonnelEmsLicense[],
    error: error as PostgrestError | null,
  };
}

export async function fetchPersonnelRecognitions(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("personnel_recognitions")
    .select(PERSONNEL_RECOGNITION_SELECT)
    .eq("profile_id", profileId)
    .order("awarded_on", { ascending: false, nullsFirst: false });

  return {
    rows: (data ?? []) as PersonnelRecognition[],
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

export async function fetchPersonnelTaskbooks(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("personnel_taskbooks")
    .select(PERSONNEL_TASKBOOK_SELECT)
    .eq("profile_id", profileId)
    .order("requested_at", { ascending: false });

  return {
    rows: (data ?? []) as PersonnelTaskbook[],
    error: error as PostgrestError | null,
  };
}

export async function fetchPersonnelTaskbookPrerequisiteChecks(
  supabase: SupabaseClient,
  profileId: string
) {
  const { data, error } = await supabase
    .from("personnel_taskbook_prerequisite_checks")
    .select(PERSONNEL_TASKBOOK_PREREQ_CHECK_SELECT)
    .eq("profile_id", profileId)
    .order("checked_at", { ascending: true });

  return {
    rows: (data ?? []) as PersonnelTaskbookPrerequisiteCheck[],
    error: error as PostgrestError | null,
  };
}

export async function viewerHasDirectReports(
  supabase: SupabaseClient,
  viewer: SupervisorViewer
) {
  const { data: assigned, error: assignedError } = await supabase
    .from("profiles")
    .select("id")
    .eq("supervisor_id", viewer.id)
    .limit(1);

  if (assignedError) {
    return { hasReports: false, error: assignedError as PostgrestError };
  }
  if ((assigned ?? []).length > 0) {
    return { hasReports: true, error: null as PostgrestError | null };
  }

  if (!isBattalionChiefRank(viewer.rank) || !viewer.shift) {
    return { hasReports: false, error: null as PostgrestError | null };
  }

  const { data: shiftmates, error: shiftError } = await supabase
    .from("profiles")
    .select("id")
    .eq("shift", viewer.shift)
    .eq("is_active", true)
    .neq("id", viewer.id)
    .limit(1);

  if (shiftError) {
    return { hasReports: false, error: shiftError as PostgrestError };
  }
  return {
    hasReports: (shiftmates ?? []).length > 0,
    error: null as PostgrestError | null,
  };
}

export async function fetchSupervisorCrew(
  supabase: SupabaseClient,
  viewer: SupervisorViewer
) {
  const [assigned, shift] = await Promise.all([
    fetchAssignedReports(supabase, viewer.id),
    fetchShiftReports(supabase, viewer),
  ]);

  if (assigned.error) {
    return {
      rows: [] as PersonnelProfile[],
      taskbooksByProfile: {} as Record<string, PersonnelTaskbook[]>,
      qualificationsByProfile: {} as Record<string, PersonnelQualification[]>,
      error: assigned.error,
    };
  }
  if (shift.error) {
    return {
      rows: [] as PersonnelProfile[],
      taskbooksByProfile: {} as Record<string, PersonnelTaskbook[]>,
      qualificationsByProfile: {} as Record<string, PersonnelQualification[]>,
      error: shift.error,
    };
  }

  const rows = mergeProfilesById([assigned.rows, shift.rows]);
  const reportIds = rows.map((r) => r.id);
  const [
    { taskbooksByProfile, error: taskbooksError },
    { qualificationsByProfile, error: qualificationsError },
  ] = await Promise.all([
    fetchOpenTaskbooksByProfileIds(supabase, reportIds),
    fetchQualificationsByProfileIds(supabase, reportIds),
  ]);

  return {
    rows,
    taskbooksByProfile,
    qualificationsByProfile,
    error: taskbooksError ?? qualificationsError,
  };
}

export async function personHasSupervisorCoverage(
  supabase: SupabaseClient,
  person: { id: string; supervisor_id?: string | null; shift?: PersonnelShift | null }
) {
  if (person.supervisor_id) {
    return { hasSupervisor: true, error: null as PostgrestError | null };
  }
  if (!person.shift) {
    return { hasSupervisor: false, error: null as PostgrestError | null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("rank", "Battalion Chief")
    .eq("shift", person.shift)
    .eq("is_active", true)
    .neq("id", person.id)
    .limit(1);

  if (error) {
    return { hasSupervisor: false, error: error as PostgrestError };
  }
  return {
    hasSupervisor: (data ?? []).length > 0,
    error: null as PostgrestError | null,
  };
}

export async function listShiftBattalionChiefIds(
  supabase: SupabaseClient,
  shift: PersonnelShift,
  excludeId?: string
) {
  let query = supabase
    .from("profiles")
    .select("id")
    .eq("rank", "Battalion Chief")
    .eq("shift", shift)
    .eq("is_active", true);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) return { ids: [] as string[], error: error as PostgrestError };
  return {
    ids: (data ?? []).map((row) => row.id as string),
    error: null as PostgrestError | null,
  };
}

export async function fetchPendingTaskbookApprovals(
  supabase: SupabaseClient,
  viewer: SupervisorViewer
) {
  const [assigned, shift] = await Promise.all([
    excludePlatformOperatorsFromRoster(
      supabase.from("profiles").select("id")
    ).eq("supervisor_id", viewer.id),
    isBattalionChiefRank(viewer.rank) && viewer.shift
      ? excludePlatformOperatorsFromRoster(supabase.from("profiles").select("id"))
          .eq("shift", viewer.shift)
          .eq("is_active", true)
          .neq("id", viewer.id)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
  ]);

  if (assigned.error) {
    return { rows: [] as PersonnelTaskbook[], error: assigned.error as PostgrestError };
  }
  if (shift.error) {
    return { rows: [] as PersonnelTaskbook[], error: shift.error as PostgrestError };
  }

  const reportIds = [
    ...new Set([
      ...(assigned.data ?? []).map((r) => r.id as string),
      ...(shift.data ?? []).map((r) => r.id as string),
    ]),
  ];
  if (reportIds.length === 0) {
    return { rows: [] as PersonnelTaskbook[], error: null as PostgrestError | null };
  }

  const { data, error } = await supabase
    .from("personnel_taskbooks")
    .select(PERSONNEL_TASKBOOK_WITH_PROFILE_SELECT)
    .eq("status", "requested")
    .in("profile_id", reportIds)
    .order("requested_at", { ascending: true });

  if (error) {
    return { rows: [] as PersonnelTaskbook[], error: error as PostgrestError };
  }

  return {
    rows: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ...(r as unknown as PersonnelTaskbook),
        profile: asSingleRelation(r.profile as PersonnelTaskbook["profile"]),
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

/** Calendar year bounds as YYYY-MM-DD (inclusive start, exclusive end). */
export function trainingHoursYearBounds(now = new Date()) {
  const year = now.getFullYear();
  return {
    year,
    start: `${year}-01-01`,
    endExclusive: `${year + 1}-01-01`,
  };
}

/**
 * Sum Document Training session hours for a member in the current calendar year.
 * Uses occurred_on for in-house sessions and started_on for certification courses.
 */
export async function fetchPersonnelYtdTrainingHours(
  supabase: SupabaseClient,
  userId: string,
  now = new Date()
): Promise<{ hours: number; year: number; error: PostgrestError | null }> {
  const { year, start, endExclusive } = trainingHoursYearBounds(now);

  const { data, error } = await supabase
    .from("training_session_attendees")
    .select(
      "session_id, training_sessions!inner(hours, occurred_on, started_on, session_type)"
    )
    .eq("profile_id", userId);

  if (error) {
    if (isMissingTrainingSessionsTable(error)) {
      return { hours: 0, year, error: null };
    }
    return { hours: 0, year, error };
  }

  let total = 0;
  for (const row of data ?? []) {
    const session = asSingleRelation(
      row.training_sessions as
        | {
            hours: number | string | null;
            occurred_on: string | null;
            started_on: string | null;
            session_type: string;
          }
        | {
            hours: number | string | null;
            occurred_on: string | null;
            started_on: string | null;
            session_type: string;
          }[]
        | null
    );
    if (!session) continue;
    const sessionDate = session.occurred_on || session.started_on;
    if (!sessionDate || sessionDate < start || sessionDate >= endExclusive) continue;
    const hours = session.hours == null ? 0 : Number(session.hours);
    if (Number.isFinite(hours)) total += hours;
  }

  return { hours: total, year, error: null };
}
