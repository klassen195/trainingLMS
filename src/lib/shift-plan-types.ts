import type { ShiftColor } from "@/lib/shift-rotation";

export type ShiftPlanScope = "battalion" | "station";

export type ShiftPlanCreator = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type ShiftPlanLocation = {
  id: string;
  name: string;
  sort_order: number;
};

export type ShiftPlanItem = {
  id: string;
  created_at: string;
  updated_at: string;
  shift_date: string;
  shift_color: ShiftColor;
  scope: ShiftPlanScope;
  location_id: string | null;
  title: string;
  notes: string;
  item_date: string | null;
  start_time: string | null;
  end_time: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  location: ShiftPlanLocation | null;
  creator: ShiftPlanCreator | null;
};

export const SHIFT_PLAN_ITEM_SELECT =
  "id, created_at, updated_at, shift_date, shift_color, scope, location_id, title, notes, item_date, start_time, end_time, completed, completed_at, created_by, location:locations!location_id(id, name, sort_order), creator:profiles!created_by(id, display_name, first_name, last_name, email)";

export type ShiftPlanFilter = "all" | "battalion" | string;

export function shiftPlanCreatorName(creator: ShiftPlanCreator | null | undefined) {
  if (!creator) return null;
  const firstLast = [creator.first_name, creator.last_name].filter(Boolean).join(" ").trim();
  return firstLast || creator.display_name || creator.email || null;
}

export function shiftColorDayClass(color: ShiftColor) {
  if (color === "Green") return "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30";
  if (color === "Red") return "bg-red-500/20 text-red-100 hover:bg-red-500/30";
  return "bg-sky-500/20 text-sky-100 hover:bg-sky-500/30";
}

export function shiftColorBadgeClass(color: ShiftColor) {
  if (color === "Green") return "border-emerald-500/40 bg-emerald-500/20 text-emerald-100";
  if (color === "Red") return "border-red-500/40 bg-red-500/20 text-red-100";
  return "border-sky-500/40 bg-sky-500/20 text-sky-100";
}

export function compareShiftPlanItems(a: ShiftPlanItem, b: ShiftPlanItem) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  const dateA = a.item_date ?? "";
  const dateB = b.item_date ?? "";
  if (dateA !== dateB) {
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.localeCompare(dateB);
  }
  const timeA = a.start_time ?? "";
  const timeB = b.start_time ?? "";
  if (timeA !== timeB) {
    if (!timeA) return 1;
    if (!timeB) return -1;
    return timeA.localeCompare(timeB);
  }
  return a.title.localeCompare(b.title);
}

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function parseShiftPlanItems(rows: unknown): ShiftPlanItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as ShiftPlanItem & {
      location?: ShiftPlanLocation | ShiftPlanLocation[] | null;
      creator?: ShiftPlanCreator | ShiftPlanCreator[] | null;
    };
    return {
      ...item,
      completed: Boolean(item.completed),
      location: asSingle(item.location),
      creator: asSingle(item.creator),
    };
  });
}
