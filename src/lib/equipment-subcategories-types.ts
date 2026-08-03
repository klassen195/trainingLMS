export type EquipmentSubcategory = {
  id: string;
  created_at: string;
  updated_at: string;
  equipment_category_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  notes: string;
};

export type EquipmentSubcategoryWithCategory = EquipmentSubcategory & {
  equipment_category?: { id: string; name: string } | null;
};

export const EQUIPMENT_SUBCATEGORY_SELECT =
  "id, created_at, updated_at, equipment_category_id, name, sort_order, is_active, notes";

export const EQUIPMENT_SUBCATEGORY_WITH_CATEGORY_SELECT = `${EQUIPMENT_SUBCATEGORY_SELECT}, equipment_category:equipment_categories!equipment_category_id(id, name)`;
