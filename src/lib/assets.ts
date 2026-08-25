import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASSET_WITH_ASSIGNEE_SELECT,
  type AssetKind,
  type AssetListRow,
  type AssetWithAssignee,
} from "@/lib/assets-types";
import {
  MAINTENANCE_PHOTO_BUCKET,
  MAINTENANCE_REQUEST_SELECT,
  MAINTENANCE_REQUEST_WITH_REQUESTER_SELECT,
  type MaintenanceRequest,
  type MaintenanceRequestWithRequester,
} from "@/lib/maintenance-types";
import { isMissingMaintenanceRequestsTable, isMissingVehicleChecksTable } from "@/lib/supabase/errors";

type LatestInspection = {
  asset_id: string;
  inspected_at: string;
  next_due_on: string | null;
};

type VehicleCheckSummary = {
  asset_id: string;
  checked_at: string;
  includes_daily: boolean;
  includes_weekly: boolean;
};

type ProfileRef = { id: string; display_name: string | null; email: string | null };
type CategoryRef = { id: string; name: string };
type SubcategoryRef = { id: string; name: string; equipment_category_id: string };
type ApparatusRef = {
  id: string;
  name: string | null;
  unit_number: string | null;
  build_number: string | null;
  kind: AssetKind;
};

export function asSingleProfile(
  value: ProfileRef | ProfileRef[] | null | undefined
): ProfileRef | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asSingleCategory(
  value: CategoryRef | CategoryRef[] | null | undefined
): CategoryRef | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asSingleSubcategory(
  value: SubcategoryRef | SubcategoryRef[] | null | undefined
): SubcategoryRef | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asSingleApparatus(
  value: ApparatusRef | ApparatusRef[] | null | undefined
): ApparatusRef | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function normalizeAssetRow(raw: Record<string, unknown>): AssetWithAssignee {
  const { assignee, assigned_apparatus, equipment_category, equipment_subcategory, ...rest } = raw;
  return {
    ...(rest as Omit<
      AssetWithAssignee,
      "assignee" | "assigned_apparatus" | "equipment_category" | "equipment_subcategory"
    >),
    assignee: asSingleProfile(assignee as ProfileRef | ProfileRef[] | null | undefined),
    assigned_apparatus: asSingleApparatus(
      assigned_apparatus as ApparatusRef | ApparatusRef[] | null | undefined
    ),
    equipment_category: asSingleCategory(
      equipment_category as CategoryRef | CategoryRef[] | null | undefined
    ),
    equipment_subcategory: asSingleSubcategory(
      equipment_subcategory as SubcategoryRef | SubcategoryRef[] | null | undefined
    ),
  };
}

export async function fetchAssetsWithLatestInspection(
  supabase: SupabaseClient,
  kind: AssetKind,
  options?: { station?: string; assignedTo?: string }
): Promise<{ rows: AssetListRow[]; error: PostgrestError | null }> {
  let query = supabase
    .from("assets")
    .select(ASSET_WITH_ASSIGNEE_SELECT)
    .eq("kind", kind)
    .order(kind === "apparatus" ? "build_number" : "name", { ascending: true });

  if (options?.station) {
    query = query.eq("station", options.station);
  }
  if (options?.assignedTo) {
    query = query.eq("assigned_to", options.assignedTo);
  }

  const { data: assets, error } = await query;
  if (error) return { rows: [], error };

  const list = ((assets ?? []) as Record<string, unknown>[]).map(normalizeAssetRow);
  if (list.length === 0) return { rows: [], error: null };

  const ids = list.map((a) => a.id);

  if (kind === "apparatus") {
    const { data: checks, error: checksError } = await supabase
      .from("vehicle_checks")
      .select("asset_id, checked_at, includes_daily, includes_weekly")
      .in("asset_id", ids)
      .order("checked_at", { ascending: false });

    if (checksError) {
      if (isMissingVehicleChecksTable(checksError)) {
        return {
          rows: list.map((asset) => ({
            ...asset,
            latest_daily_checked_at: null,
            latest_weekly_checked_at: null,
          })),
          error: null,
        };
      }
      return { rows: [], error: checksError };
    }

    const latestDaily = new Map<string, string>();
    const latestWeekly = new Map<string, string>();
    for (const row of (checks ?? []) as VehicleCheckSummary[]) {
      if (row.includes_daily && !latestDaily.has(row.asset_id)) {
        latestDaily.set(row.asset_id, row.checked_at);
      }
      if (row.includes_weekly && !latestWeekly.has(row.asset_id)) {
        latestWeekly.set(row.asset_id, row.checked_at);
      }
    }

    const rows: AssetListRow[] = list.map((asset) => ({
      ...asset,
      latest_daily_checked_at: latestDaily.get(asset.id) ?? null,
      latest_weekly_checked_at: latestWeekly.get(asset.id) ?? null,
    }));

    return { rows, error: null };
  }

  const { data: inspections, error: inspectionError } = await supabase
    .from("asset_inspections")
    .select("asset_id, inspected_at, next_due_on")
    .in("asset_id", ids)
    .order("inspected_at", { ascending: false });

  if (inspectionError) return { rows: [], error: inspectionError };

  const latestByAsset = new Map<string, LatestInspection>();
  for (const row of (inspections ?? []) as LatestInspection[]) {
    if (!latestByAsset.has(row.asset_id)) {
      latestByAsset.set(row.asset_id, row);
    }
  }

  const rows: AssetListRow[] = list.map((asset) => {
    const latest = latestByAsset.get(asset.id);
    return {
      ...asset,
      latest_inspected_at: latest?.inspected_at ?? null,
      latest_next_due_on: latest?.next_due_on ?? null,
    };
  });

  return { rows, error: null };
}

export async function fetchOpenMaintenanceRequestsByAssetIds(
  supabase: SupabaseClient,
  assetIds: string[]
): Promise<{ byAssetId: Record<string, MaintenanceRequest[]>; error: PostgrestError | null }> {
  if (assetIds.length === 0) return { byAssetId: {}, error: null };

  const { data, error } = await supabase
    .from("maintenance_requests")
    .select(MAINTENANCE_REQUEST_SELECT)
    .in("asset_id", assetIds)
    .eq("status", "open")
    .order("requested_at", { ascending: false });

  if (isMissingMaintenanceRequestsTable(error)) return { byAssetId: {}, error: null };
  if (error) return { byAssetId: {}, error };

  const byAssetId: Record<string, MaintenanceRequest[]> = {};
  for (const request of (data ?? []) as MaintenanceRequest[]) {
    const list = byAssetId[request.asset_id] ?? [];
    list.push({
      ...request,
      assigned_to: request.assigned_to ?? null,
      shop_status: request.shop_status ?? "new",
      shop_notes: request.shop_notes ?? "",
    });
    byAssetId[request.asset_id] = list;
  }

  return { byAssetId, error: null };
}

export async function fetchMaintenanceRequestsForAsset(
  supabase: SupabaseClient,
  assetId: string
): Promise<{ requests: MaintenanceRequestWithRequester[]; error: PostgrestError | null }> {
  const { data: maintenanceRows, error } = await supabase
    .from("maintenance_requests")
    .select(MAINTENANCE_REQUEST_WITH_REQUESTER_SELECT)
    .eq("asset_id", assetId)
    .order("requested_at", { ascending: false });

  if (isMissingMaintenanceRequestsTable(error)) return { requests: [], error: null };
  if (error) return { requests: [], error };

  const requests = await Promise.all(
    ((maintenanceRows ?? []) as Record<string, unknown>[]).map(async (item) => {
      const { requester, ...rest } = item;
      const rowRequest: MaintenanceRequestWithRequester = {
        ...(rest as Omit<MaintenanceRequestWithRequester, "requester" | "photo_url">),
        requester: asSingleProfile(
          requester as
            | { id: string; display_name: string | null; email: string | null }
            | { id: string; display_name: string | null; email: string | null }[]
            | null
            | undefined
        ),
        photo_url: null,
      };

      if (rowRequest.photo_storage_path) {
        const { data: signed } = await supabase.storage
          .from(MAINTENANCE_PHOTO_BUCKET)
          .createSignedUrl(rowRequest.photo_storage_path, 3600);
        rowRequest.photo_url = signed?.signedUrl ?? null;
      }

      return rowRequest;
    })
  );

  return { requests, error: null };
}
