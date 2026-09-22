"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireCapability } from "@/lib/capability-access";
import type { ApparatusType, AssetStatus } from "@/lib/assets-types";
import {
  isValidApparatusType,
  isValidAssetStatus,
  normalizeKey,
  parseShowOnFleetCards,
  type VehicleImportResult,
  type VehicleImportRowError,
  type VehicleImportRowInput,
} from "@/lib/vehicle-import";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable, supabaseErrorMessage } from "@/lib/supabase/errors";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingAssetsTable(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260720130000_assets_inventory.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type Lookups = {
  locationsByName: Map<string, string>;
  existingByBuild: Map<string, string[]>;
  unitHolders: Map<string, string>;
};

async function loadLookups(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<Lookups> {
  const [locationsRes, existingRes] = await Promise.all([
    supabase.from("locations").select("id, name"),
    supabase
      .from("assets")
      .select("id, build_number, unit_number")
      .eq("kind", "apparatus"),
  ]);

  throwIfDbError(locationsRes.error);
  throwIfDbError(existingRes.error);

  const locationsByName = new Map<string, string>();
  for (const loc of locationsRes.data ?? []) {
    locationsByName.set(normalizeKey(loc.name), loc.name);
  }

  const existingByBuild = new Map<string, string[]>();
  const unitHolders = new Map<string, string>();
  for (const a of existingRes.data ?? []) {
    if (a.build_number?.trim()) {
      const key = normalizeKey(a.build_number);
      const list = existingByBuild.get(key) ?? [];
      list.push(a.id);
      existingByBuild.set(key, list);
    }
    if (a.unit_number?.trim()) {
      unitHolders.set(normalizeKey(a.unit_number), a.id);
    }
  }

  return { locationsByName, existingByBuild, unitHolders };
}

async function closeOpenUnitAssignment(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  assetId: string,
  at: string
) {
  const { error } = await supabase
    .from("apparatus_unit_assignments")
    .update({ unassigned_at: at })
    .eq("asset_id", assetId)
    .is("unassigned_at", null);
  throwIfDbError(error);
}

async function clearUnitFromOtherAssets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  unitNumber: string,
  keepAssetId: string | null,
  lookups: Lookups
) {
  const at = new Date().toISOString();
  let holdersQuery = supabase
    .from("assets")
    .select("id")
    .eq("kind", "apparatus")
    .eq("unit_number", unitNumber);
  if (keepAssetId) holdersQuery = holdersQuery.neq("id", keepAssetId);
  const { data: holders, error } = await holdersQuery;
  throwIfDbError(error);

  for (const holder of holders ?? []) {
    await closeOpenUnitAssignment(supabase, holder.id, at);
    const { error: clearError } = await supabase
      .from("assets")
      .update({ unit_number: null })
      .eq("id", holder.id);
    throwIfDbError(clearError);
    lookups.unitHolders.delete(normalizeKey(unitNumber));
  }
}

async function syncUnitAssignmentHistory(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    assetId: string;
    previousUnit: string | null;
    nextUnit: string | null;
    actorId: string;
  }
) {
  const previous = emptyToNull(input.previousUnit);
  const next = emptyToNull(input.nextUnit);
  if (previous === next) return;

  const at = new Date().toISOString();

  if (previous) {
    await closeOpenUnitAssignment(supabase, input.assetId, at);
  }

  if (next) {
    const { error: insertError } = await supabase.from("apparatus_unit_assignments").insert({
      asset_id: input.assetId,
      unit_number: next,
      assigned_at: at,
      assigned_by: input.actorId,
    });
    throwIfDbError(insertError);
  }
}

function resolveRow(
  row: VehicleImportRowInput,
  lookups: Lookups
):
  | {
      ok: true;
      buildNumber: string;
      existingIds: string[];
      unitNumber: string | null;
      payload: Record<string, unknown>;
    }
  | { ok: false; message: string } {
  const buildNumber = row.build_number.trim();
  if (!buildNumber) return { ok: false, message: "build_number is required." };

  let status: AssetStatus = "in_service";
  if (row.status?.trim()) {
    const raw = normalizeKey(row.status).replace(/\s+/g, "_");
    if (!isValidAssetStatus(raw)) {
      return {
        ok: false,
        message: `Invalid status "${row.status}". Use in_service, out_of_service, reserve, or retired.`,
      };
    }
    status = raw;
  }

  let station: string | null = null;
  if (row.station?.trim()) {
    const resolved = lookups.locationsByName.get(normalizeKey(row.station));
    if (!resolved) return { ok: false, message: `Unknown station "${row.station}".` };
    station = resolved;
  }

  let apparatusType: ApparatusType | null = null;
  if (row.apparatus_type?.trim()) {
    const raw = normalizeKey(row.apparatus_type).replace(/\s+/g, "_");
    if (!isValidApparatusType(raw)) {
      return {
        ok: false,
        message: `Invalid apparatus_type "${row.apparatus_type}". Use engine, ladder, ambulance, rescue, tender, brush, boat, or other.`,
      };
    }
    apparatusType = raw;
  }

  let year: number | null = null;
  if (row.year?.trim()) {
    const n = Number(row.year.trim());
    if (!Number.isInteger(n) || n < 1900 || n > 2100) {
      return { ok: false, message: "year must be a 4-digit year." };
    }
    year = n;
  }

  let showOnFleetCards = true;
  try {
    showOnFleetCards = parseShowOnFleetCards(row.show_on_fleet_cards);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Invalid show_on_fleet_cards." };
  }

  const existingIds = lookups.existingByBuild.get(normalizeKey(buildNumber)) ?? [];
  if (existingIds.length > 1) {
    return {
      ok: false,
      message: `Multiple existing apparatus rows share build number "${buildNumber}". Resolve duplicates first.`,
    };
  }

  const unitNumber = emptyToNull(row.unit_number);
  const payload = {
    kind: "apparatus" as const,
    name: null,
    status,
    station,
    manufacturer: emptyToNull(row.manufacturer),
    model: emptyToNull(row.model),
    serial_number: emptyToNull(row.serial_number),
    notes: row.notes?.trim() ?? "",
    assignment_type: null,
    assigned_to: null,
    assigned_station: null,
    assigned_apparatus_id: null,
    equipment_category_id: null,
    equipment_subcategory_id: null,
    subcategory: null,
    description: null,
    purchase_cost: null,
    in_service_on: null,
    size: null,
    manufactured_on: null,
    expires_on: null,
    unit_number: unitNumber,
    apparatus_type: apparatusType,
    year,
    build_number: buildNumber,
    show_on_fleet_cards: showOnFleetCards,
  };

  return { ok: true, buildNumber, existingIds, unitNumber, payload };
}

export async function importVehicleRows(
  rows: VehicleImportRowInput[]
): Promise<VehicleImportResult> {
  const profile = await requireCapability("manage_assets");
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      created: 0,
      updated: 0,
      errors: [{ row: 0, build_number: null, message: "No rows to import." }],
    };
  }
  if (rows.length > 2000) {
    return {
      created: 0,
      updated: 0,
      errors: [
        {
          row: 0,
          build_number: null,
          message: "Import is limited to 2000 rows at a time.",
        },
      ],
    };
  }

  const supabase = await createSupabaseServerClient();
  const lookups = await loadLookups(supabase);

  let created = 0;
  let updated = 0;
  const errors: VehicleImportRowError[] = [];
  const seenBuildInFile = new Map<string, number>();
  const seenUnitInFile = new Map<string, number>();

  for (const row of rows) {
    const resolved = resolveRow(row, lookups);
    if (!resolved.ok) {
      errors.push({
        row: row.rowNumber,
        build_number: row.build_number?.trim() || null,
        message: resolved.message,
      });
      continue;
    }

    const buildKey = normalizeKey(resolved.buildNumber);
    const priorBuildRow = seenBuildInFile.get(buildKey);
    if (priorBuildRow != null) {
      errors.push({
        row: row.rowNumber,
        build_number: resolved.buildNumber,
        message: `Duplicate build_number in file (also on row ${priorBuildRow}).`,
      });
      continue;
    }
    seenBuildInFile.set(buildKey, row.rowNumber);

    if (resolved.unitNumber) {
      const unitKey = normalizeKey(resolved.unitNumber);
      const priorUnitRow = seenUnitInFile.get(unitKey);
      if (priorUnitRow != null) {
        errors.push({
          row: row.rowNumber,
          build_number: resolved.buildNumber,
          message: `Duplicate unit_number in file (also on row ${priorUnitRow}).`,
        });
        continue;
      }
      seenUnitInFile.set(unitKey, row.rowNumber);
    }

    try {
      if (resolved.existingIds.length === 1) {
        const id = resolved.existingIds[0];
        const { data: existing, error: existingError } = await supabase
          .from("assets")
          .select("unit_number")
          .eq("id", id)
          .maybeSingle();
        throwIfDbError(existingError);
        if (!existing) throw new Error("Existing apparatus not found.");

        const previousUnit = emptyToNull(existing.unit_number);
        const nextUnit = resolved.unitNumber;

        if (nextUnit && nextUnit !== previousUnit) {
          await clearUnitFromOtherAssets(supabase, nextUnit, id, lookups);
        }

        const { error } = await supabase.from("assets").update(resolved.payload).eq("id", id);
        if (error) throw new Error(supabaseErrorMessage(error));

        await syncUnitAssignmentHistory(supabase, {
          assetId: id,
          previousUnit,
          nextUnit,
          actorId: profile.id,
        });

        if (previousUnit) lookups.unitHolders.delete(normalizeKey(previousUnit));
        if (nextUnit) lookups.unitHolders.set(normalizeKey(nextUnit), id);
        updated += 1;
      } else {
        if (resolved.unitNumber) {
          await clearUnitFromOtherAssets(supabase, resolved.unitNumber, null, lookups);
        }

        const { data, error } = await supabase
          .from("assets")
          .insert({ ...resolved.payload, created_by: profile.id })
          .select("id")
          .single();
        if (error) throw new Error(supabaseErrorMessage(error));

        if (resolved.unitNumber) {
          await syncUnitAssignmentHistory(supabase, {
            assetId: data!.id,
            previousUnit: null,
            nextUnit: resolved.unitNumber,
            actorId: profile.id,
          });
          lookups.unitHolders.set(normalizeKey(resolved.unitNumber), data!.id);
        }

        created += 1;
        const list = lookups.existingByBuild.get(buildKey) ?? [];
        list.push(data!.id);
        lookups.existingByBuild.set(buildKey, list);
      }
    } catch (err) {
      errors.push({
        row: row.rowNumber,
        build_number: resolved.buildNumber,
        message: err instanceof Error ? err.message : "Failed to save row.",
      });
    }
  }

  revalidatePath("/assets", "layout");
  revalidatePath("/assets/apparatus");
  revalidatePath("/fleet");
  return { created, updated, errors };
}
