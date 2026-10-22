"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseErrorMessage } from "@/lib/supabase/errors";
import type { RopeDetailKind, RopeGearSpecs } from "@/lib/rope-types";

type RopeClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type RopeAction = "transfer" | "missing" | "broken" | "adjust" | "receive";

type LineRow = {
  id: string;
  bag_id: string;
  gear_type_id: string;
  expected_quantity: number;
  quantity_on_hand: number;
};

type PlacementRow = {
  id: string;
  asset_id: string;
  gear_type_id: string;
  bag_id: string | null;
  in_cache: boolean;
};

function throwDb(error: PostgrestError | null, fallback?: string) {
  if (!error) return;
  if (error.code === "23505") throw new Error(fallback ?? "That name is already in use.");
  if (error.code === "23503") throw new Error(fallback ?? "That item is still in use.");
  throw new Error(supabaseErrorMessage(error));
}

function touch(paths: string[] = []) {
  revalidatePath("/assets");
  revalidatePath("/assets/ppe");
  revalidatePath("/assets/rope", "layout");
  revalidatePath("/assets/rope/cache");
  for (const path of paths) revalidatePath(path);
}

function cleanName(value: string) {
  const name = value.trim();
  if (!name) throw new Error("Enter a name.");
  if (name.length > 80) throw new Error("Name must be 80 characters or fewer.");
  return name;
}

function parseCount(value: number, label: string, allowZero: boolean) {
  if (!Number.isInteger(value) || value > 10000 || value < (allowZero ? 0 : 1)) {
    throw new Error(
      allowZero
        ? `${label} must be a whole number from 0 to 10000.`
        : `${label} must be a whole number from 1 to 10000.`
    );
  }
  return value;
}

async function requireManage() {
  return assertCapability("manage_rope_inventory");
}

async function recordEvent(
  supabase: RopeClient,
  actorId: string,
  event: {
    action: RopeAction;
    gearTypeId?: string | null;
    assetId?: string | null;
    quantity?: number;
    fromBagId?: string | null;
    toBagId?: string | null;
    fromCache?: boolean;
    toCache?: boolean;
    notes?: string;
  }
) {
  const { error } = await supabase.from("rope_inventory_events").insert({
    created_by: actorId,
    action: event.action,
    gear_type_id: event.gearTypeId ?? null,
    asset_id: event.assetId ?? null,
    quantity: event.quantity ?? 1,
    from_bag_id: event.fromBagId ?? null,
    to_bag_id: event.toBagId ?? null,
    from_cache: event.fromCache ?? false,
    to_cache: event.toCache ?? false,
    notes: event.notes ?? "",
  });
  throwDb(error);
}

async function syncAsset(
  supabase: RopeClient,
  assetId: string,
  location: "bag" | "cache" | "out" | "clear",
  apparatusId?: string | null
) {
  const { error } = await supabase.rpc("rope_set_asset_location", {
    p_asset_id: assetId,
    p_location: location,
    p_apparatus_id: apparatusId ?? null,
  });
  throwDb(error);
}

async function touchBag(supabase: RopeClient, bagId: string, extra: string[] = []) {
  const { data, error } = await supabase
    .from("rope_bags")
    .select("compartment_id")
    .eq("id", bagId)
    .maybeSingle();
  throwDb(error);
  const paths = [`/assets/rope/bag/${bagId}`, ...extra];
  if (data?.compartment_id) paths.push(`/assets/rope/compartment/${data.compartment_id as string}`);
  touch(paths);
}

async function bagContext(supabase: RopeClient, bagId: string) {
  const { data: bag, error } = await supabase
    .from("rope_bags")
    .select("id, compartment_id, is_loose")
    .eq("id", bagId)
    .maybeSingle();
  throwDb(error);
  if (!bag) throw new Error("Bag not found.");

  const { data: compartment, error: compartmentError } = await supabase
    .from("rope_compartments")
    .select("id, apparatus_id")
    .eq("id", bag.compartment_id)
    .maybeSingle();
  throwDb(compartmentError);
  if (!compartment) throw new Error("Compartment not found.");

  return {
    bagId: bag.id as string,
    compartmentId: compartment.id as string,
    apparatusId: compartment.apparatus_id as string,
    isLoose: Boolean(bag.is_loose),
  };
}

async function nextLineSort(supabase: RopeClient, bagId: string) {
  const { data, error } = await supabase
    .from("rope_bag_lines")
    .select("sort_order")
    .eq("bag_id", bagId)
    .order("sort_order", { ascending: false })
    .limit(1);
  throwDb(error);
  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 1;
}

async function getLine(supabase: RopeClient, lineId: string) {
  const { data, error } = await supabase
    .from("rope_bag_lines")
    .select("id, bag_id, gear_type_id, expected_quantity, quantity_on_hand")
    .eq("id", lineId)
    .maybeSingle();
  throwDb(error);
  if (!data) throw new Error("Item not found.");
  return data as LineRow;
}

async function getPlacement(supabase: RopeClient, placementId: string) {
  const { data, error } = await supabase
    .from("rope_placements")
    .select("id, asset_id, gear_type_id, bag_id, in_cache")
    .eq("id", placementId)
    .maybeSingle();
  throwDb(error);
  if (!data) throw new Error("That gear is no longer in this place.");
  return data as PlacementRow;
}

async function assertUnplaced(supabase: RopeClient, assetId: string) {
  const { data, error } = await supabase
    .from("rope_placements")
    .select("id")
    .eq("asset_id", assetId)
    .maybeSingle();
  throwDb(error);
  if (data) throw new Error("That equipment is already in tech rescue inventory.");
}

async function setLineOnHand(supabase: RopeClient, lineId: string, previous: number, next: number) {
  const { data, error } = await supabase
    .from("rope_bag_lines")
    .update({ quantity_on_hand: next })
    .eq("id", lineId)
    .eq("quantity_on_hand", previous)
    .select("id")
    .maybeSingle();
  throwDb(error);
  if (!data) throw new Error("Quantity changed. Refresh and try again.");
}

async function restorePlacement(supabase: RopeClient, placement: PlacementRow) {
  await supabase.from("rope_placements").insert({
    id: placement.id,
    asset_id: placement.asset_id,
    gear_type_id: placement.gear_type_id,
    bag_id: placement.bag_id,
    in_cache: placement.in_cache,
  });
}

export async function setApparatusRopeTracking(apparatusId: string, enabled: boolean) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rope_set_apparatus_tracking", {
    p_asset_id: apparatusId,
    p_enabled: enabled,
  });
  throwDb(error);
  touch([`/assets/rope/apparatus/${apparatusId}`]);
}

const DETAIL_KINDS: RopeDetailKind[] = ["none", "rope", "webbing", "carabiner"];

export type GearTypeDetails = RopeGearSpecs & {
  name: string;
  categoryId: string;
  description: string;
};

function cleanDetail(value: string) {
  const text = value.trim();
  if (text.length > 40) throw new Error("Details must be 40 characters or fewer.");
  return text;
}

function cleanDescription(value: string) {
  const text = value.trim();
  if (text.length > 280) throw new Error("Description must be 280 characters or fewer.");
  return text;
}

function cleanDetailKind(value: string): RopeDetailKind {
  if (DETAIL_KINDS.includes(value as RopeDetailKind)) return value as RopeDetailKind;
  throw new Error("Choose which details this category asks for.");
}

function specsForKind(kind: RopeDetailKind, input: RopeGearSpecs): RopeGearSpecs {
  const color = cleanDetail(input.color);
  const diameter = cleanDetail(input.diameter);
  const length = cleanDetail(input.length);
  const brand = cleanDetail(input.brand);
  const material = cleanDetail(input.material);
  if (kind === "rope") return { color, diameter, length, brand: "", material: "" };
  if (kind === "webbing") return { color, diameter: "", length, brand: "", material: "" };
  if (kind === "carabiner") return { color: "", diameter: "", length: "", brand, material };
  return { color: "", diameter: "", length: "", brand: "", material: "" };
}

function gearIdentity(name: string, specs: RopeGearSpecs) {
  return [name, specs.color, specs.diameter, specs.length, specs.brand, specs.material]
    .map((part) => part.trim().toLowerCase())
    .join("\0");
}

async function loadCategory(supabase: RopeClient, categoryId: string) {
  const { data, error } = await supabase
    .from("rope_gear_categories")
    .select("id, detail_kind")
    .eq("id", categoryId)
    .maybeSingle();
  throwDb(error);
  const category = data as { id: string; detail_kind: string } | null;
  if (!category) throw new Error("Select a category.");
  return { id: category.id, detailKind: cleanDetailKind(category.detail_kind) };
}

export async function createGearType(input: GearTypeDetails) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const category = await loadCategory(supabase, input.categoryId);
  const { count, error: countError } = await supabase
    .from("rope_gear_types")
    .select("id", { count: "exact", head: true });
  throwDb(countError);
  const { error } = await supabase.from("rope_gear_types").insert({
    name: cleanName(input.name),
    category_id: category.id,
    notes: cleanDescription(input.description),
    sort_order: count ?? 0,
    ...specsForKind(category.detailKind, input),
  });
  throwDb(error, "A gear type with those details already exists.");
  touch();
}

export async function updateGearType(id: string, input: GearTypeDetails) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const category = await loadCategory(supabase, input.categoryId);
  const { error } = await supabase
    .from("rope_gear_types")
    .update({
      name: cleanName(input.name),
      category_id: category.id,
      notes: cleanDescription(input.description),
      ...specsForKind(category.detailKind, input),
    })
    .eq("id", id);
  throwDb(error, "A gear type with those details already exists.");
  touch();
}

export async function renameGearType(id: string, name: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("rope_gear_types")
    .update({ name: cleanName(name) })
    .eq("id", id);
  throwDb(error, "A gear type with those details already exists.");
  touch();
}

export async function createGearCategory(name: string, detailKind: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const kind = cleanDetailKind(detailKind);
  const { data: last, error: lastError } = await supabase
    .from("rope_gear_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  throwDb(lastError);
  const sortOrder = ((last?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("rope_gear_categories").insert({
    name: cleanName(name),
    detail_kind: kind,
    sort_order: sortOrder,
  });
  throwDb(error, "A category with that name already exists.");
  touch();
}

export async function updateGearCategory(id: string, name: string, detailKind: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const kind = cleanDetailKind(detailKind);
  const nextName = cleanName(name);
  const { data: existing, error: existingError } = await supabase
    .from("rope_gear_categories")
    .select("detail_kind")
    .eq("id", id)
    .maybeSingle();
  throwDb(existingError);
  const current = existing as { detail_kind: string } | null;
  if (!current) throw new Error("Category not found.");

  let projected: { id: string; specs: RopeGearSpecs }[] = [];
  if (cleanDetailKind(current.detail_kind) !== kind) {
    const { data: types, error: typesError } = await supabase
      .from("rope_gear_types")
      .select("id, name, color, diameter, length, brand, material")
      .eq("category_id", id);
    throwDb(typesError);
    const rows = (types ?? []) as ({ id: string; name: string } & RopeGearSpecs)[];
    projected = rows.map((row) => ({ id: row.id, specs: specsForKind(kind, row) }));
    const identities = rows.map((row) => gearIdentity(row.name, specsForKind(kind, row)));
    if (new Set(identities).size !== identities.length) {
      throw new Error("Rename items that would look the same before changing these details.");
    }
  }

  const { error } = await supabase
    .from("rope_gear_categories")
    .update({ name: nextName, detail_kind: kind })
    .eq("id", id);
  throwDb(error, "A category with that name already exists.");
  for (const row of projected) {
    const { error: specError } = await supabase.from("rope_gear_types").update(row.specs).eq("id", row.id);
    throwDb(specError, "A gear type with those details already exists.");
  }
  touch();
}

export async function reorderGearCategories(categoryIds: string[]) {
  await requireManage();
  if (categoryIds.length === 0) return;
  const unique = new Set(categoryIds);
  if (unique.size !== categoryIds.length) throw new Error("That list changed. Refresh and try again.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("rope_gear_categories").select("id");
  throwDb(error);
  const known = new Set((data ?? []).map((row) => row.id as string));
  if (categoryIds.length !== known.size || categoryIds.some((id) => !known.has(id))) {
    throw new Error("That list changed. Refresh and try again.");
  }
  for (const [index, id] of categoryIds.entries()) {
    const { error: updateError } = await supabase
      .from("rope_gear_categories")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwDb(updateError);
  }
  touch();
}

export async function reorderGearTypes(categoryId: string, gearTypeIds: string[]) {
  await requireManage();
  if (gearTypeIds.length === 0) return;
  const unique = new Set(gearTypeIds);
  if (unique.size !== gearTypeIds.length) throw new Error("That list changed. Refresh and try again.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rope_gear_types")
    .select("id")
    .eq("category_id", categoryId);
  throwDb(error);
  const known = new Set((data ?? []).map((row) => row.id as string));
  if (gearTypeIds.length !== known.size || gearTypeIds.some((id) => !known.has(id))) {
    throw new Error("That list changed. Refresh and try again.");
  }
  for (const [index, id] of gearTypeIds.entries()) {
    const { error: updateError } = await supabase
      .from("rope_gear_types")
      .update({ sort_order: index + 1 })
      .eq("id", id)
      .eq("category_id", categoryId);
    throwDb(updateError);
  }
  touch();
}

export async function deleteGearCategory(id: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("rope_gear_types")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  throwDb(countError);
  if ((count ?? 0) > 0) throw new Error("Move gear out of this category before deleting it.");
  const { error } = await supabase.from("rope_gear_categories").delete().eq("id", id);
  throwDb(error, "Move gear out of this category before deleting it.");
  touch();
}

export async function deleteGearType(id: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();

  const { count: lineCount, error: lineError } = await supabase
    .from("rope_bag_lines")
    .select("id", { count: "exact", head: true })
    .eq("gear_type_id", id);
  throwDb(lineError);
  if ((lineCount ?? 0) > 0) throw new Error("Remove this gear type from bags before deleting it.");

  const { count: placementCount, error: placementError } = await supabase
    .from("rope_placements")
    .select("id", { count: "exact", head: true })
    .eq("gear_type_id", id);
  throwDb(placementError);
  if ((placementCount ?? 0) > 0) {
    throw new Error("Untrack equipment of this type before deleting it.");
  }

  const { data: stock, error: stockError } = await supabase
    .from("rope_cache_stock")
    .select("id, quantity")
    .eq("gear_type_id", id)
    .maybeSingle();
  throwDb(stockError);
  if (stock && stock.quantity > 0) {
    throw new Error("Empty the reserve cache of this gear before deleting it.");
  }
  if (stock) {
    const { error } = await supabase.from("rope_cache_stock").delete().eq("id", stock.id);
    throwDb(error);
  }

  const { error } = await supabase.from("rope_gear_types").delete().eq("id", id);
  throwDb(error);
  touch();
}

export async function createCompartment(apparatusId: string, name: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("rope_compartments")
    .select("id", { count: "exact", head: true })
    .eq("apparatus_id", apparatusId);
  throwDb(countError);
  const { error } = await supabase.from("rope_compartments").insert({
    apparatus_id: apparatusId,
    name: cleanName(name),
    sort_order: count ?? 0,
  });
  throwDb(error, "That compartment name is already used on this apparatus.");
  touch([`/assets/rope/apparatus/${apparatusId}`]);
}

export async function renameCompartment(id: string, name: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const { data, error: lookupError } = await supabase
    .from("rope_compartments")
    .select("apparatus_id")
    .eq("id", id)
    .maybeSingle();
  throwDb(lookupError);
  if (!data) throw new Error("Compartment not found.");
  const { error } = await supabase
    .from("rope_compartments")
    .update({ name: cleanName(name) })
    .eq("id", id);
  throwDb(error, "That compartment name is already used on this apparatus.");
  touch([
    `/assets/rope/apparatus/${data.apparatus_id}`,
    `/assets/rope/compartment/${id}`,
  ]);
}

export async function deleteCompartment(id: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const { data: compartment, error } = await supabase
    .from("rope_compartments")
    .select("id, apparatus_id")
    .eq("id", id)
    .maybeSingle();
  throwDb(error);
  if (!compartment) throw new Error("Compartment not found.");

  const { data: bags, error: bagsError } = await supabase
    .from("rope_bags")
    .select("id")
    .eq("compartment_id", id);
  throwDb(bagsError);
  const bagIds = (bags ?? []).map((bag) => bag.id as string);
  if (bagIds.length > 0) {
    const { count, error: placementError } = await supabase
      .from("rope_placements")
      .select("id", { count: "exact", head: true })
      .in("bag_id", bagIds);
    throwDb(placementError);
    if ((count ?? 0) > 0) {
      throw new Error("Remove equipment from this compartment before deleting it.");
    }
    const { data: lines, error: linesError } = await supabase
      .from("rope_bag_lines")
      .select("quantity_on_hand")
      .in("bag_id", bagIds);
    throwDb(linesError);
    if ((lines ?? []).some((line) => (line.quantity_on_hand as number) > 0)) {
      throw new Error("Move bulk gear out of this compartment before deleting it.");
    }
  }

  const { error: deleteError } = await supabase.from("rope_compartments").delete().eq("id", id);
  throwDb(deleteError);
  touch([`/assets/rope/apparatus/${compartment.apparatus_id}`]);
}

export async function createBag(compartmentId: string, name: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("rope_bags")
    .select("id", { count: "exact", head: true })
    .eq("compartment_id", compartmentId);
  throwDb(countError);
  const { error } = await supabase.from("rope_bags").insert({
    compartment_id: compartmentId,
    name: cleanName(name),
    sort_order: count ?? 0,
  });
  throwDb(error, "That bag name is already used in this compartment.");
  touch([`/assets/rope/compartment/${compartmentId}`]);
}

export async function renameBag(id: string, name: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const context = await bagContext(supabase, id);
  if (context.isLoose) throw new Error("Loose equipment stays with the compartment.");
  const { error } = await supabase.from("rope_bags").update({ name: cleanName(name) }).eq("id", id);
  throwDb(error, "That bag name is already used in this compartment.");
  touch([
    `/assets/rope/compartment/${context.compartmentId}`,
    `/assets/rope/bag/${id}`,
  ]);
}

export async function deleteBag(id: string) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const context = await bagContext(supabase, id);
  if (context.isLoose) throw new Error("Loose equipment stays with the compartment.");
  const { count, error: placementError } = await supabase
    .from("rope_placements")
    .select("id", { count: "exact", head: true })
    .eq("bag_id", id);
  throwDb(placementError);
  if ((count ?? 0) > 0) throw new Error("Remove equipment from this bag before deleting it.");

  const { data: lines, error: linesError } = await supabase
    .from("rope_bag_lines")
    .select("quantity_on_hand")
    .eq("bag_id", id);
  throwDb(linesError);
  if ((lines ?? []).some((line) => (line.quantity_on_hand as number) > 0)) {
    throw new Error("Move bulk gear out of this bag before deleting it.");
  }

  const { error } = await supabase.from("rope_bags").delete().eq("id", id);
  throwDb(error);
  touch([`/assets/rope/compartment/${context.compartmentId}`]);
}

export async function copyBagLoadout(sourceBagId: string, targetBagId: string) {
  await requireManage();
  if (sourceBagId === targetBagId) throw new Error("Choose a different bag.");
  const supabase = await createSupabaseServerClient();
  const source = await bagContext(supabase, sourceBagId);
  const target = await bagContext(supabase, targetBagId);
  if (source.isLoose || target.isLoose) {
    throw new Error("Loose equipment stays with its compartment.");
  }

  const { data: sourceLines, error: sourceError } = await supabase
    .from("rope_bag_lines")
    .select("gear_type_id, expected_quantity, sort_order")
    .eq("bag_id", sourceBagId)
    .gt("expected_quantity", 0);
  throwDb(sourceError);
  const lines = (sourceLines ?? []) as {
    gear_type_id: string;
    expected_quantity: number;
    sort_order: number;
  }[];
  if (lines.length === 0) throw new Error("That bag has no required loadout to copy.");

  const { data: targetLines, error: targetError } = await supabase
    .from("rope_bag_lines")
    .select("id, gear_type_id, expected_quantity, sort_order")
    .eq("bag_id", targetBagId);
  throwDb(targetError);
  const existing = new Map(
    (
      (targetLines ?? []) as {
        id: string;
        gear_type_id: string;
        expected_quantity: number;
        sort_order: number;
      }[]
    ).map((line) => [line.gear_type_id, line])
  );

  for (const line of lines) {
    const current = existing.get(line.gear_type_id);
    if (current) {
      if (
        current.expected_quantity === line.expected_quantity &&
        current.sort_order === line.sort_order
      ) {
        continue;
      }
      const { error } = await supabase
        .from("rope_bag_lines")
        .update({ expected_quantity: line.expected_quantity, sort_order: line.sort_order })
        .eq("id", current.id);
      throwDb(error);
      continue;
    }
    const { error } = await supabase.from("rope_bag_lines").insert({
      bag_id: targetBagId,
      gear_type_id: line.gear_type_id,
      expected_quantity: line.expected_quantity,
      quantity_on_hand: 0,
      sort_order: line.sort_order,
    });
    throwDb(error, "That gear type is already on the other bag.");
  }

  await touchBag(supabase, sourceBagId, [`/assets/rope/apparatus/${source.apparatusId}`]);
  await touchBag(supabase, targetBagId, [`/assets/rope/apparatus/${target.apparatusId}`]);
}

export async function addBagLine(bagId: string, gearTypeId: string, expectedQuantity: number) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const expected = parseCount(expectedQuantity, "Required quantity", true);
  const { error } = await supabase.from("rope_bag_lines").insert({
    bag_id: bagId,
    gear_type_id: gearTypeId,
    expected_quantity: expected,
    quantity_on_hand: 0,
    sort_order: await nextLineSort(supabase, bagId),
  });
  throwDb(error, "That gear type is already on this bag.");
  await touchBag(supabase, bagId);
}

export async function reorderBagLines(bagId: string, lineIds: string[]) {
  await requireManage();
  if (lineIds.length === 0) return;
  const unique = new Set(lineIds);
  if (unique.size !== lineIds.length) throw new Error("That bag changed. Refresh and try again.");

  const supabase = await createSupabaseServerClient();
  const context = await bagContext(supabase, bagId);
  const { data, error } = await supabase.from("rope_bag_lines").select("id").eq("bag_id", bagId);
  throwDb(error);
  const known = new Set((data ?? []).map((row) => row.id as string));
  if (lineIds.length !== known.size || lineIds.some((id) => !known.has(id))) {
    throw new Error("That bag changed. Refresh and try again.");
  }

  for (const [index, id] of lineIds.entries()) {
    const { error: updateError } = await supabase
      .from("rope_bag_lines")
      .update({ sort_order: index + 1 })
      .eq("id", id)
      .eq("bag_id", bagId);
    throwDb(updateError);
  }
  await touchBag(supabase, bagId, [`/assets/rope/apparatus/${context.apparatusId}`]);
}

export async function addLooseLine(compartmentId: string, gearTypeId: string, expectedQuantity: number) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const expected = parseCount(expectedQuantity, "Required quantity", true);

  const { data: existing, error: lookupError } = await supabase
    .from("rope_bags")
    .select("id")
    .eq("compartment_id", compartmentId)
    .eq("is_loose", true)
    .maybeSingle();
  throwDb(lookupError);

  let bagId = existing?.id as string | undefined;
  if (!bagId) {
    const { data: created, error } = await supabase
      .from("rope_bags")
      .insert({
        compartment_id: compartmentId,
        name: "Loose equipment",
        is_loose: true,
        sort_order: 0,
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      const { data: again, error: againError } = await supabase
        .from("rope_bags")
        .select("id")
        .eq("compartment_id", compartmentId)
        .eq("is_loose", true)
        .maybeSingle();
      throwDb(againError);
      bagId = again?.id as string | undefined;
    } else {
      throwDb(error);
      bagId = created?.id as string | undefined;
    }
  }
  if (!bagId) throw new Error("Could not store loose equipment.");

  const { error: lineError } = await supabase.from("rope_bag_lines").insert({
    bag_id: bagId,
    gear_type_id: gearTypeId,
    expected_quantity: expected,
    quantity_on_hand: 0,
    sort_order: await nextLineSort(supabase, bagId),
  });
  throwDb(lineError, "That gear type is already loose in this compartment.");
  await touchBag(supabase, bagId);
}

export async function removeBagLine(lineId: string) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const line = await getLine(supabase, lineId);
  const { data: placementData, error: placementError } = await supabase
    .from("rope_placements")
    .select("id, asset_id, gear_type_id, bag_id, in_cache")
    .eq("bag_id", line.bag_id)
    .eq("gear_type_id", line.gear_type_id);
  throwDb(placementError);
  const placements = (placementData ?? []) as PlacementRow[];

  if (placements.length > 0) {
    const { error: clearError } = await supabase
      .from("rope_placements")
      .delete()
      .in(
        "id",
        placements.map((placement) => placement.id)
      );
    throwDb(clearError);
    try {
      for (const placement of placements) {
        await syncAsset(supabase, placement.asset_id, "clear");
      }
    } catch (error) {
      for (const placement of placements) await restorePlacement(supabase, placement);
      throw error;
    }
  }

  const { error: deleteError } = await supabase.from("rope_bag_lines").delete().eq("id", line.id);
  throwDb(deleteError);
  await recordEvent(supabase, profile.id, {
    action: "adjust",
    gearTypeId: line.gear_type_id,
    quantity: Math.max(1, line.quantity_on_hand),
    fromBagId: line.bag_id,
    notes: "Removed from the loadout.",
  });
  await touchBag(
    supabase,
    line.bag_id,
    placements.map((placement) => `/assets/${placement.asset_id}`)
  );
}

export async function setBagExpected(lineId: string, expectedQuantity: number) {
  await requireManage();
  const supabase = await createSupabaseServerClient();
  const line = await getLine(supabase, lineId);
  const expected = parseCount(expectedQuantity, "Par", true);
  const { error } = await supabase
    .from("rope_bag_lines")
    .update({ expected_quantity: expected })
    .eq("id", lineId);
  throwDb(error);
  await touchBag(supabase, line.bag_id);
}

export async function setBagBulk(lineId: string, quantity: number) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const line = await getLine(supabase, lineId);
  const next = parseCount(quantity, "On hand", true);
  if (next === line.quantity_on_hand) return;
  await setLineOnHand(supabase, lineId, line.quantity_on_hand, next);
  await recordEvent(supabase, profile.id, {
    action: "adjust",
    gearTypeId: line.gear_type_id,
    quantity: Math.max(1, Math.abs(next - line.quantity_on_hand)),
    toBagId: line.bag_id,
    notes: `Bulk on hand set to ${next}.`,
  });
  await touchBag(supabase, line.bag_id);
}

export async function markBagBulk(lineId: string, quantity: number, reason: "missing" | "broken") {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const line = await getLine(supabase, lineId);
  const qty = parseCount(quantity, "Quantity", false);
  if (qty > line.quantity_on_hand) {
    throw new Error("That is more bulk gear than this bag has on hand.");
  }
  await setLineOnHand(supabase, lineId, line.quantity_on_hand, line.quantity_on_hand - qty);
  await recordEvent(supabase, profile.id, {
    action: reason,
    gearTypeId: line.gear_type_id,
    quantity: qty,
    fromBagId: line.bag_id,
    notes: reason === "missing" ? "Bulk gear marked missing." : "Bulk gear marked broken.",
  });
  await touchBag(supabase, line.bag_id);
}

export async function attachAssetToBag(lineId: string, assetId: string) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const line = await getLine(supabase, lineId);
  const context = await bagContext(supabase, line.bag_id);
  await assertUnplaced(supabase, assetId);

  const { data: inserted, error: insertError } = await supabase
    .from("rope_placements")
    .insert({
      asset_id: assetId,
      gear_type_id: line.gear_type_id,
      bag_id: line.bag_id,
      in_cache: false,
    })
    .select("id")
    .single();
  throwDb(insertError, "That equipment is already in tech rescue inventory.");
  if (!inserted) throw new Error("Could not place that equipment.");

  try {
    await syncAsset(supabase, assetId, "bag", context.apparatusId);
  } catch (error) {
    await supabase.from("rope_placements").delete().eq("id", inserted.id);
    throw error;
  }

  await recordEvent(supabase, profile.id, {
    action: "transfer",
    gearTypeId: line.gear_type_id,
    assetId,
    toBagId: line.bag_id,
    notes: context.isLoose ? "Attached equipment to the compartment." : "Attached equipment to the bag.",
  });
  await touchBag(supabase, line.bag_id, [`/assets/${assetId}`]);
}

export async function markPlacement(placementId: string, reason: "missing" | "broken") {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const placement = await getPlacement(supabase, placementId);
  if (placement.in_cache || !placement.bag_id) {
    throw new Error("Cache spares stay in the reserve until you move or untrack them.");
  }

  const { error: deleteError } = await supabase.from("rope_placements").delete().eq("id", placement.id);
  throwDb(deleteError);
  try {
    await syncAsset(supabase, placement.asset_id, "out");
  } catch (error) {
    await restorePlacement(supabase, placement);
    throw error;
  }

  await recordEvent(supabase, profile.id, {
    action: reason,
    gearTypeId: placement.gear_type_id,
    assetId: placement.asset_id,
    fromBagId: placement.bag_id,
    notes: reason === "missing" ? "Equipment marked missing." : "Equipment marked broken.",
  });
  await touchBag(supabase, placement.bag_id, [`/assets/${placement.asset_id}`]);
}

export async function untrackPlacement(placementId: string) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const placement = await getPlacement(supabase, placementId);
  const { error: deleteError } = await supabase.from("rope_placements").delete().eq("id", placement.id);
  throwDb(deleteError);
  try {
    await syncAsset(supabase, placement.asset_id, "clear");
  } catch (error) {
    await restorePlacement(supabase, placement);
    throw error;
  }

  await recordEvent(supabase, profile.id, {
    action: "adjust",
    gearTypeId: placement.gear_type_id,
    assetId: placement.asset_id,
    fromBagId: placement.bag_id,
    fromCache: placement.in_cache,
    notes: "Removed from tech rescue inventory. Equipment is in service and unassigned.",
  });
  if (placement.bag_id) {
    await touchBag(supabase, placement.bag_id, [`/assets/${placement.asset_id}`]);
  } else {
    touch([`/assets/${placement.asset_id}`]);
  }
}

async function ensureBagLine(supabase: RopeClient, bagId: string, gearTypeId: string) {
  const context = await bagContext(supabase, bagId);
  if (context.isLoose) throw new Error("Choose a bag.");

  const { data: existing, error: existingError } = await supabase
    .from("rope_bag_lines")
    .select("id, bag_id, gear_type_id, expected_quantity, quantity_on_hand")
    .eq("bag_id", bagId)
    .eq("gear_type_id", gearTypeId)
    .maybeSingle();
  throwDb(existingError);
  if (existing) return existing as LineRow;

  const { data, error } = await supabase
    .from("rope_bag_lines")
    .insert({
      bag_id: bagId,
      gear_type_id: gearTypeId,
      expected_quantity: 0,
      quantity_on_hand: 0,
      sort_order: await nextLineSort(supabase, bagId),
    })
    .select("id, bag_id, gear_type_id, expected_quantity, quantity_on_hand")
    .maybeSingle();
  if (error?.code === "23505") {
    const { data: raced, error: racedError } = await supabase
      .from("rope_bag_lines")
      .select("id, bag_id, gear_type_id, expected_quantity, quantity_on_hand")
      .eq("bag_id", bagId)
      .eq("gear_type_id", gearTypeId)
      .maybeSingle();
    throwDb(racedError);
    if (!raced) throw new Error("Could not add that gear to the bag.");
    return raced as LineRow;
  }
  throwDb(error);
  if (!data) throw new Error("Could not add that gear to the bag.");
  return data as LineRow;
}

export async function sendCacheAssetToBag(placementId: string, bagId: string) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const placement = await getPlacement(supabase, placementId);
  if (!placement.in_cache) throw new Error("That spare is not in the reserve cache.");
  const line = await ensureBagLine(supabase, bagId, placement.gear_type_id);
  const context = await bagContext(supabase, line.bag_id);

  const { data: moved, error: moveError } = await supabase
    .from("rope_placements")
    .update({ bag_id: line.bag_id, in_cache: false })
    .eq("id", placement.id)
    .eq("in_cache", true)
    .select("id")
    .maybeSingle();
  throwDb(moveError);
  if (!moved) throw new Error("That spare is no longer in the cache. Refresh and try again.");

  try {
    await syncAsset(supabase, placement.asset_id, "bag", context.apparatusId);
  } catch (error) {
    await supabase
      .from("rope_placements")
      .update({ bag_id: null, in_cache: true })
      .eq("id", placement.id);
    throw error;
  }

  await recordEvent(supabase, profile.id, {
    action: "transfer",
    gearTypeId: line.gear_type_id,
    assetId: placement.asset_id,
    toBagId: line.bag_id,
    fromCache: true,
    notes: "Sent a spare from the reserve cache to the bag.",
  });
  await touchBag(supabase, line.bag_id, [`/assets/${placement.asset_id}`]);
}

export async function sendCacheBulkToBag(gearTypeId: string, bagId: string, quantity: number) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const qty = parseCount(quantity, "Quantity", false);
  const { data: stock, error: stockError } = await supabase
    .from("rope_cache_stock")
    .select("id, quantity")
    .eq("gear_type_id", gearTypeId)
    .maybeSingle();
  throwDb(stockError);
  if (!stock || stock.quantity < qty) {
    throw new Error("The reserve cache does not have that many.");
  }
  const line = await ensureBagLine(supabase, bagId, gearTypeId);

  const { data: decremented, error: decrementError } = await supabase
    .from("rope_cache_stock")
    .update({ quantity: stock.quantity - qty })
    .eq("id", stock.id)
    .eq("quantity", stock.quantity)
    .select("id")
    .maybeSingle();
  throwDb(decrementError);
  if (!decremented) throw new Error("Cache quantity changed. Refresh and try again.");

  const { data: incremented, error: incrementError } = await supabase
    .from("rope_bag_lines")
    .update({ quantity_on_hand: line.quantity_on_hand + qty })
    .eq("id", line.id)
    .eq("quantity_on_hand", line.quantity_on_hand)
    .select("id")
    .maybeSingle();
  throwDb(incrementError);
  if (!incremented) {
    await supabase
      .from("rope_cache_stock")
      .update({ quantity: stock.quantity })
      .eq("id", stock.id);
    throw new Error("Bag quantity changed. Refresh and try again.");
  }

  await recordEvent(supabase, profile.id, {
    action: "transfer",
    gearTypeId: line.gear_type_id,
    quantity: qty,
    toBagId: line.bag_id,
    fromCache: true,
    notes: "Sent bulk gear from the reserve cache to the bag.",
  });
  await touchBag(supabase, line.bag_id);
}

async function cacheStockRow(supabase: RopeClient, gearTypeId: string) {
  const { data, error } = await supabase
    .from("rope_cache_stock")
    .select("id, quantity")
    .eq("gear_type_id", gearTypeId)
    .maybeSingle();
  throwDb(error);
  return data as { id: string; quantity: number } | null;
}

export async function receiveCacheBulk(gearTypeId: string, quantity: number) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const qty = parseCount(quantity, "Quantity", false);
  const stock = await cacheStockRow(supabase, gearTypeId);
  if (!stock) {
    const { error } = await supabase.from("rope_cache_stock").insert({
      gear_type_id: gearTypeId,
      quantity: qty,
    });
    throwDb(error, "Cache quantity changed. Refresh and try again.");
  } else {
    const { data, error } = await supabase
      .from("rope_cache_stock")
      .update({ quantity: stock.quantity + qty })
      .eq("id", stock.id)
      .eq("quantity", stock.quantity)
      .select("id")
      .maybeSingle();
    throwDb(error);
    if (!data) throw new Error("Cache quantity changed. Refresh and try again.");
  }

  await recordEvent(supabase, profile.id, {
    action: "receive",
    gearTypeId,
    quantity: qty,
    toCache: true,
    notes: "Received bulk gear into the reserve cache.",
  });
  touch();
}

export async function setCacheBulk(gearTypeId: string, quantity: number) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  const next = parseCount(quantity, "Cache quantity", true);
  const stock = await cacheStockRow(supabase, gearTypeId);
  const previous = stock?.quantity ?? 0;
  if (next === previous) return;

  if (!stock) {
    const { error } = await supabase.from("rope_cache_stock").insert({
      gear_type_id: gearTypeId,
      quantity: next,
    });
    throwDb(error);
  } else {
    const { data, error } = await supabase
      .from("rope_cache_stock")
      .update({ quantity: next })
      .eq("id", stock.id)
      .eq("quantity", previous)
      .select("id")
      .maybeSingle();
    throwDb(error);
    if (!data) throw new Error("Cache quantity changed. Refresh and try again.");
  }

  await recordEvent(supabase, profile.id, {
    action: "adjust",
    gearTypeId,
    quantity: Math.max(1, Math.abs(next - previous)),
    toCache: true,
    notes: `Reserve cache quantity set to ${next}.`,
  });
  touch();
}

export async function placeAssetInCache(gearTypeId: string, assetId: string) {
  const profile = await requireManage();
  const supabase = await createSupabaseServerClient();
  await assertUnplaced(supabase, assetId);

  const { data: inserted, error: insertError } = await supabase
    .from("rope_placements")
    .insert({
      asset_id: assetId,
      gear_type_id: gearTypeId,
      bag_id: null,
      in_cache: true,
    })
    .select("id")
    .single();
  throwDb(insertError, "That equipment is already in tech rescue inventory.");
  if (!inserted) throw new Error("Could not place that equipment.");

  try {
    await syncAsset(supabase, assetId, "cache");
  } catch (error) {
    await supabase.from("rope_placements").delete().eq("id", inserted.id);
    throw error;
  }

  await recordEvent(supabase, profile.id, {
    action: "receive",
    gearTypeId,
    assetId,
    toCache: true,
    notes: "Placed equipment in the reserve cache.",
  });
  touch([`/assets/${assetId}`]);
}

export async function saveRopeAudit(input: {
  bagId?: string | null;
  compartmentId?: string | null;
  findings: {
    bagId: string;
    gearTypeId: string;
    reason: "missing" | "damaged" | "other";
    quantity: number;
    notes: string;
  }[];
}) {
  await requireManage();
  const bagId = input.bagId ?? null;
  const compartmentId = input.compartmentId ?? null;
  if ((bagId === null) === (compartmentId === null)) {
    throw new Error("Choose a bag or a compartment.");
  }
  const findings = input.findings.map((finding) => {
    const quantity = parseCount(finding.quantity, "Quantity", false);
    const notes = finding.notes.trim();
    if (!["missing", "damaged", "other"].includes(finding.reason)) {
      throw new Error("Choose missing, damaged, or other.");
    }
    if (finding.reason === "other" && !notes) throw new Error("Add a note for other findings.");
    if (notes.length > 500) throw new Error("Note must be 500 characters or fewer.");
    return {
      bag_id: finding.bagId,
      gear_type_id: finding.gearTypeId,
      reason: finding.reason,
      quantity,
      notes,
    };
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rope_save_audit", {
    p_bag_id: bagId,
    p_compartment_id: compartmentId,
    p_findings: findings,
  });
  throwDb(error);
  const paths = [];
  if (bagId) paths.push(`/assets/rope/bag/${bagId}`);
  if (compartmentId) paths.push(`/assets/rope/compartment/${compartmentId}`);
  if (bagId) {
    const context = await bagContext(supabase, bagId);
    paths.push(`/assets/rope/compartment/${context.compartmentId}`);
  }
  touch(paths);
}
