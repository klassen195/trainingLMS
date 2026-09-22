import type { ApparatusType, AssetStatus } from "@/lib/assets-types";
import { apparatusTypes } from "@/lib/labels";
import {
  isValidAssetStatus,
  normalizeKey,
} from "@/lib/equipment-import";

export const VEHICLE_IMPORT_COLUMNS = [
  "build_number",
  "status",
  "station",
  "unit_number",
  "apparatus_type",
  "year",
  "manufacturer",
  "model",
  "serial_number",
  "notes",
  "show_on_fleet_cards",
] as const;

export type VehicleImportColumn = (typeof VEHICLE_IMPORT_COLUMNS)[number];

export type VehicleImportCsvRow = Partial<Record<VehicleImportColumn, string>> & {
  rowNumber: number;
};

export type VehicleImportRowInput = {
  rowNumber: number;
  build_number: string;
  status?: string;
  station?: string;
  unit_number?: string;
  apparatus_type?: string;
  year?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  notes?: string;
  show_on_fleet_cards?: string;
};

export type VehicleImportRowError = {
  row: number;
  build_number: string | null;
  message: string;
};

export type VehicleImportResult = {
  created: number;
  updated: number;
  errors: VehicleImportRowError[];
};

export const VEHICLE_IMPORT_TEMPLATE = [
  VEHICLE_IMPORT_COLUMNS.join(","),
  [
    "0V95",
    "in_service",
    "Station 1",
    "E11",
    "engine",
    "2018",
    "Pierce",
    "Arrow XT",
    "",
    "Example row — replace with real data",
    "true",
  ].join(","),
  [
    "0A42",
    "in_service",
    "Station 2",
    "A21",
    "ambulance",
    "2021",
    "",
    "",
    "",
    "",
    "true",
  ].join(","),
].join("\n");

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
export function parseVehicleImportCsv(text: string): {
  rows: VehicleImportCsvRow[];
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
  const columnIndex = new Map<VehicleImportColumn, number>();
  for (const col of VEHICLE_IMPORT_COLUMNS) {
    const idx = headers.indexOf(col);
    if (idx >= 0) columnIndex.set(col, idx);
  }

  if (!columnIndex.has("build_number")) {
    return {
      rows: [],
      error: "CSV must include a build_number column.",
    };
  }

  const rows: VehicleImportCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: VehicleImportCsvRow = { rowNumber: i + 1 };
    for (const [col, idx] of columnIndex) {
      row[col] = (cells[idx] ?? "").trim();
    }
    rows.push(row);
  }

  return { rows, error: null };
}

export function toVehicleImportRowInput(row: VehicleImportCsvRow): VehicleImportRowInput {
  return {
    rowNumber: row.rowNumber,
    build_number: row.build_number?.trim() ?? "",
    status: row.status?.trim() || undefined,
    station: row.station?.trim() || undefined,
    unit_number: row.unit_number?.trim() || undefined,
    apparatus_type: row.apparatus_type?.trim() || undefined,
    year: row.year?.trim() || undefined,
    manufacturer: row.manufacturer?.trim() || undefined,
    model: row.model?.trim() || undefined,
    serial_number: row.serial_number?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    show_on_fleet_cards: row.show_on_fleet_cards?.trim() || undefined,
  };
}

export function isValidApparatusType(value: string): value is ApparatusType {
  return (apparatusTypes as string[]).includes(value);
}

export function parseShowOnFleetCards(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  const normalized = normalizeKey(value);
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  throw new Error(
    `Invalid show_on_fleet_cards "${value}". Use true/false, yes/no, or 1/0.`
  );
}

export { isValidAssetStatus, normalizeKey };
export type { AssetStatus };
