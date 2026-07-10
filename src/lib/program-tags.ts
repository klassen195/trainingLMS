import { programTags } from "@/lib/labels";
import type { Program, ProgramStatus, ProgramTag } from "@/lib/training-lms-types";

export const PROGRAM_WITH_TAGS_SELECT = "*, program_tags(tag)";

type ProgramTagRow = { tag: ProgramTag };

export type ProgramQueryRow = {
  id: string;
  title: string;
  description: string | null;
  status: ProgramStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  program_tags?: ProgramTagRow[] | null;
};

function sortTags(tags: ProgramTag[]): ProgramTag[] {
  return programTags.filter((tag) => tags.includes(tag));
}

export function mapProgramRow(row: ProgramQueryRow): Program {
  const tags = sortTags((row.program_tags ?? []).map((entry) => entry.tag));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapProgramRows(rows: ProgramQueryRow[] | null | undefined): Program[] {
  return (rows ?? []).map(mapProgramRow);
}
