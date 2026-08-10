export type EmsClearanceLevel = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  notes: string;
};

export const EMS_CLEARANCE_LEVEL_SELECT =
  "id, created_at, updated_at, name, sort_order, is_active, notes";
