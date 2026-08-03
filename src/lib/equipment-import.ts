import type { AssetStatus, EquipmentAssignmentType } from "@/lib/assets-types";
import { assetStatuses } from "@/lib/labels";

export const EQUIPMENT_IMPORT_COLUMNS = [
  "equipment_id",
  "category",
  "status",
  "subcategory",
  "description",
  "serial_number",
  "model",
  "manufacturer",
  "size",
  "manufactured_on",
  "expires_on",
  "in_service_on",
  "purchase_cost",
  "notes",
  "assignment_type",
  "assigned_person",
  "assigned_station",
  "assigned_apparatus",
] as const;

export type EquipmentImportColumn = (typeof EQUIPMENT_IMPORT_COLUMNS)[number];

export type EquipmentImportCsvRow = Partial<Record<EquipmentImportColumn, string>> & {
  rowNumber: number;
};

export type EquipmentImportRowInput = {
  rowNumber: number;
  equipment_id: string;
  category: string;
  status?: string;
  subcategory?: string;
  description?: string;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  size?: string;
  manufactured_on?: string;
  expires_on?: string;
  in_service_on?: string;
  purchase_cost?: string;
  notes?: string;
  assignment_type?: string;
  assigned_person?: string;
  assigned_station?: string;
  assigned_apparatus?: string;
};

export type EquipmentImportRowError = {
  row: number;
  equipment_id: string | null;
  message: string;
};

export type EquipmentImportResult = {
  created: number;
  updated: number;
  errors: EquipmentImportRowError[];
};

export const EQUIPMENT_IMPORT_TEMPLATE = [
  EQUIPMENT_IMPORT_COLUMNS.join(","),
  [
    "HELM-001",
    "Helmets",
    "in_service",
    "Structural",
    "Cairns 1010",
    "SN123",
    "1010",
    "Cairns",
    "Medium",
    "2020-01-15",
    "2030-01-15",
    "2020-02-01",
    "450.00",
    "Example row — replace with real data",
    "station",
    "",
    "Station 1",
    "",
  ].join(","),
  [
    "GLOVE-042",
    "Gloves",
    "in_service",
    "",
    "Structural gloves",
    "",
    "",
    "",
    "L",
    "",
    "",
    "",
    "",
    "",
    "person",
    "jane@example.com",
    "",
    "",
  ].join(","),
].join("\n");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ASSIGNMENT_TYPES: EquipmentAssignmentType[] = ["person", "station", "apparatus"];

export function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

/** Parse CSV text into keyed rows. First non-empty line is the header. */
export function parseEquipmentImportCsv(text: string): {
  rows: EquipmentImportCsvRow[];
  error: string | null;
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], error: "CSV is empty." };
  }

  const headers = parseCsvLine(lines[0]).map((h) => normalizeKey(h));
  const columnIndex = new Map<EquipmentImportColumn, number>();
  for (const col of EQUIPMENT_IMPORT_COLUMNS) {
    const idx = headers.indexOf(col);
    if (idx >= 0) columnIndex.set(col, idx);
  }

  if (!columnIndex.has("equipment_id") || !columnIndex.has("category")) {
    return {
      rows: [],
      error: "CSV must include equipment_id and category columns.",
    };
  }

  const rows: EquipmentImportCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: EquipmentImportCsvRow = { rowNumber: i + 1 };
    for (const [col, idx] of columnIndex) {
      row[col] = (cells[idx] ?? "").trim();
    }
    rows.push(row);
  }

  return { rows, error: null };
}

export function toImportRowInput(row: EquipmentImportCsvRow): EquipmentImportRowInput {
  return {
    rowNumber: row.rowNumber,
    equipment_id: row.equipment_id?.trim() ?? "",
    category: row.category?.trim() ?? "",
    status: row.status?.trim() || undefined,
    subcategory: row.subcategory?.trim() || undefined,
    description: row.description?.trim() || undefined,
    serial_number: row.serial_number?.trim() || undefined,
    model: row.model?.trim() || undefined,
    manufacturer: row.manufacturer?.trim() || undefined,
    size: row.size?.trim() || undefined,
    manufactured_on: row.manufactured_on?.trim() || undefined,
    expires_on: row.expires_on?.trim() || undefined,
    in_service_on: row.in_service_on?.trim() || undefined,
    purchase_cost: row.purchase_cost?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    assignment_type: row.assignment_type?.trim() || undefined,
    assigned_person: row.assigned_person?.trim() || undefined,
    assigned_station: row.assigned_station?.trim() || undefined,
    assigned_apparatus: row.assigned_apparatus?.trim() || undefined,
  };
}

export function isValidAssetStatus(value: string): value is AssetStatus {
  return (assetStatuses as string[]).includes(value);
}

export function isValidAssignmentType(value: string): value is EquipmentAssignmentType {
  return (ASSIGNMENT_TYPES as string[]).includes(value);
}

export function isValidIsoDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime());
}
