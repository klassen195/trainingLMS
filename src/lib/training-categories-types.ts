export type TrainingCategory = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  notes: string;
};

export const TRAINING_CATEGORY_SELECT =
  "id, created_at, updated_at, name, sort_order, is_active, notes";

export const DEFAULT_TRAINING_CATEGORY_NAMES = [
  "Administration",
  "EMS",
  "Fire",
  "Driver",
  "Officer",
  "Special Operations",
] as const;
