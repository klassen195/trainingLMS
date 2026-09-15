import { createSupabaseServerClient } from "@/lib/supabase/server";
import { personnelDisplayName, personnelShiftLabel, type PersonnelShift } from "@/lib/personnel-types";
import { trainingHoursYearBounds } from "@/lib/personnel";
import { isMissingTrainingSessionsTable } from "@/lib/supabase/errors";

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type TrainingHoursReportRow = Record<string, unknown> & {
  person: string;
  employeeNumber: string;
  shift: string;
  station: string;
  hours: number;
  sessions: number;
};

export async function loadTrainingHoursReport(options?: {
  start?: string;
  endExclusive?: string;
}): Promise<{ rows: TrainingHoursReportRow[]; start: string; endExclusive: string; year: number }> {
  const bounds = trainingHoursYearBounds();
  const start = options?.start ?? bounds.start;
  const endExclusive = options?.endExclusive ?? bounds.endExclusive;

  const supabase = await createSupabaseServerClient();
  const [{ data: attendees, error: attendeesError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from("training_session_attendees").select(
        "profile_id, training_sessions!inner(hours, occurred_on, started_on, session_type, category:training_categories!category_id(id, name))"
      ),
      supabase
        .from("profiles")
        .select(
          "id, display_name, first_name, last_name, email, employee_number, shift, primary_location:locations!profiles_primary_location_id_fkey(id, name), is_active, is_platform_operator"
        )
        .eq("is_active", true)
        .eq("is_platform_operator", false),
    ]);

  if (attendeesError) {
    if (isMissingTrainingSessionsTable(attendeesError)) {
      return { rows: [], start, endExclusive, year: bounds.year };
    }
    throw attendeesError;
  }
  if (profilesError) throw profilesError;

  const totals = new Map<string, { hours: number; sessions: number }>();
  for (const row of attendees ?? []) {
    const session = asSingle(
      row.training_sessions as
        | {
            hours: number | string | null;
            occurred_on: string | null;
            started_on: string | null;
          }
        | {
            hours: number | string | null;
            occurred_on: string | null;
            started_on: string | null;
          }[]
        | null
    );
    if (!session) continue;
    const sessionDate = session.occurred_on || session.started_on;
    if (!sessionDate || sessionDate < start || sessionDate >= endExclusive) continue;
    const hours = session.hours == null ? 0 : Number(session.hours);
    if (!Number.isFinite(hours)) continue;
    const profileId = row.profile_id as string;
    const current = totals.get(profileId) ?? { hours: 0, sessions: 0 };
    current.hours += hours;
    current.sessions += 1;
    totals.set(profileId, current);
  }

  const rows: TrainingHoursReportRow[] = [];
  for (const profile of profiles ?? []) {
    const total = totals.get(profile.id as string);
    if (!total) continue;
    const loc = asSingle(
      profile.primary_location as { id: string; name: string } | { id: string; name: string }[] | null
    );
    rows.push({
      person: personnelDisplayName({
        display_name: profile.display_name as string | null,
        first_name: profile.first_name as string | null,
        last_name: profile.last_name as string | null,
        email: profile.email as string | null,
      }),
      employeeNumber: (profile.employee_number as string | null) ?? "",
      shift: personnelShiftLabel(profile.shift as PersonnelShift | null),
      station: loc?.name ?? "",
      hours: Math.round(total.hours * 100) / 100,
      sessions: total.sessions,
    });
  }

  rows.sort((a, b) => Number(b.hours) - Number(a.hours) || String(a.person).localeCompare(String(b.person)));
  return { rows, start, endExclusive, year: bounds.year };
}

export const TRAINING_HOURS_COLUMNS = [
  { key: "person", header: "Person" },
  { key: "employeeNumber", header: "Employee #" },
  { key: "shift", header: "Shift" },
  { key: "station", header: "Station" },
  { key: "hours", header: "Hours" },
  { key: "sessions", header: "Sessions" },
];
