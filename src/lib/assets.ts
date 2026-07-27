import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASSET_WITH_ASSIGNEE_SELECT,
  type AssetKind,
  type AssetListRow,
  type AssetWithAssignee,
} from "@/lib/assets-types";

type LatestInspection = {
  asset_id: string;
  inspected_at: string;
  next_due_on: string | null;
};

type ProfileRef = { id: string; display_name: string | null; email: string | null };

export function asSingleProfile(
  value: ProfileRef | ProfileRef[] | null | undefined
): ProfileRef | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeAssetRow(raw: Record<string, unknown>): AssetWithAssignee {
  const { assignee, ...rest } = raw;
  return {
    ...(rest as Omit<AssetWithAssignee, "assignee">),
    assignee: asSingleProfile(assignee as ProfileRef | ProfileRef[] | null | undefined),
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
    .order("name", { ascending: true });

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
