"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { APP_CAPABILITIES, capabilityMeta, type AppCapability } from "@/lib/capabilities";
import {
  PERMISSION_LEVEL_SELECT,
  type PermissionLevel,
} from "@/lib/permission-levels-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseErrorMessage } from "@/lib/supabase/errors";

function revalidatePermissions() {
  revalidatePath("/admin/permissions");
  revalidatePath("/admin");
  revalidatePath("/personnel", "layout");
  revalidatePath("/", "layout");
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createPermissionLevel(input: { name: string }) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Enter a permission level name.");

  const supabase = await createSupabaseServerClient();
  const { data: maxRow } = await supabase
    .from("permission_levels")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("permission_levels")
    .insert({
      name,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
      is_default: false,
    })
    .select(PERMISSION_LEVEL_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A permission level with that name already exists.");
    throw new Error(supabaseErrorMessage(error));
  }

  revalidatePermissions();
  return data as PermissionLevel;
}

export async function updatePermissionLevel(input: {
  id: string;
  name?: string;
  isDefault?: boolean;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("permission_levels")
    .select(PERMISSION_LEVEL_SELECT)
    .eq("id", input.id)
    .maybeSingle();
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Permission level not found.");

  const previous = existing as PermissionLevel;
  const name = input.name != null ? emptyToNull(input.name) : previous.name;
  if (!name) throw new Error("Enter a permission level name.");

  const { data, error } = await supabase
    .from("permission_levels")
    .update({
      name,
      is_default: input.isDefault ?? previous.is_default,
    })
    .eq("id", input.id)
    .select(PERMISSION_LEVEL_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A permission level with that name already exists.");
    throw new Error(supabaseErrorMessage(error));
  }

  revalidatePermissions();
  return data as PermissionLevel;
}

export async function deletePermissionLevel(input: { id: string }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("permission_levels")
    .select(PERMISSION_LEVEL_SELECT)
    .eq("id", input.id)
    .maybeSingle();
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Permission level not found.");
  const level = existing as PermissionLevel;

  const [{ count: levelCount, error: levelCountError }, { count: memberCount, error: memberCountError }] =
    await Promise.all([
      supabase.from("permission_levels").select("id", { count: "exact", head: true }),
      supabase
        .from("profile_permission_levels")
        .select("profile_id", { count: "exact", head: true })
        .eq("permission_level_id", level.id),
    ]);
  if (levelCountError) throw new Error(supabaseErrorMessage(levelCountError));
  if (memberCountError) throw new Error(supabaseErrorMessage(memberCountError));

  if ((levelCount ?? 0) <= 1) {
    throw new Error("Keep at least one permission level.");
  }
  if ((memberCount ?? 0) > 0) {
    throw new Error(
      `Cannot delete "${level.name}" while ${memberCount} member${memberCount === 1 ? " is" : "s are"} assigned to it. Reassign them first.`
    );
  }

  const { error } = await supabase.from("permission_levels").delete().eq("id", level.id);
  if (error) throw new Error(supabaseErrorMessage(error));

  if (level.is_default) {
    const { data: nextDefault } = await supabase
      .from("permission_levels")
      .select("id")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextDefault?.id) {
      await supabase.from("permission_levels").update({ is_default: true }).eq("id", nextDefault.id);
    }
  }

  revalidatePermissions();
}

export async function reorderPermissionLevels(input: { permissionLevelIds: string[] }) {
  await requireAdmin();
  if (input.permissionLevelIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.permissionLevelIds.entries()) {
    const { error } = await supabase
      .from("permission_levels")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidatePermissions();
}

export async function reorderCapabilities(input: {
  items: { capability: string; group: string; label?: string }[];
}) {
  const profile = await requireAdmin();
  if (input.items.length === 0) return;

  const known = new Set<string>(APP_CAPABILITIES);
  const seen = new Set<string>();
  const items: { capability: AppCapability; group: string; label: string }[] = [];

  for (const item of input.items) {
    if (!known.has(item.capability) || seen.has(item.capability)) continue;
    const group = item.group.trim();
    if (!group) continue;
    const capability = item.capability as AppCapability;
    const label = item.label?.trim() || capabilityMeta[capability].label;
    seen.add(item.capability);
    items.push({ capability, group, label });
  }

  for (const capability of APP_CAPABILITIES) {
    if (seen.has(capability)) continue;
    items.push({
      capability,
      group: capabilityMeta[capability].group,
      label: capabilityMeta[capability].label,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_display_order").upsert(
    items.map((item, index) => ({
      client_id: profile.client_id,
      capability: item.capability,
      group_name: item.group,
      label: item.label,
      sort_order: index + 1,
    })),
    { onConflict: "client_id,capability" }
  );
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePermissions();
}

export async function renameCapability(input: { capability: string; label: string }) {
  const profile = await requireAdmin();
  if (!(APP_CAPABILITIES as readonly string[]).includes(input.capability)) {
    throw new Error("Unknown capability.");
  }
  const capability = input.capability as AppCapability;
  const label = input.label.trim();
  if (!label) throw new Error("Enter a capability name.");

  const supabase = await createSupabaseServerClient();
  const meta = capabilityMeta[capability];

  const { data: existing, error: existingError } = await supabase
    .from("capability_display_order")
    .select("capability, group_name, sort_order")
    .eq("capability", capability)
    .maybeSingle();
  if (existingError) throw new Error(supabaseErrorMessage(existingError));

  if (existing) {
    const { error } = await supabase
      .from("capability_display_order")
      .update({ label })
      .eq("capability", capability);
    if (error) throw new Error(supabaseErrorMessage(error));
  } else {
    const { data: maxRow } = await supabase
      .from("capability_display_order")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("capability_display_order").insert({
      client_id: profile.client_id,
      capability,
      group_name: meta.group,
      label,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    });
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidatePermissions();
}

export async function updateLevelCapabilities(input: {
  permissionLevelId: string;
  rows: { capability: AppCapability; enabled: boolean }[];
}) {
  const profile = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: level, error: levelError } = await supabase
    .from("permission_levels")
    .select("id")
    .eq("id", input.permissionLevelId)
    .maybeSingle();
  if (levelError) throw new Error(supabaseErrorMessage(levelError));
  if (!level) throw new Error("Permission level not found.");

  for (const row of input.rows) {
    if (!(APP_CAPABILITIES as readonly string[]).includes(row.capability)) {
      throw new Error("Invalid capability");
    }
  }

  const { error } = await supabase.from("permission_level_capabilities").upsert(
    input.rows.map((row) => ({
      client_id: profile.client_id,
      permission_level_id: input.permissionLevelId,
      capability: row.capability,
      enabled: row.enabled,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "permission_level_id,capability" }
  );

  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePermissions();
}
