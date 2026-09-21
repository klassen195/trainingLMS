export type Qualification = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  notes: string;
  pdip_eligible: boolean;
};

export const QUALIFICATION_SELECT =
  "id, created_at, updated_at, name, sort_order, is_active, notes, pdip_eligible";
