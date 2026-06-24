import type { ProgramModuleEntry } from "@/lib/training-lms-types";

type ProgramModuleRow = {
  sort_order: number;
  modules: ProgramModuleEntry | ProgramModuleEntry[] | null;
};

export function programModulesFromRows(rows: ProgramModuleRow[] | null | undefined): ProgramModuleEntry[] {
  return (rows ?? [])
    .map((row) => {
      const module = Array.isArray(row.modules) ? row.modules[0] : row.modules;
      if (!module) return null;
      return { ...module, sort_order: row.sort_order };
    })
    .filter((entry): entry is ProgramModuleEntry => entry !== null);
}
