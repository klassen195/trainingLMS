import { Award, BookOpen, Star, TrendingUp } from "lucide-react";
import { ProgramCard } from "@/components/ProgramCard";
import { MyProgramsSection } from "@/components/MyProgramsSection";
import { ProgressBar } from "@/components/ProgressBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { loadBulkProgramProgress } from "@/lib/program-module-progress";
import { programProgressStatus } from "@/lib/program-progress";
import { loadUserHighlightIds, loadUserHighlights } from "@/lib/user-highlights";
import type { Program } from "@/lib/training-lms-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function TrainingProgressOverview({
  supabase,
  profileId,
  programs,
}: {
  supabase: SupabaseClient;
  profileId: string;
  programs: Program[];
}) {
  const withProgress = await loadBulkProgramProgress(supabase, profileId, programs);
  const progressByProgramId = new Map(
    withProgress.map((item) => [
      item.program.id,
      {
        pct: item.pct,
        moduleCount: item.moduleCount,
        enrolledCount: item.enrolledCount,
        program: item.program,
      },
    ])
  );
  const myPrograms = await loadUserHighlights(supabase, profileId, progressByProgramId);
  const { programIds: highlightedProgramIds } = await loadUserHighlightIds(supabase, profileId);

  const enrolledPrograms = withProgress.filter((item) => item.pct !== null);
  const inProgress = enrolledPrograms.filter((item) => programProgressStatus(item.pct!) === "in_progress");
  const completed = enrolledPrograms.filter((item) => programProgressStatus(item.pct!) === "completed");
  const totalProgress =
    enrolledPrograms.length === 0
      ? null
      : Math.round(enrolledPrograms.reduce((sum, item) => sum + item.pct!, 0) / enrolledPrograms.length);

  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProgress === null ? "Not enrolled" : `${totalProgress}%`}</div>
            {totalProgress !== null ? <ProgressBar value={totalProgress} className="mt-2" /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgress.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Active programs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completed.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Finished programs</p>
          </CardContent>
        </Card>
      </div>

      {inProgress.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-bold">Continue Learning</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {inProgress.map((item) => (
              <ProgramCard
                key={item.program.id}
                program={item.program}
                progressPercent={item.pct ?? undefined}
                enrolledCount={item.enrolledCount}
                moduleCount={item.moduleCount}
                highlighted={highlightedProgramIds.has(item.program.id)}
                showStar
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <div className="mb-6 flex items-center gap-3">
          <Star className="h-6 w-6 text-amber-400" />
          <h2 className="text-2xl font-bold">My Programs</h2>
        </div>
        <MyProgramsSection items={myPrograms} />
      </section>
    </>
  );
}
