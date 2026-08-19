import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PERMISSION_LEVEL_SELECT,
  type PermissionLevel,
  type ProfilePermissionLevel,
} from "@/lib/permission-levels-types";

export async function listPermissionLevels(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("permission_levels")
    .select(PERMISSION_LEVEL_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return { rows: (data ?? []) as PermissionLevel[], error };
}

export function defaultPermissionLevelId(levels: PermissionLevel[]) {
  return levels.find((level) => level.is_default)?.id ?? levels[0]?.id ?? "";
}

export function permissionLevelName(
  level: { name: string } | { name: string }[] | string | null | undefined
) {
  if (!level) return "—";
  if (typeof level === "string") return level;
  if (Array.isArray(level)) {
    const names = level.map((item) => item.name).filter(Boolean);
    return names.length ? names.join(" · ") : "—";
  }
  return level.name;
}

type AssignmentEmbed = {
  permission_level_id?: string;
  permission_level?:
    | { id: string; name: string; sort_order?: number }
    | { id: string; name: string; sort_order?: number }[]
    | null;
};

export function parseProfilePermissionLevels(row: {
  profile_permission_levels?: AssignmentEmbed[] | null;
  permission_levels?: ProfilePermissionLevel[] | null;
  permission_level_ids?: string[] | null;
}): { permission_levels: ProfilePermissionLevel[]; permission_level_ids: string[] } {
  if (row.permission_levels?.length) {
    return {
      permission_levels: row.permission_levels,
      permission_level_ids: row.permission_level_ids?.length
        ? row.permission_level_ids
        : row.permission_levels.map((level) => level.id),
    };
  }

  const levels = (row.profile_permission_levels ?? [])
    .map((assignment) => {
      const nested = assignment.permission_level;
      return Array.isArray(nested) ? nested[0] : nested;
    })
    .filter((level): level is { id: string; name: string; sort_order?: number } =>
      Boolean(level?.id && level.name)
    )
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
    .map(({ id, name }) => ({ id, name }));

  return {
    permission_levels: levels,
    permission_level_ids: levels.map((level) => level.id),
  };
}

export function profilePermissionLevelIds(profile: {
  permission_level_ids?: string[] | null;
  permission_levels?: ProfilePermissionLevel[] | null;
}) {
  if (profile.permission_level_ids?.length) return profile.permission_level_ids;
  return (profile.permission_levels ?? []).map((level) => level.id);
}

export async function attachProfilePermissionLevels<T extends { id: string }>(
  supabase: SupabaseClient,
  profiles: T[]
): Promise<(T & { permission_levels: ProfilePermissionLevel[]; permission_level_ids: string[] })[]> {
  if (profiles.length === 0) return [];

  const { data, error } = await supabase
    .from("profile_permission_levels")
    .select(
      "profile_id, permission_level_id, permission_level:permission_levels!profile_permission_levels_level_client_fkey(id, name, sort_order)"
    )
    .in(
      "profile_id",
      profiles.map((profile) => profile.id)
    );

  const assignmentsByProfile = new Map<string, AssignmentEmbed[]>();
  if (!error && data) {
    for (const row of data as (AssignmentEmbed & { profile_id: string })[]) {
      const list = assignmentsByProfile.get(row.profile_id) ?? [];
      list.push(row);
      assignmentsByProfile.set(row.profile_id, list);
    }
  } else {
    const fallback = await supabase
      .from("profile_permission_levels")
      .select("profile_id, permission_level_id")
      .in(
        "profile_id",
        profiles.map((profile) => profile.id)
      );
    const ids = [...new Set((fallback.data ?? []).map((row) => row.permission_level_id as string))];
    const { data: levels } = ids.length
      ? await supabase.from("permission_levels").select("id, name, sort_order").in("id", ids)
      : { data: [] as { id: string; name: string; sort_order?: number }[] };
    const byId = new Map((levels ?? []).map((level) => [level.id, level]));
    for (const row of fallback.data ?? []) {
      const level = byId.get(row.permission_level_id as string);
      if (!level) continue;
      const list = assignmentsByProfile.get(row.profile_id as string) ?? [];
      list.push({ permission_level_id: level.id, permission_level: level });
      assignmentsByProfile.set(row.profile_id as string, list);
    }
  }

  return profiles.map((profile) => ({
    ...profile,
    ...parseProfilePermissionLevels({
      profile_permission_levels: assignmentsByProfile.get(profile.id) ?? [],
    }),
  }));
}

export async function loadProfilePermissionLevels(supabase: SupabaseClient, profileId: string) {
  const [attached] = await attachProfilePermissionLevels(supabase, [{ id: profileId }]);
  return {
    permission_levels: attached?.permission_levels ?? [],
    permission_level_ids: attached?.permission_level_ids ?? [],
  };
}

export async function replaceProfilePermissionLevels(
  supabase: SupabaseClient,
  input: { profileId: string; clientId: string; permissionLevelIds: string[] }
) {
  const ids = [...new Set(input.permissionLevelIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error("Assign at least one permission level.");

  const { data: levels, error: levelError } = await supabase
    .from("permission_levels")
    .select("id")
    .in("id", ids);
  if (levelError) throw new Error(levelError.message);
  if ((levels?.length ?? 0) !== ids.length) throw new Error("Permission level not found.");

  const { data: existing, error: existingError } = await supabase
    .from("profile_permission_levels")
    .select("permission_level_id")
    .eq("profile_id", input.profileId);
  if (existingError) throw new Error(existingError.message);

  const current = new Set((existing ?? []).map((row) => row.permission_level_id as string));
  const next = new Set(ids);
  const toInsert = ids.filter((id) => !current.has(id));
  const toDelete = [...current].filter((id) => !next.has(id));

  if (toInsert.length) {
    const { error } = await supabase.from("profile_permission_levels").insert(
      toInsert.map((permission_level_id) => ({
        profile_id: input.profileId,
        permission_level_id,
        client_id: input.clientId,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (toDelete.length) {
    const { error } = await supabase
      .from("profile_permission_levels")
      .delete()
      .eq("profile_id", input.profileId)
      .in("permission_level_id", toDelete);
    if (error) throw new Error(error.message);
  }
}
