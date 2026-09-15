import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchAssetsWithLatestInspection,
  fetchOpenMaintenanceRequestsByAssetIds,
} from "@/lib/assets";
import {
  fetchMaintenanceSchedulesByAssetIds,
  isScheduleDueSoon,
  isScheduleOverdue,
} from "@/lib/maintenance-schedules";
import { formatDate, isoDateLocal } from "@/lib/dates";

export type FleetStatusReportRow = Record<string, unknown> & {
  unit: string;
  type: string;
  station: string;
  status: string;
  openWorkOrders: number;
  nextPm: string;
  pmStatus: string;
};

export async function loadFleetStatusReport(): Promise<{ rows: FleetStatusReportRow[] }> {
  const supabase = await createSupabaseServerClient();
  const { rows: assets, error } = await fetchAssetsWithLatestInspection(supabase, "apparatus");
  if (error) throw error;

  const assetIds = assets.map((asset) => asset.id);
  const [{ byAssetId: openByAsset }, { byAssetId: schedulesByAsset }] = await Promise.all([
    fetchOpenMaintenanceRequestsByAssetIds(supabase, assetIds),
    fetchMaintenanceSchedulesByAssetIds(supabase, assetIds),
  ]);

  const today = isoDateLocal(new Date());
  const rows: FleetStatusReportRow[] = assets.map((asset) => {
    const schedules = schedulesByAsset[asset.id] ?? [];
    const nextPm = [...schedules].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))[0];
    let pmStatus = "—";
    if (nextPm) {
      if (isScheduleOverdue(nextPm.next_due_on, today)) pmStatus = "Overdue";
      else if (isScheduleDueSoon(nextPm.next_due_on, 7, today)) pmStatus = "Due soon";
      else pmStatus = "OK";
    }

    return {
      unit: asset.unit_number || asset.build_number || asset.name || asset.id,
      type: asset.apparatus_type || "",
      station: asset.station || "",
      status: asset.status || "",
      openWorkOrders: (openByAsset[asset.id] ?? []).length,
      nextPm: nextPm ? formatDate(nextPm.next_due_on) : "",
      pmStatus,
    };
  });

  rows.sort((a, b) => String(a.station).localeCompare(String(b.station)) || String(a.unit).localeCompare(String(b.unit)));
  return { rows };
}

export const FLEET_STATUS_COLUMNS = [
  { key: "unit", header: "Unit" },
  { key: "type", header: "Type" },
  { key: "station", header: "Station" },
  { key: "status", header: "Status" },
  { key: "openWorkOrders", header: "Open WOs" },
  { key: "nextPm", header: "Next PM" },
  { key: "pmStatus", header: "PM status" },
];
