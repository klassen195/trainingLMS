import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Pencil, PlayCircle } from "lucide-react";
import { isAdmin, requireUserProfile } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { programModulesFromRows } from "@/lib/program-modules";
import { loadProgramModuleProgress } from "@/lib/program-module-progress";
import { loadUserHighlightIds } from "@/lib/user-highlights";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { ProgramBreadcrumb } from "@/components/ProgramBreadcrumb";
import { ProgramEnrollmentPanel } from "@/components/ProgramEnrollmentPanel";
import { ProgramUnenrollmentPanel } from "@/components/ProgramUnenrollmentPanel";
import { ProgramModuleList } from "@/components/ProgramModuleList";
import { HighlightStarButton } from "@/components/HighlightStarButton";
import { ProgressBar } from "@/components/ProgressBar";
import { programEnrollmentLabel, programEnrollmentSummary } from "@/lib/program-enrollment-status";
import { tagLabel } from "@/lib/labels";
import {
  mapProgramRow,
  PROGRAM_WITH_TAGS_SELECT,
  type ProgramQueryRow,
} from "@/lib/program-tags";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUserProfile();
  const caps = await getProfileCapabilities(profile);
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: program, error } = await supabase
    .from("programs")
    .select(PROGRAM_WITH_TAGS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;
  if (!program) notFound();

  const { data: programModuleRows } = await supabase
    .from("program_modules")
    .select("sort_order, modules(*)")
    .eq("program_id", id)
    .order("sort_order");

  const modules = programModulesFromRows(programModuleRows);
  const typedProgram = mapProgramRow(program as ProgramQueryRow);
  const canOpenModules =
    typedProgram.status === "published" ||
    typedProgram.created_by === profile.id ||
    isAdmin(profile);
  const canEdit =
    isAdmin(profile) ||
    (caps.author_training && typedProgram.created_by === profile.id);
  const showSelfEnroll = canOpenModules && caps.self_enroll;

  const moduleIds = modules.map((m) => m.id);
  const moduleProgress = await loadProgramModuleProgress(supabase, profile.id, moduleIds);
  const { programIds: highlightedProgramIds, moduleIds: highlightedModuleIds } =
    await loadUserHighlightIds(supabase, profile.id);
  const overallProgress = moduleProgress.progressPercent;
  const enrollmentStatus = programEnrollmentLabel(moduleProgress.enrolledCount, modules.length);
  const firstModule = modules[0];

  return (
    <>
      <ProgramBreadcrumb programId={id} programTitle={typedProgram.title} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {typedProgram.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tagLabel(tag)}
                </Badge>
              ))}
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
              {enrollmentStatus === "not_enrolled" ? (
                <p className="font-medium">{programEnrollmentSummary(0, modules.length)}</p>
              ) : (
                <>
                  <p className="font-medium">{overallProgress}%</p>
                  {enrollmentStatus === "partially_enrolled" ? (
                    <p className="text-xs text-muted-foreground">
                      {programEnrollmentSummary(moduleProgress.enrolledCount, modules.length)}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        {overallProgress !== null && overallProgress > 0 ? (
          <div className="mb-8">
            <ProgressBar value={overallProgress} showLabel />
          </div>
        ) : null}

        {showSelfEnroll ? (
          <>
            <ProgramEnrollmentPanel
              programId={id}
              moduleCount={modules.length}
              enrolledCount={moduleProgress.enrolledCount}
            />
            <ProgramUnenrollmentPanel
              programId={id}
              moduleCount={modules.length}
              enrolledCount={moduleProgress.enrolledCount}
            />
          </>
        ) : !caps.self_enroll && moduleProgress.enrolledCount === 0 ? (
          <div className="mb-8 rounded-lg border p-4 text-sm text-muted-foreground">
            Your permission level cannot self-enroll. Contact an instructor or admin if you need to be enrolled.
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
