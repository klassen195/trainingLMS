export type PermissionLevel = {
  id: string;
  client_id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfilePermissionLevel = {
  id: string;
  name: string;
};

export const PERMISSION_LEVEL_SELECT =
  "id, client_id, name, sort_order, is_default, created_at, updated_at";

export const PROFILE_PERMISSION_LEVELS_EMBED =
  "profile_permission_levels(permission_level_id, permission_level:permission_levels!profile_permission_levels_level_client_fkey(id, name, sort_order))";
