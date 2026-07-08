import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Pencil, PlayCircle } from "lucide-react";
import { hasRole, requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { programModulesFromRows } from "@/lib/program-modules";
import { loadProgramModuleProgress } from "@/lib/program-module-progress";
import { loadUserHighlightIds } from "@/lib/user-highlights";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { ProgramBreadcrumb } from "@/components/ProgramBreadcrumb";
import { ProgramModuleList } from "@/components/ProgramModuleList";
import { HighlightStarButton } from "@/components/HighlightStarButton";
import { ProgressBar } from "@/components/ProgressBar";
import { categoryLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Program } from "@/lib/training-lms-types";

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUserProfile();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: program, error } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;
  if (!program) notFound();

  const { data: programModuleRows } = await supabase
    .from("program_modules")
    .select("sort_order, modules(*)")
    .eq("program_id", id)
    .order("sort_order");

  const modules = programModulesFromRows(programModuleRows);
  const typedProgram = program as Program;
  const canOpenModules =
    typedProgram.status === "published" || typedProgram.created_by === profile.id || profile.role === "admin";
  const canEdit =
    hasRole(profile, ["admin"]) ||
    (hasRole(profile, ["instructor"]) && typedProgram.created_by === profile.id);

  const moduleIds = modules.map((m) => m.id);
  const moduleProgress = await loadProgramModuleProgress(supabase, profile.id, moduleIds);
  const { programIds: highlightedProgramIds, moduleIds: highlightedModuleIds } =
    await loadUserHighlightIds(supabase, profile.id);
  const overallProgress = moduleProgress.progressPercent;
  const firstModule = modules[0];

  return (
    <>
      <ProgramBreadcrumb programId={id} programTitle={typedProgram.title} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{categoryLabel(typedProgram.category)}</Badge>
              <Badge variant="secondary" className="capitalize">
                {typedProgram.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <HighlightStarButton
                target="program"
                programId={id}
                highlighted={highlightedProgramIds.has(id)}
                label={typedProgram.title}
              />
              {canEdit ? (
                <Button variant="outline" asChild>
                  <Link href={`/instructor/programs/${id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit program
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          <h1 className="mb-4 text-4xl font-bold">{typedProgram.title}</h1>
          {typedProgram.description ? (
            <p className="text-lg text-muted-foreground">{typedProgram.description}</p>
          ) : null}
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Modules</p>
              <p className="font-medium">{modules.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <PlayCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Your progress</p>
              <p className="font-medium">
                {overallProgress === null ? "Not enrolled" : `${overallProgress}%`}
              </p>
            </div>
          </div>
        </div>

        {overallProgress !== null && overallProgress > 0 ? (
          <div className="mb-8">
            <ProgressBar value={overallProgress} showLabel />
          </div>
        ) : null}

        {firstModule && canOpenModules && overallProgress === 0 ? (
          <div className="mb-8">
            <Button size="lg" asChild>
              <Link href={`/programs/${id}/modules/${firstModule.id}`}>
                <PlayCircle className="mr-2 h-5 w-5" />
                Start program
              </Link>
            </Button>
          </div>
        ) : null}

        <section>
          <h2 className="mb-4 text-2xl font-bold">Program modules</h2>
          <ProgramModuleList
            programId={id}
            modules={modules}
            enrolledModuleIds={moduleProgress.enrolledModuleIds}
            completedModuleIds={moduleProgress.completedModuleIds}
            highlightedModuleIds={highlightedModuleIds}
            canOpen={canOpenModules}
          />
        </section>
      </div>
    </>
  );
}
