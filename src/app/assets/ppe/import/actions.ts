"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireCapability } from "@/lib/capability-access";
import {
  isValidAssignmentType,
  isValidAssetStatus,
  isValidIsoDate,
  normalizeKey,
  type EquipmentImportResult,
  type EquipmentImportRowError,
  type EquipmentImportRowInput,
} from "@/lib/equipment-import";
import type {
  AssetStatus,
  EquipmentAssignmentType,
} from "@/lib/assets-types";
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

function equipmentAssignmentFields(input: {
  assignment_type: EquipmentAssignmentType | null;
  assigned_to: string | null;
  assigned_station: string | null;
  assigned_apparatus_id: string | null;
}) {
  const type = input.assignment_type;
  if (type === "person" && input.assigned_to) {
    return {
      assignment_type: "person" as const,
      assigned_to: input.assigned_to,
      assigned_station: null,
      assigned_apparatus_id: null,
    };
  }
  if (type === "station" && input.assigned_station) {
    return {
      assignment_type: "station" as const,
      assigned_to: null,
      assigned_station: input.assigned_station,
      assigned_apparatus_id: null,
    };
  }
  if (type === "apparatus" && input.assigned_apparatus_id) {
    return {
      assignment_type: "apparatus" as const,
      assigned_to: null,
      assigned_station: null,
      assigned_apparatus_id: input.assigned_apparatus_id,
    };
  }
  return {
    assignment_type: null,
    assigned_to: null,
    assigned_station: null,
    assigned_apparatus_id: null,
  };
}

type Lookups = {
  categoriesByName: Map<string, { id: string; name: string }>;
  subcategoriesByCategory: Map<string, Map<string, { id: string; name: string }>>;
  profilesByEmail: Map<string, string>;
  profilesByName: Map<string, string[]>;
  locationsByName: Map<string, string>;
  apparatusByUnit: Map<string, string>;
  apparatusByBuild: Map<string, string>;
  existingByName: Map<string, string[]>;
};

async function loadLookups(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<Lookups> {
  const [
    categoriesRes,
    subcategoriesRes,
    profilesRes,
    locationsRes,
    apparatusRes,
    existingRes,
  ] = await Promise.all([
    supabase.from("equipment_categories").select("id, name"),
    supabase.from("equipment_subcategories").select("id, name, equipment_category_id"),
    supabase.from("profiles").select("id, display_name, email"),
    supabase.from("locations").select("id, name"),
    supabase
      .from("assets")
      .select("id, unit_number, build_number")
      .eq("kind", "apparatus"),
    supabase.from("assets").select("id, name").eq("kind", "ppe"),
  ]);

  throwIfDbError(categoriesRes.error);
  throwIfDbError(subcategoriesRes.error);
  throwIfDbError(profilesRes.error);
  throwIfDbError(locationsRes.error);
  throwIfDbError(apparatusRes.error);
  throwIfDbError(existingRes.error);

  const categoriesByName = new Map<string, { id: string; name: string }>();
  for (const c of categoriesRes.data ?? []) {
    categoriesByName.set(normalizeKey(c.name), { id: c.id, name: c.name });
  }

  const subcategoriesByCategory = new Map<string, Map<string, { id: string; name: string }>>();
  for (const s of subcategoriesRes.data ?? []) {
    let byName = subcategoriesByCategory.get(s.equipment_category_id);
    if (!byName) {
      byName = new Map();
      subcategoriesByCategory.set(s.equipment_category_id, byName);
    }
    byName.set(normalizeKey(s.name), { id: s.id, name: s.name });
  }

  const profilesByEmail = new Map<string, string>();
  const profilesByName = new Map<string, string[]>();
  for (const p of profilesRes.data ?? []) {
    if (p.email?.trim()) profilesByEmail.set(normalizeKey(p.email), p.id);
    if (p.display_name?.trim()) {
      const key = normalizeKey(p.display_name);
      const list = profilesByName.get(key) ?? [];
      list.push(p.id);
      profilesByName.set(key, list);
    }
  }

  const locationsByName = new Map<string, string>();
  for (const loc of locationsRes.data ?? []) {
    locationsByName.set(normalizeKey(loc.name), loc.name);
  }

  const apparatusByUnit = new Map<string, string>();
  const apparatusByBuild = new Map<string, string>();
  for (const a of apparatusRes.data ?? []) {
    if (a.unit_number?.trim()) apparatusByUnit.set(normalizeKey(a.unit_number), a.id);
    if (a.build_number?.trim()) apparatusByBuild.set(normalizeKey(a.build_number), a.id);
  }

  const existingByName = new Map<string, string[]>();
  for (const a of existingRes.data ?? []) {
    if (!a.name?.trim()) continue;
    const key = normalizeKey(a.name);
    const list = existingByName.get(key) ?? [];
    list.push(a.id);
    existingByName.set(key, list);
  }

  return {
    categoriesByName,
    subcategoriesByCategory,
    profilesByEmail,
    profilesByName,
    locationsByName,
    apparatusByUnit,
    apparatusByBuild,
    existingByName,
  };
}

function resolveRow(
  row: EquipmentImportRowInput,
  lookups: Lookups
):
  | {
      ok: true;
      equipmentId: string;
      existingIds: string[];
      payload: Record<string, unknown>;
    }
  | { ok: false; message: string } {
  const equipmentId = row.equipment_id.trim();
  if (!equipmentId) return { ok: false, message: "equipment_id is required." };

  const categoryName = row.category.trim();
  if (!categoryName) return { ok: false, message: "category is required." };

  const category = lookups.categoriesByName.get(normalizeKey(categoryName));
  if (!category) return { ok: false, message: `Unknown category "${categoryName}".` };

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

  let subcategoryId: string | null = null;
  if (row.subcategory?.trim()) {
    const byName = lookups.subcategoriesByCategory.get(category.id);
    const sub = byName?.get(normalizeKey(row.subcategory));
    if (!sub) {
      return {
        ok: false,
        message: `Unknown subcategory "${row.subcategory}" for category "${category.name}".`,
      };
    }
    subcategoryId = sub.id;
  }

  for (const [label, value] of [
    ["manufactured_on", row.manufactured_on],
    ["expires_on", row.expires_on],
    ["in_service_on", row.in_service_on],
  ] as const) {
    if (value?.trim() && !isValidIsoDate(value.trim())) {
      return { ok: false, message: `${label} must be YYYY-MM-DD.` };
    }
  }

  let purchaseCost: number | null = null;
  if (row.purchase_cost?.trim()) {
    const n = Number(row.purchase_cost.replace(/[$,]/g, "").trim());
    if (Number.isNaN(n) || n < 0) {
      return { ok: false, message: "purchase_cost must be a non-negative number." };
    }
    purchaseCost = n;
  }

  let assignmentType: EquipmentAssignmentType | null = null;
  let assignedTo: string | null = null;
  let assignedStation: string | null = null;
  let assignedApparatusId: string | null = null;

  const typeRaw = row.assignment_type?.trim();
  if (typeRaw) {
    const normalized = normalizeKey(typeRaw);
    if (!isValidAssignmentType(normalized)) {
      return {
        ok: false,
        message: `Invalid assignment_type "${typeRaw}". Use person, station, or apparatus.`,
      };
    }
    assignmentType = normalized;

    if (assignmentType === "person") {
      const person = row.assigned_person?.trim();
      if (!person) return { ok: false, message: "assigned_person is required for person assignment." };
      const byEmail = lookups.profilesByEmail.get(normalizeKey(person));
      if (byEmail) {
        assignedTo = byEmail;
      } else {
        const byName = lookups.profilesByName.get(normalizeKey(person)) ?? [];
        if (byName.length === 0) {
          return { ok: false, message: `Unknown person "${person}".` };
        }
        if (byName.length > 1) {
          return {
            ok: false,
            message: `Multiple people match "${person}"; use email instead.`,
          };
        }
        assignedTo = byName[0];
      }
    } else if (assignmentType === "station") {
      const station = row.assigned_station?.trim();
      if (!station) {
        return { ok: false, message: "assigned_station is required for station assignment." };
      }
      const resolved = lookups.locationsByName.get(normalizeKey(station));
      if (!resolved) return { ok: false, message: `Unknown station "${station}".` };
      assignedStation = resolved;
    } else if (assignmentType === "apparatus") {
      const apparatus = row.assigned_apparatus?.trim();
      if (!apparatus) {
        return { ok: false, message: "assigned_apparatus is required for apparatus assignment." };
      }
      const byUnit = lookups.apparatusByUnit.get(normalizeKey(apparatus));
      const byBuild = lookups.apparatusByBuild.get(normalizeKey(apparatus));
      const id = byUnit ?? byBuild;
      if (!id) return { ok: false, message: `Unknown apparatus "${apparatus}".` };
      assignedApparatusId = id;
    }
  }

  const assignment = equipmentAssignmentFields({
    assignment_type: assignmentType,
    assigned_to: assignedTo,
    assigned_station: assignedStation,
    assigned_apparatus_id: assignedApparatusId,
  });

  const existingIds = lookups.existingByName.get(normalizeKey(equipmentId)) ?? [];
  if (existingIds.length > 1) {
    return {
      ok: false,
      message: `Multiple existing equipment rows share ID "${equipmentId}". Resolve duplicates first.`,
    };
  }

  const payload = {
    kind: "ppe" as const,
    name: equipmentId,
    status,
    station: null,
    manufacturer: emptyToNull(row.manufacturer),
    model: emptyToNull(row.model),
    serial_number: emptyToNull(row.serial_number),
    notes: row.notes?.trim() ?? "",
    ...assignment,
    equipment_category_id: category.id,
    equipment_subcategory_id: subcategoryId,
    subcategory: null,
    description: emptyToNull(row.description),
    purchase_cost: purchaseCost,
    in_service_on: emptyToNull(row.in_service_on),
    size: emptyToNull(row.size),
    manufactured_on: emptyToNull(row.manufactured_on),
    expires_on: emptyToNull(row.expires_on),
    ppe_category: null,
    unit_number: null,
    apparatus_type: null,
    year: null,
    build_number: null,
  };

  return { ok: true, equipmentId, existingIds, payload };
}

export async function importEquipmentRows(
  rows: EquipmentImportRowInput[]
): Promise<EquipmentImportResult> {
  const profile = await requireCapability("manage_assets");
  if (!Array.isArray(rows) || rows.length === 0) {
    return { created: 0, updated: 0, errors: [{ row: 0, equipment_id: null, message: "No rows to import." }] };
  }
  if (rows.length > 2000) {
    return {
      created: 0,
      updated: 0,
      errors: [
        {
          row: 0,
          equipment_id: null,
          message: "Import is limited to 2000 rows at a time.",
        },
      ],
    };
  }

  const supabase = await createSupabaseServerClient();
  const lookups = await loadLookups(supabase);

  let created = 0;
  let updated = 0;
  const errors: EquipmentImportRowError[] = [];
  const seenInFile = new Map<string, number>();

  for (const row of rows) {
    const resolved = resolveRow(row, lookups);
    if (!resolved.ok) {
      errors.push({
        row: row.rowNumber,
        equipment_id: row.equipment_id?.trim() || null,
        message: resolved.message,
      });
      continue;
    }

    const fileKey = normalizeKey(resolved.equipmentId);
    const priorRow = seenInFile.get(fileKey);
    if (priorRow != null) {
      errors.push({
        row: row.rowNumber,
        equipment_id: resolved.equipmentId,
        message: `Duplicate equipment_id in file (also on row ${priorRow}).`,
      });
      continue;
    }
    seenInFile.set(fileKey, row.rowNumber);

    try {
      if (resolved.existingIds.length === 1) {
        const id = resolved.existingIds[0];
        const { error } = await supabase.from("assets").update(resolved.payload).eq("id", id);
        if (error) throw new Error(supabaseErrorMessage(error));
        updated += 1;
      } else {
        const { data, error } = await supabase
          .from("assets")
          .insert({ ...resolved.payload, created_by: profile.id })
          .select("id")
          .single();
        if (error) throw new Error(supabaseErrorMessage(error));
        created += 1;
        const list = lookups.existingByName.get(fileKey) ?? [];
        list.push(data!.id);
        lookups.existingByName.set(fileKey, list);
      }
    } catch (err) {
      errors.push({
        row: row.rowNumber,
        equipment_id: resolved.equipmentId,
        message: err instanceof Error ? err.message : "Failed to save row.",
      });
    }
  }

  revalidatePath("/assets", "layout");
  revalidatePath("/assets/ppe");
  return { created, updated, errors };
}
