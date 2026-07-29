"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable, isMissingLocationsTable, supabaseErrorMessage } from "@/lib/supabase/errors";
import { LOCATION_SELECT, type Location } from "@/lib/locations-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (isMissingLocationsTable(error)) {
    throw new Error(
      "Locations table is not set up yet. Run the locations migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type LocationFormInput = {
  name: string;
  sort_order?: number;
  is_active?: boolean;
  notes?: string;
};

export async function createLocation(input: LocationFormInput) {
  await requireRole(["admin"]);
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("locations")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("locations")
    .insert({
      name,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      notes: input.notes?.trim() ?? "",
    })
    .select(LOCATION_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePath("/admin");
  revalidatePath("/admin/locations");
  revalidatePath("/assets");
  revalidatePath("/assets/apparatus");
  revalidatePath("/assets/new");
  return data as Location;
}

export async function updateLocation(id: string, input: LocationFormInput) {
  await requireRole(["admin"]);
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("locations")
    .select(LOCATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Location not found.");

  const previous = existing as Location;
  const nextName = name;

  const { data, error } = await supabase
    .from("locations")
    .update({
      name: nextName,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      notes: input.notes?.trim() ?? previous.notes,
    })
    .eq("id", id)
    .select(LOCATION_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  if (previous.name !== nextName) {
    const { error: assetsError } = await supabase
      .from("assets")
      .update({ station: nextName })
      .eq("station", previous.name);
    if (assetsError && !isMissingAssetsTable(assetsError)) {
      throw new Error(supabaseErrorMessage(assetsError));
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locations");
  revalidatePath("/assets");
  revalidatePath("/assets/apparatus");
  revalidatePath("/assets/new");
  return data as Location;
}

export async function deleteLocation(id: string) {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("locations")
    .select(LOCATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Location not found.");

  const location = existing as Location;

  const { count, error: countError } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("station", location.name);

  if (countError) throw new Error(supabaseErrorMessage(countError));
  if ((count ?? 0) > 0) {
    throw new Error(
      `Cannot delete "${location.name}" while ${count} asset${count === 1 ? "" : "s"} still use it. Deactivate it instead, or reassign those assets.`
    );
  }

  const { error } = await supabase.from("locations").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePath("/admin");
  revalidatePath("/admin/locations");
  revalidatePath("/assets");
  revalidatePath("/assets/apparatus");
  revalidatePath("/assets/new");
}

export async function reorderLocations(input: { locationIds: string[] }) {
  await requireRole(["admin"]);
  if (input.locationIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.locationIds.entries()) {
    const { error } = await supabase
      .from("locations")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/locations");
  revalidatePath("/assets");
  revalidatePath("/assets/apparatus");
  revalidatePath("/assets/new");
}
