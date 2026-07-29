export type Location = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  notes: string;
};

export const LOCATION_SELECT =
  "id, created_at, updated_at, name, sort_order, is_active, notes";

/** Seeded defaults; used only when the locations table is not yet migrated. */
export const DEFAULT_LOCATION_NAMES = [
  "Station 1",
  "Station 2",
  "Station 3",
  "Station 4",
  "Station 5",
] as const;
