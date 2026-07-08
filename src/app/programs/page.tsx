import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { ProgramCard } from "@/components/ProgramCard";
import { ProgramCategoryGrid } from "@/components/ProgramCategoryGrid";
import { categoryLabel, programCategories } from "@/lib/labels";
import { loadBulkProgramProgress } from "@/lib/program-module-progress";
import { countProgramsByCategory, loadUserHighlightIds } from "@/lib/user-highlights";
import type { Program, ProgramCategory } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const profile = await requireUserProfile();
  const params = await searchParams;
  const category = params.category as ProgramCategory | undefined;
  const activeCategory = category && programCategories.includes(category) ? category : undefined;
  const supabase = await createSupabaseServerClient();

  const { data: programs, error } = await supabase
    .from("programs")
    .select("*")
    .eq("status", "published")
    .order("title");

  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  const programList = (programs ?? []) as Program[];
  const categoryCounts = countProgramsByCategory(programList);

  if (!activeCategory) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Programs</h1>
          </div>
          <p className="text-lg text-muted-foreground">Browse training by division.</p>
        </div>
        <ProgramCategoryGrid programCounts={categoryCounts} />
      </div>
    );
  }

  const filteredPrograms = programList.filter((program) => program.category === activeCategory);
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
          <h1 className="text-4xl font-bold">{categoryLabel(activeCategory)}</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          {filteredPrograms.length} published program{filteredPrograms.length === 1 ? "" : "s"} in this division.
        </p>
      </div>

      {filteredPrograms.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No programs in this category yet.</p>
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
