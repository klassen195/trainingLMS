export type EquipmentCategory = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  notes: string;
};

export const EQUIPMENT_CATEGORY_SELECT =
  "id, created_at, updated_at, name, sort_order, is_active, notes";

/** Seeded defaults; used only when the equipment_categories table is not yet migrated. */
export const DEFAULT_EQUIPMENT_CATEGORY_NAMES = [
  "Turnout coat",
  "Turnout pants",
  "Helmet",
  "Boots",
  "Gloves",
  "Hood",
  "SCBA facepiece",
  "Other",
] as const;
