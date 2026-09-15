import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAssetsWithLatestInspection } from "@/lib/assets";
import { daysUntilExpiry } from "@/lib/personnel-types";
import { formatDate } from "@/lib/dates";

export type PpeDueReportRow = Record<string, unknown> & {
  item: string;
  category: string;
  station: string;
  assignee: string;
  status: string;
  expiresOn: string;
  daysUntilExpiry: number | string;
  inspectionDue: string;
  daysUntilInspection: number | string;
  urgency: string;
};

function urgencyLabel(days: number | null) {
  if (days == null) return "";
  if (days < 0) return "Overdue";
  if (days <= 30) return "Due soon";
  if (days <= 90) return "Upcoming";
  return "OK";
}

export async function loadPpeDueReport(options?: {
  withinDays?: number;
}): Promise<{ rows: PpeDueReportRow[]; withinDays: number }> {
  const withinDays = options?.withinDays ?? 180;
  const supabase = await createSupabaseServerClient();
  const { rows: assets, error } = await fetchAssetsWithLatestInspection(supabase, "ppe");
  if (error) throw error;

  const rows: PpeDueReportRow[] = [];

  for (const asset of assets) {
    const expiresDays = asset.expires_on ? daysUntilExpiry(asset.expires_on) : null;
    const inspectionDays = asset.latest_next_due_on
      ? daysUntilExpiry(asset.latest_next_due_on)
      : null;

    const expiryInHorizon =
      expiresDays != null && expiresDays <= withinDays;
    const inspectionInHorizon =
      inspectionDays != null && inspectionDays <= withinDays;

    if (!expiryInHorizon && !inspectionInHorizon) continue;

    const urgencyCandidates = [expiresDays, inspectionDays].filter(
      (value): value is number => value != null
    );
    const worst = urgencyCandidates.length ? Math.min(...urgencyCandidates) : null;

    rows.push({
      item: asset.name || asset.description || asset.serial_number || asset.id,
      category: asset.equipment_category?.name || asset.ppe_category || "",
      station: asset.assigned_station || asset.station || "",
      assignee: asset.assignee?.display_name || asset.assignee?.email || "",
      status: asset.status || "",
      expiresOn: formatDate(asset.expires_on),
      daysUntilExpiry: expiresDays ?? "",
      inspectionDue: formatDate(asset.latest_next_due_on),
      daysUntilInspection: inspectionDays ?? "",
      urgency: urgencyLabel(worst),
    });
  }

  rows.sort((a, b) => {
    const ad = typeof a.daysUntilExpiry === "number" ? a.daysUntilExpiry : 9999;
    const bd = typeof b.daysUntilExpiry === "number" ? b.daysUntilExpiry : 9999;
    const ai = typeof a.daysUntilInspection === "number" ? a.daysUntilInspection : 9999;
    const bi = typeof b.daysUntilInspection === "number" ? b.daysUntilInspection : 9999;
    return Math.min(ad, ai) - Math.min(bd, bi);
  });

  return { rows, withinDays };
}

export const PPE_DUE_COLUMNS = [
  { key: "item", header: "Item" },
  { key: "category", header: "Category" },
  { key: "station", header: "Station" },
  { key: "assignee", header: "Assignee" },
  { key: "status", header: "Status" },
  { key: "expiresOn", header: "Expires" },
  { key: "daysUntilExpiry", header: "Days to expiry" },
  { key: "inspectionDue", header: "Inspection due" },
  { key: "daysUntilInspection", header: "Days to inspection" },
  { key: "urgency", header: "Urgency" },
];
