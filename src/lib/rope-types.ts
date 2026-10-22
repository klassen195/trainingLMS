import type { AssetStatus } from "@/lib/assets-types";
import { apparatusOptionLabel } from "@/lib/assets-types";

export type RopeDetailKind = "none" | "rope" | "webbing" | "carabiner";

export type RopeGearSpecs = {
  color: string;
  diameter: string;
  length: string;
  brand: string;
  material: string;
};

export type RopeGearCategory = {
  id: string;
  name: string;
  sortOrder: number;
  detailKind: RopeDetailKind;
  gearTypeCount: number;
};

export type RopeGearType = {
  id: string;
  name: string;
  notes: string;
  sort_order: number;
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  detailKind: RopeDetailKind;
  color: string;
  diameter: string;
  length: string;
  brand: string;
  material: string;
};

export function ropeDetailKindLabel(kind: RopeDetailKind) {
  if (kind === "rope") return "Rope details";
  if (kind === "webbing") return "Webbing details";
  if (kind === "carabiner") return "Carabiner details";
  return "Description only";
}

export function ropeGearSummary(kind: RopeDetailKind, specs: RopeGearSpecs) {
  const parts =
    kind === "rope"
      ? [specs.color, specs.diameter, specs.length]
      : kind === "webbing"
        ? [specs.color, specs.length]
        : kind === "carabiner"
          ? [specs.brand, specs.material]
          : [];
  return parts.map((part) => part.trim()).filter(Boolean).join(" · ");
}

export function ropeGearOptionLabel(name: string, summary: string) {
  return summary ? `${name} · ${summary}` : name;
}

export function cacheRowSearchText(row: {
  gearTypeName: string;
  categoryName: string;
  summary: string;
  description: string;
}) {
  return [row.gearTypeName, row.categoryName, row.summary, row.description].join(" ").toLowerCase();
}

export function groupByCategory<T extends { categoryId: string; categoryName: string; categorySortOrder: number }>(
  items: T[],
  label: (item: T) => string,
  order: (item: T) => number = () => 0
) {
  const groups = new Map<string, { id: string; name: string; sortOrder: number; items: T[] }>();
  for (const item of items) {
    const group = groups.get(item.categoryId) ?? {
      id: item.categoryId,
      name: item.categoryName,
      sortOrder: item.categorySortOrder,
      items: [],
    };
    group.items.push(item);
    groups.set(item.categoryId, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((a, b) => order(a) - order(b) || label(a).localeCompare(label(b))),
    }));
}

export type RopeLineAsset = {
  placementId: string;
  assetId: string;
  label: string;
  serialNumber: string | null;
  status: AssetStatus;
};

export type RopeAuditReason = "missing" | "damaged" | "other";

export type RopeLineAuditFlag = {
  reason: RopeAuditReason;
  quantity: number;
  notes: string;
};

export type RopeAuditSummary = {
  createdAt: string;
  findingCount: number;
};

export type RopeAuditLine = {
  lineId: string;
  bagId: string;
  gearTypeId: string;
  gearTypeName: string;
  gearSpec: string;
  expectedQuantity: number;
};

export type RopeAuditGroup = {
  bagId: string;
  bagName: string;
  loose: boolean;
  lines: RopeAuditLine[];
};

export function ropeAuditReasonLabel(reason: RopeAuditReason) {
  if (reason === "missing") return "Missing";
  if (reason === "damaged") return "Damaged";
  return "Other";
}

export type RopeBagLineView = {
  id: string;
  persisted: boolean;
  gearTypeId: string;
  gearTypeName: string;
  gearSpec: string;
  expectedQuantity: number;
  quantityOnHand: number;
  sortOrder: number;
  assets: RopeLineAsset[];
  actual: number;
  short: number;
  auditFlag: RopeLineAuditFlag | null;
};

export type RopeCacheSpare = {
  placementId: string;
  assetId: string;
  gearTypeId: string;
  gearTypeName: string;
  label: string;
  serialNumber: string | null;
  status: AssetStatus;
};

export type RopeCacheRow = {
  gearTypeId: string;
  gearTypeName: string;
  description: string;
  summary: string;
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  sortOrder: number;
  detailKind: RopeDetailKind;
  color: string;
  diameter: string;
  length: string;
  brand: string;
  material: string;
  quantity: number;
  spares: RopeCacheSpare[];
};

export type RopeAttachOption = {
  id: string;
  label: string;
};

export type RopeStationTruck = {
  id: string;
  label: string;
  station: string;
  short: number;
  requiredLineCount: number;
  compartmentCount: number;
};

export type RopeStationGroup = {
  station: string;
  anchor: string;
  trucks: RopeStationTruck[];
  short: number;
  requiredLineCount: number;
};

export type RopeApparatusOption = {
  id: string;
  label: string;
  station: string;
  tracksRope: boolean;
};

export type RopeCompartmentSummary = {
  id: string;
  name: string;
  bagCount: number;
  short: number;
  requiredLineCount: number;
};

export type RopeLoadoutTarget = {
  id: string;
  label: string;
};

export type RopeBagSummary = {
  id: string;
  name: string;
  lineCount: number;
  short: number;
  requiredLineCount: number;
  openFindings: number;
};

export function ropeStationName(station: string | null | undefined) {
  const trimmed = station?.trim();
  return trimmed || "Unassigned";
}

export function ropeStationAnchor(station: string) {
  const slug = station
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `station-${slug || "unassigned"}`;
}

export function ropeComplementLabel(short: number, requiredLineCount: number) {
  if (requiredLineCount === 0) return "No loadout";
  if (short <= 0) return "Complete";
  return `Short ${short}`;
}

export function ropeApparatusLabel(asset: {
  unit_number: string | null;
  build_number: string | null;
}) {
  return apparatusOptionLabel(asset);
}

export function ropeEquipmentLabel(asset: { name: string | null; serial_number: string | null }) {
  const name = asset.name?.trim() || "Equipment";
  const serial = asset.serial_number?.trim();
  return serial ? `${name} · ${serial}` : name;
}
