import type { Program, ProgramCategory } from "@/lib/training-lms-types";
import { programCategories } from "@/lib/labels";

export function groupProgramsByCategory(programs: Program[]) {
  const grouped = new Map<ProgramCategory, Program[]>();

  for (const category of programCategories) {
    grouped.set(category, []);
  }

  for (const program of programs) {
    grouped.get(program.category)?.push(program);
  }

  return programCategories
    .map((category) => ({
      category,
      programs: grouped.get(category) ?? [],
    }))
    .filter((section) => section.programs.length > 0);
}
