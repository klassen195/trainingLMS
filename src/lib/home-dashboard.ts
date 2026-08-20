import type { SupabaseClient } from "@supabase/supabase-js";
import {
  approvalDocTypeLabel,
  approvalStageLabel,
  approvalTrackLabel,
  daysInApprovalStageLabel,
  groupStageMemberIds,
  isWaitingOnApprovalUser,
  APPROVAL_DOCUMENT_LIST_SELECT,
  APPROVAL_STAGE_MEMBER_SELECT,
  type ApprovalDocument,
  type ApprovalProfileSummary,
  type ApprovalStageMember,
} from "@/lib/approval-tracker-types";
import { assetDisplayLabel, type ApparatusType } from "@/lib/assets-types";
import type { AppCapability } from "@/lib/capabilities";
import {
  DEFAULT_WEATHER_LOCATION,
  HOME_WIDGET_CATALOG,
  parseHomeWidgetTypes,
  type ApparatusOosItem,
  type ApprovalQueueItem,
  type FlagLevel,
  type FlagSnapshot,
  type HomeDashboardPayload,
  type HomeWidgetCatalogItem,
  type HomeWidgetType,
  type OpenTaskbookItem,
} from "@/lib/home-dashboard-types";
import { apparatusTypeLabel } from "@/lib/labels";
import { loadNwsFlagAlerts, loadNwsWeather } from "@/lib/nws-weather";
import { loadFlagMastStatus } from "@/lib/flag-mast";
import { fetchPersonnelTaskbooks } from "@/lib/personnel";
import {
  isTaskbookOverdue,
  personnelDisplayName,
  taskbookStatusLabel,
  taskbookTimeLeftLabel,
  type PersonnelTaskbook,
} from "@/lib/personnel-types";
import { isAdmin } from "@/lib/permissions";
import {
  isMissingApprovalTrackerTables,
  isMissingAssetsTable,
  isMissingHomeDashboardTables,
  isMissingPersonnelTables,
} from "@/lib/supabase/errors";
import type { Profile } from "@/lib/training-lms-types";

function availableWidgetTypes(caps: Record<AppCapability, boolean>): HomeWidgetType[] {
  const types: HomeWidgetType[] = ["weather", "fire_danger", "flag_mast"];
  if (caps.view_apparatus || caps.view_fleet || caps.manage_assets) types.push("apparatus_oos");
  if (caps.approval_tracker) types.push("approvals_queue");
  types.push("open_taskbooks");
  return types;
}

function catalogFor(types: HomeWidgetType[]): HomeWidgetCatalogItem[] {
  return types.map((type) => ({ type, ...HOME_WIDGET_CATALOG[type] }));
}

function greetingName(profile: Profile) {
  const first = profile.first_name?.trim();
  if (first) return first;
  const display = profile.display_name?.trim();
  if (display) return display.split(/\s+/)[0] ?? display;
  return "there";
}

async function loadLayout(
  supabase: SupabaseClient,
  profileId: string
): Promise<{ widgets: HomeWidgetType[] | null; persisted: boolean }> {
  const { data, error } = await supabase
    .from("home_dashboard_layouts")
    .select("widget_types")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    if (isMissingHomeDashboardTables(error)) return { widgets: null, persisted: false };
    throw error;
  }
  if (!data) return { widgets: null, persisted: true };
  return { widgets: parseHomeWidgetTypes(data.widget_types), persisted: true };
}

async function loadOpsSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("client_ops_settings")
    .select("weather_latitude, weather_longitude, weather_label, flag_level, flag_updated_at, flag_updated_by")
    .maybeSingle();

  if (error) {
    if (isMissingHomeDashboardTables(error)) return null;
    throw error;
  }
  if (!data) return null;

  let updater: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null = null;
  if (data.flag_updated_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, first_name, last_name, email")
      .eq("id", data.flag_updated_by)
      .maybeSingle();
    updater = profile;
  }

  return {
    weather_latitude: data.weather_latitude as number,
    weather_longitude: data.weather_longitude as number,
    weather_label: data.weather_label as string,
    flag_level: data.flag_level as FlagLevel,
    flag_updated_at: data.flag_updated_at as string | null,
    flag_updated_by: data.flag_updated_by as string | null,
    updater,
  };
}

async function loadWeatherAndFlag(
  settings: Awaited<ReturnType<typeof loadOpsSettings>>
): Promise<{
  weather: HomeDashboardPayload["data"]["weather"];
  flag: FlagSnapshot;
}> {
  const latitude = settings?.weather_latitude ?? DEFAULT_WEATHER_LOCATION.latitude;
  const longitude = settings?.weather_longitude ?? DEFAULT_WEATHER_LOCATION.longitude;
  const label = settings?.weather_label ?? DEFAULT_WEATHER_LOCATION.label;

  const [weatherResult, alertsResult] = await Promise.allSettled([
    loadNwsWeather({ latitude, longitude, label }),
    loadNwsFlagAlerts({ latitude, longitude }),
  ]);

  const updater = settings?.updater;
  const updatedByName = updater
    ? personnelDisplayName({
        first_name: updater.first_name,
        last_name: updater.last_name,
        display_name: updater.display_name,
        email: updater.email,
      })
    : null;

  return {
    weather:
      weatherResult.status === "fulfilled"
        ? weatherResult.value
        : { error: weatherResult.reason instanceof Error ? weatherResult.reason.message : "Weather is unavailable." },
    flag: {
      level: settings?.flag_level ?? "unset",
      updatedAt: settings?.flag_updated_at ?? null,
      updatedByName,
      alerts: alertsResult.status === "fulfilled" ? alertsResult.value : [],
    },
  };
}

async function loadApparatusOos(supabase: SupabaseClient): Promise<ApparatusOosItem[] | { error: string }> {
  const { data, error } = await supabase
    .from("assets")
    .select("id, name, unit_number, build_number, status, station, apparatus_type, kind")
    .eq("kind", "apparatus")
    .eq("status", "out_of_service")
    .order("unit_number", { ascending: true });

  if (error) {
    if (isMissingAssetsTable(error)) return { error: "Apparatus inventory is not set up yet." };
    return { error: error.message };
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: assetDisplayLabel({
      kind: "apparatus",
      name: row.name as string | null,
      unit_number: row.unit_number as string | null,
      build_number: row.build_number as string | null,
    }),
    station: (row.station as string | null) || null,
    typeLabel: row.apparatus_type ? apparatusTypeLabel(row.apparatus_type as ApparatusType) : null,
  }));
}

async function loadApprovalsQueue(
  supabase: SupabaseClient,
  profileId: string
): Promise<ApprovalQueueItem[] | { error: string }> {
  const [{ data: documents, error: documentsError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from("approval_documents")
        .select(APPROVAL_DOCUMENT_LIST_SELECT)
        .is("archived_at", null)
        .order("stage_entered_at", { ascending: true }),
      supabase.from("approval_stage_members").select(APPROVAL_STAGE_MEMBER_SELECT),
    ]);

  if (documentsError) {
    if (isMissingApprovalTrackerTables(documentsError)) {
      return { error: "Approval tracker is not set up yet." };
    }
    return { error: documentsError.message };
  }
  if (membersError) {
    if (isMissingApprovalTrackerTables(membersError)) {
      return { error: "Approval tracker is not set up yet." };
    }
    return { error: membersError.message };
  }

  const docs = (documents ?? []) as unknown as (ApprovalDocument & {
    creator?: ApprovalProfileSummary | null;
  })[];
  if (docs.length === 0) return [];

  const stageMemberIds = groupStageMemberIds((members ?? []) as unknown as ApprovalStageMember[]);

  return docs
    .filter((doc) =>
      isWaitingOnApprovalUser({
        userId: profileId,
        stage: doc.current_stage,
        track: doc.track,
        createdBy: doc.created_by,
        stageMemberIds,
      })
    )
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      docTypeLabel: approvalDocTypeLabel(doc.doc_type),
      stageLabel: `${approvalTrackLabel(doc.track)} · ${approvalStageLabel(doc.current_stage)}`,
      daysInStage: daysInApprovalStageLabel(doc.stage_entered_at),
    }));
}

function toOpenTaskbookItem(taskbook: PersonnelTaskbook): OpenTaskbookItem {
  return {
    id: taskbook.id,
    rank: taskbook.rank,
    statusLabel: taskbookStatusLabel(taskbook),
    dueLabel: taskbook.status === "active" ? taskbookTimeLeftLabel(taskbook.due_on) : null,
    overdue: isTaskbookOverdue(taskbook),
  };
}

async function loadOpenTaskbooks(
  supabase: SupabaseClient,
  profileId: string
): Promise<OpenTaskbookItem[] | { error: string }> {
  const { rows, error } = await fetchPersonnelTaskbooks(supabase, profileId);
  if (error) {
    if (isMissingPersonnelTables(error)) return { error: "Taskbooks are not set up yet." };
    return { error: error.message };
  }
  return rows
    .filter((taskbook) => taskbook.status === "requested" || taskbook.status === "active")
    .map(toOpenTaskbookItem);
}

export async function loadHomeDashboard(input: {
  profile: Profile;
  capabilities: Record<AppCapability, boolean>;
  supabase: SupabaseClient;
}): Promise<HomeDashboardPayload> {
  const available = availableWidgetTypes(input.capabilities);
  const { widgets: stored, persisted } = await loadLayout(input.supabase, input.profile.id);
  const widgets = (stored ?? available).filter((type) => available.includes(type));

  const needsWeather = available.includes("weather") || available.includes("fire_danger");
  const settings = needsWeather ? await loadOpsSettings(input.supabase) : null;

  const [weatherAndFlag, flagMast, apparatus, approvals, taskbooks] = await Promise.all([
    needsWeather
      ? loadWeatherAndFlag(settings)
      : Promise.resolve({ weather: null, flag: null as FlagSnapshot | null }),
    available.includes("flag_mast")
      ? loadFlagMastStatus().catch((err: unknown) => ({
          error: err instanceof Error ? err.message : "Flag status is unavailable.",
        }))
      : Promise.resolve(null),
    available.includes("apparatus_oos")
      ? loadApparatusOos(input.supabase)
      : Promise.resolve(null),
    available.includes("approvals_queue")
      ? loadApprovalsQueue(input.supabase, input.profile.id)
      : Promise.resolve(null),
    available.includes("open_taskbooks")
      ? loadOpenTaskbooks(input.supabase, input.profile.id)
      : Promise.resolve(null),
  ]);

  return {
    profileId: input.profile.id,
    greetingName: greetingName(input.profile),
    widgets,
    availableWidgets: catalogFor(available),
    canEditFlag: isAdmin(input.profile),
    layoutPersisted: persisted,
    data: {
      weather: available.includes("weather") ? weatherAndFlag.weather : null,
      flag: available.includes("fire_danger") ? weatherAndFlag.flag : null,
      flagMast,
      apparatus,
      approvals,
      taskbooks,
    },
  };
}

