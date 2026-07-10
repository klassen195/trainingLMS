import { redirect } from "next/navigation";
import { Award, BookOpen, GraduationCap, LayoutDashboard, Star, TrendingUp } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { MissingProfileSetup } from "@/components/MissingProfileSetup";
import { ProgramCard } from "@/components/ProgramCard";
import { ProgramCategoryGrid } from "@/components/ProgramCategoryGrid";
import { MyProgramsSection } from "@/components/MyProgramsSection";
import { ProgressBar } from "@/components/ProgressBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { loadBulkProgramProgress } from "@/lib/program-module-progress";
import { programProgressStatus } from "@/lib/program-progress";
import {
  mapProgramRows,
  PROGRAM_WITH_TAGS_SELECT,
  type ProgramQueryRow,
} from "@/lib/program-tags";
import { countProgramsByTag, loadUserHighlightIds, loadUserHighlights } from "@/lib/user-highlights";

export default async function DashboardPage() {
  const auth = await getAuthContext();
  if (auth.kind === "unauthenticated") redirect("/login");
  if (auth.kind === "missing_tables") return <DatabaseSetup />;
  if (auth.kind === "missing_profile") return <MissingProfileSetup userId={auth.userId} />;

  const profile = auth.profile;
  const supabase = await createSupabaseServerClient();

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select(PROGRAM_WITH_TAGS_SELECT)
    .eq("status", "published")
    .order("title");

  if (isMissingTrainingLmsTables(programsError)) return <DatabaseSetup />;
  if (programsError) throw programsError;

  const programList = mapProgramRows(programs as ProgramQueryRow[]);
  const withProgress = await loadBulkProgramProgress(supabase, profile.id, programList);
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
  const myPrograms = await loadUserHighlights(supabase, profile.id, progressByProgramId);
  const { programIds: highlightedProgramIds } = await loadUserHighlightIds(supabase, profile.id);
  const tagCounts = countProgramsByTag(programList);

  const enrolledPrograms = withProgress.filter((item) => item.pct !== null);
  const inProgress = enrolledPrograms.filter((item) => programProgressStatus(item.pct!) === "in_progress");
  const completed = enrolledPrograms.filter((item) => programProgressStatus(item.pct!) === "completed");
  const totalProgress =
    enrolledPrograms.length === 0
      ? null
      : Math.round(enrolledPrograms.reduce((sum, item) => sum + item.pct!, 0) / enrolledPrograms.length);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">My Dashboard</h1>
        </div>
        <p className="text-lg text-muted-foreground">Track your training progress across published programs.</p>
      </div>

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

      <section>
        <div className="mb-6 flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Programs</h2>
        </div>
        <ProgramCategoryGrid programCounts={tagCounts} />
      </section>
    </div>
  );
}
