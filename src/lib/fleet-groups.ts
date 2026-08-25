import type { ApparatusType, AssetListRow } from "@/lib/assets-types";
import { assetDisplayLabel } from "@/lib/assets-types";

export type FleetTypeGroupId = "engines_ladders" | "ambulances" | "tenders" | "brush" | "other";

export const FLEET_TYPE_GROUPS: { id: FleetTypeGroupId; label: string }[] = [
  { id: "engines_ladders", label: "Engines and Ladders" },
  { id: "ambulances", label: "Ambulances" },
  { id: "tenders", label: "Tenders" },
  { id: "brush", label: "Brush trucks" },
  { id: "other", label: "Other" },
];

export function fleetTypeGroupId(type: ApparatusType | null): FleetTypeGroupId {
  switch (type) {
    case "engine":
    case "ladder":
      return "engines_ladders";
    case "ambulance":
      return "ambulances";
    case "tender":
      return "tenders";
    case "brush":
      return "brush";
    default:
      return "other";
  }
}

function apparatusTypeSortRank(type: ApparatusType | null): number {
  switch (type) {
    case "engine":
      return 0;
    case "ladder":
      return 1;
    case "ambulance":
      return 2;
    case "tender":
      return 3;
    case "brush":
      return 4;
    case "rescue":
      return 5;
    case "boat":
      return 6;
    case "other":
      return 7;
    default:
      return 8;
  }
}

function cardSortValue(asset: AssetListRow, sortOverride?: Record<string, number>) {
  const override = sortOverride?.[asset.id];
  if (typeof override === "number") return override;
  return asset.fleet_card_sort ?? 0;
}

export function groupFleetRows(rows: AssetListRow[], sortOverride?: Record<string, number>) {
  const sorted = [...rows].sort((a, b) => {
    const groupDelta =
      FLEET_TYPE_GROUPS.findIndex((group) => group.id === fleetTypeGroupId(a.apparatus_type)) -
      FLEET_TYPE_GROUPS.findIndex((group) => group.id === fleetTypeGroupId(b.apparatus_type));
    if (groupDelta !== 0) return groupDelta;

    const aSort = cardSortValue(a, sortOverride);
    const bSort = cardSortValue(b, sortOverride);
    const aSet = aSort > 0;
    const bSet = bSort > 0;
    if (aSet !== bSet) return aSet ? -1 : 1;
    if (aSet && aSort !== bSort) return aSort - bSort;

    const rankDelta = apparatusTypeSortRank(a.apparatus_type) - apparatusTypeSortRank(b.apparatus_type);
    if (rankDelta !== 0) return rankDelta;
    return assetDisplayLabel(a).localeCompare(assetDisplayLabel(b), undefined, { numeric: true });
  });

  return FLEET_TYPE_GROUPS.map((group) => ({
    ...group,
    rows: sorted.filter((asset) => fleetTypeGroupId(asset.apparatus_type) === group.id),
  })).filter((group) => group.rows.length > 0);
}
