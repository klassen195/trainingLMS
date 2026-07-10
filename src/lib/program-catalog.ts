import type { Program, ProgramTag } from "@/lib/training-lms-types";
import { programTags } from "@/lib/labels";

export function groupProgramsByTag(programs: Program[]) {
  const grouped = new Map<ProgramTag, Program[]>();

  for (const tag of programTags) {
    grouped.set(tag, []);
  }

  for (const program of programs) {
    for (const tag of program.tags) {
      grouped.get(tag)?.push(program);
    }
  }

  return programTags
    .map((tag) => ({
      tag,
      programs: grouped.get(tag) ?? [],
    }))
    .filter((section) => section.programs.length > 0);
}

/** @deprecated Prefer groupProgramsByTag */
export function groupProgramsByCategory(programs: Program[]) {
  return groupProgramsByTag(programs).map((section) => ({
    category: section.tag,
    programs: section.programs,
  }));
}
