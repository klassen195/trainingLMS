import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { ProgramCard } from "@/components/ProgramCard";
import { ProgramCategoryGrid } from "@/components/ProgramCategoryGrid";
import { tagLabel, programTags } from "@/lib/labels";
import { loadBulkProgramProgress } from "@/lib/program-module-progress";
import {
  mapProgramRows,
  PROGRAM_WITH_TAGS_SELECT,
  type ProgramQueryRow,
} from "@/lib/program-tags";
import { countProgramsByTag, loadUserHighlightIds } from "@/lib/user-highlights";
import type { ProgramTag } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; category?: string }>;
}) {
  const profile = await requireUserProfile();
  const caps = await getProfileCapabilities(profile);
  const limitedCatalog = !caps.browse_program_catalog;
  const params = await searchParams;
  const requestedTag = (params.tag ?? params.category) as ProgramTag | undefined;
  const activeTag = requestedTag && programTags.includes(requestedTag) ? requestedTag : undefined;
  const supabase = await createSupabaseServerClient();

  const { data: programs, error } = await supabase
    .from("programs")
    .select(PROGRAM_WITH_TAGS_SELECT)
    .eq("status", "published")
    .order("title");

  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  const programList = mapProgramRows(programs as ProgramQueryRow[]);
  const tagCounts = countProgramsByTag(programList);

  if (!activeTag) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{limitedCatalog ? "Assigned training" : "Programs"}</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            {limitedCatalog
              ? "Programs you have been enrolled in by an instructor or admin."
              : "Browse training by division."}
          </p>
        </div>
        {programList.length === 0 && limitedCatalog ? (
          <div className="rounded-lg border py-12 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No assigned programs yet.</p>
          </div>
        ) : (
          <ProgramCategoryGrid programCounts={tagCounts} />
        )}
      </div>
    );
  }

  const filteredPrograms = programList.filter((program) => program.tags.includes(activeTag));
  const withProgress = await loadBulkProgramProgress(supabase, profile.id, filteredPrograms);
  const progressByProgramId = new Map(withProgress.map((item) => [item.program.id, item]));
  const { programIds: highlightedProgramIds } = await loadUserHighlightIds(supabase, profile.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link href="/programs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All divisions
          </Link>
        </Button>
        <div className="mb-2 flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">{tagLabel(activeTag)}</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          {filteredPrograms.length} published program{filteredPrograms.length === 1 ? "" : "s"} in this division.
        </p>
      </div>

      {filteredPrograms.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            {limitedCatalog ? "No assigned programs with this tag yet." : "No programs with this tag yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPrograms.map((program) => {
            const progress = progressByProgramId.get(program.id);
            return (
              <ProgramCard
                key={program.id}
                program={program}
                progressPercent={progress?.pct ?? undefined}
                enrolledCount={progress?.enrolledCount ?? 0}
                moduleCount={progress?.moduleCount ?? 0}
                highlighted={highlightedProgramIds.has(program.id)}
                showStar
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
