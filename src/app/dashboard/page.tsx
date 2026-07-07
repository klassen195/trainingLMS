import { redirect } from "next/navigation";
import { Award, BookOpen, GraduationCap, LayoutDashboard, TrendingUp } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { MissingProfileSetup } from "@/components/MissingProfileSetup";
import { ProgramCard } from "@/components/ProgramCard";
import { ProgramCategoryFilters } from "@/components/ProgramCategoryFilters";
import { ProgressBar } from "@/components/ProgressBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { loadProgramModuleProgress } from "@/lib/program-module-progress";
import { programProgressStatus } from "@/lib/program-progress";
import { categoryLabel, programCategories } from "@/lib/labels";
import { groupProgramsByCategory } from "@/lib/program-catalog";
import type { Profile, Program, ProgramCategory } from "@/lib/training-lms-types";

type ProgramWithProgress = {
  program: Program;
  pct: number | null;
  moduleCount: number;
  enrolledCount: number;
};

async function loadProgramProgress(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, profile: Profile, programs: Program[]) {
  const results: ProgramWithProgress[] = [];

  for (const program of programs) {
    const { data: programModuleRows } = await supabase
      .from("program_modules")
      .select("module_id")
      .eq("program_id", program.id);

    const moduleIds = (programModuleRows ?? []).map((row) => row.module_id);
    const moduleProgress = await loadProgramModuleProgress(supabase, profile.id, moduleIds);

    results.push({
      program,
      pct: moduleProgress.progressPercent,
      moduleCount: moduleIds.length,
      enrolledCount: moduleProgress.enrolledCount,
    });
  }

  return results;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = params.category as ProgramCategory | undefined;
  const activeCategory = category && programCategories.includes(category) ? category : undefined;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError && isMissingTrainingLmsTables(profileError)) return <DatabaseSetup />;
  if (profileError) throw profileError;
  if (!profileRow) return <MissingProfileSetup userId={user.id} />;

  const profile = profileRow as Profile;

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("*")
    .eq("status", "published")
    .order("title");

  if (isMissingTrainingLmsTables(programsError)) return <DatabaseSetup />;
  if (programsError) throw programsError;

  const programList = (programs ?? []) as Program[];
  const withProgress = await loadProgramProgress(supabase, profile, programList);
  const progressByProgramId = new Map(withProgress.map((item) => [item.program.id, item]));
  const filteredPrograms = activeCategory
    ? programList.filter((program) => program.category === activeCategory)
    : programList;
  const catalogSections = groupProgramsByCategory(filteredPrograms);
  const filteredProgress = activeCategory
    ? withProgress.filter((item) => item.program.category === activeCategory)
    : withProgress;
  const enrolledPrograms = filteredProgress.filter((item) => item.pct !== null);
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

      <ProgramCategoryFilters basePath="/dashboard" activeCategory={activeCategory} />

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
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-6 flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Program Catalog</h2>
        </div>
        {catalogSections.length === 0 ? (
          <div className="rounded-lg border py-12 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {activeCategory ? "No programs in this category." : "No published programs yet. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {catalogSections.map(({ category, programs: categoryPrograms }) => (
              <div key={category}>
                <h3 className="mb-6 border-b pb-3 text-2xl font-bold">{categoryLabel(category)}</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {categoryPrograms.map((program) => {
                    const progress = progressByProgramId.get(program.id);
                    return (
                      <ProgramCard
                        key={program.id}
                        program={program}
                        progressPercent={progress?.pct ?? undefined}
                        enrolledCount={progress?.enrolledCount ?? 0}
                        moduleCount={progress?.moduleCount ?? 0}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
