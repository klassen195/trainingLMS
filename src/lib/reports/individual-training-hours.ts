import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, hoursBetweenTimes } from "@/lib/dates";
import {
  trainingSessionDayTitle,
  trainingSessionTypeLabel,
  type TrainingSessionType,
} from "@/lib/document-training-types";
import { trainingHoursYearBounds } from "@/lib/personnel";
import { personnelDisplayName } from "@/lib/personnel-types";
import { isMissingTrainingSessionsTable } from "@/lib/supabase/errors";

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

type SessionCategory = { id: string; name: string };

type SessionDay = {
  occurred_on: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  presenter: string | null;
  sort_order: number | null;
  category: SessionCategory | SessionCategory[] | null;
};

type SessionRow = {
  id: string;
  title: string | null;
  hours: number | string | null;
  hours_overridden: boolean | null;
  occurred_on: string | null;
  started_on: string | null;
  ended_on: string | null;
  session_type: TrainingSessionType;
  location: string | null;
  instructor_name: string | null;
  provider: string | null;
  category_by_day: boolean | null;
  category: SessionCategory | SessionCategory[] | null;
  days: SessionDay | SessionDay[] | null;
};

export type IndividualTrainingHoursReportRow = Record<string, unknown> & {
  date: string;
  title: string;
  session: string;
  type: string;
  category: string;
  hours: number;
  location: string;
  instructorOrProvider: string;
};

export type IndividualTrainingHoursPersonOption = {
  id: string;
  label: string;
};

function uniqueCategoryNames(categories: Array<SessionCategory | null | undefined>) {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const category of categories) {
    if (!category?.id || !category.name) continue;
    if (seen.has(category.id)) continue;
    seen.add(category.id);
    names.push(category.name);
  }
  return names;
}

function dayHoursForSession(days: SessionDay[], sessionHours: number, hoursOverridden: boolean) {
  const timed = days.map((day) => hoursBetweenTimes(day.start_time, day.end_time) ?? 0);
  const timedTotal = timed.reduce((sum, value) => sum + value, 0);
  if (hoursOverridden && timedTotal > 0 && Number.isFinite(sessionHours) && sessionHours > 0) {
    return timed.map((value) => Math.round(((value * sessionHours) / timedTotal) * 100) / 100);
  }
  return timed.map((value) => Math.round(value * 100) / 100);
}

export async function loadIndividualTrainingHoursReport(options: {
  profileId: string;
  start?: string;
  endExclusive?: string;
}): Promise<{
  rows: IndividualTrainingHoursReportRow[];
  start: string;
  endExclusive: string;
  year: number;
  personName: string | null;
  totalHours: number;
}> {
  const bounds = trainingHoursYearBounds();
  const start = options.start ?? bounds.start;
  const endExclusive = options.endExclusive ?? bounds.endExclusive;
  const profileId = options.profileId;

  const supabase = await createSupabaseServerClient();
  const [{ data: attendees, error: attendeesError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("training_session_attendees")
        .select(
          "profile_id, training_sessions!inner(id, title, hours, hours_overridden, occurred_on, started_on, ended_on, session_type, location, instructor_name, provider, category_by_day, category:training_categories!category_id(id, name), days:training_session_days(occurred_on, start_time, end_time, title, presenter, sort_order, category:training_categories!category_id(id, name)))"
        )
        .eq("profile_id", profileId),
      supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name, email")
        .eq("id", profileId)
        .maybeSingle(),
    ]);

  if (attendeesError) {
    if (isMissingTrainingSessionsTable(attendeesError)) {
      return {
        rows: [],
        start,
        endExclusive,
        year: bounds.year,
        personName: null,
        totalHours: 0,
      };
    }
    throw attendeesError;
  }
  if (profileError) throw profileError;

  const personName = profile
    ? personnelDisplayName({
        display_name: profile.display_name as string | null,
        first_name: profile.first_name as string | null,
        last_name: profile.last_name as string | null,
        email: profile.email as string | null,
      })
    : null;

  const pending: Array<IndividualTrainingHoursReportRow & { sortDate: string }> = [];
  let totalHours = 0;

  for (const row of attendees ?? []) {
    const session = asSingle(row.training_sessions as SessionRow | SessionRow[] | null);
    if (!session) continue;

    const sessionTitle = (session.title ?? "").trim() || "Untitled session";
    const sessionType = trainingSessionTypeLabel(session.session_type);
    const location = (session.location ?? "").trim();
    const sessionHours = session.hours == null ? 0 : Number(session.hours);
    if (!Number.isFinite(sessionHours)) continue;

    const days = asArray(session.days).slice().sort((a, b) => {
      const byOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (byOrder !== 0) return byOrder;
      return a.occurred_on.localeCompare(b.occurred_on);
    });

    // Category-by-day courses: one report row per day so each category stays accurate.
    if (session.category_by_day && days.length > 0) {
      const allocatedHours = dayHoursForSession(
        days,
        sessionHours,
        Boolean(session.hours_overridden)
      );

      days.forEach((day, index) => {
        if (day.occurred_on < start || day.occurred_on >= endExclusive) return;

        const hours = allocatedHours[index] ?? 0;
        const category = asSingle(day.category);
        const presenter = (day.presenter ?? "").trim();

        totalHours += hours;
        pending.push({
          sortDate: day.occurred_on,
          date: formatDate(day.occurred_on),
          title: sessionTitle,
          session: trainingSessionDayTitle(day, index, days.length),
          type: sessionType,
          category: category?.name ?? "",
          hours,
          location,
          instructorOrProvider:
            presenter || (session.provider ?? "").trim() || "",
        });
      });
      continue;
    }

    const sessionDate = session.occurred_on || session.started_on;
    if (!sessionDate || sessionDate < start || sessionDate >= endExclusive) continue;

    const roundedHours = Math.round(sessionHours * 100) / 100;
    totalHours += roundedHours;

    const categoryNames =
      days.length > 0
        ? uniqueCategoryNames(days.map((day) => asSingle(day.category)))
        : [];
    const category =
      categoryNames.length > 0
        ? categoryNames.join(", ")
        : asSingle(session.category)?.name ?? "";

    const dateLabel =
      session.session_type === "certification_course" &&
      session.started_on &&
      session.ended_on &&
      session.started_on !== session.ended_on
        ? `${formatDate(session.started_on)} – ${formatDate(session.ended_on)}`
        : formatDate(sessionDate);

    pending.push({
      sortDate: sessionDate,
      date: dateLabel,
      title: sessionTitle,
      session: "",
      type: sessionType,
      category,
      hours: roundedHours,
      location,
      instructorOrProvider:
        (session.instructor_name ?? session.provider ?? "").trim() || "",
    });
  }

  pending.sort(
    (a, b) =>
      b.sortDate.localeCompare(a.sortDate) || String(a.title).localeCompare(String(b.title))
  );
  const rows: IndividualTrainingHoursReportRow[] = pending.map(({ sortDate: _sortDate, ...row }) => row);

  return {
    rows,
    start,
    endExclusive,
    year: bounds.year,
    personName,
    totalHours: Math.round(totalHours * 100) / 100,
  };
}

export async function listIndividualTrainingHoursPeople(): Promise<
  IndividualTrainingHoursPersonOption[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, first_name, last_name, email, is_active, is_platform_operator"
    )
    .eq("is_active", true)
    .eq("is_platform_operator", false)
    .order("display_name", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((profile) => ({
      id: profile.id as string,
      label: personnelDisplayName({
        display_name: profile.display_name as string | null,
        first_name: profile.first_name as string | null,
        last_name: profile.last_name as string | null,
        email: profile.email as string | null,
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export const INDIVIDUAL_TRAINING_HOURS_COLUMNS = [
  { key: "date", header: "Date" },
  { key: "title", header: "Title" },
  { key: "session", header: "Session" },
  { key: "type", header: "Type" },
  { key: "category", header: "Category" },
  { key: "hours", header: "Hours" },
  { key: "location", header: "Location" },
  { key: "instructorOrProvider", header: "Instructor / Provider" },
];
