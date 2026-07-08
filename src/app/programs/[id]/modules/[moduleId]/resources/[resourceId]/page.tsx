import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { getModulePageContext } from "@/lib/module-page-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadActiveQuizAttempt,
  loadLatestQuizAttempt,
  loadQuizAttemptQuestions,
  loadQuizSettingsSummary,
} from "@/lib/quiz-data";
import { ModulePageNav } from "@/components/ModulePageNav";
import { ModuleResourceDisplay } from "@/components/ModuleResourceDisplay";
import { MarkResourceCompleteButton } from "@/components/MarkResourceCompleteButton";
import { QuizTaker } from "@/components/QuizTaker";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default async function ModuleResourcePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string; resourceId: string }>;
}) {
  const profile = await requireUserProfile();
  const { id, moduleId, resourceId } = await params;
  const ctx = await getModulePageContext(id, moduleId, profile);

  const resource = ctx.resourcesWithUrls.find((item) => item.id === resourceId);
  if (!resource) notFound();
  if (resource.resource_type === "checklist") {
    redirect(`/programs/${id}/modules/${moduleId}`);
  }

  const isQuiz = resource.resource_type === "quiz";
  const supabase = await createSupabaseServerClient();

  const [settings, activeAttempt, latestAttempt] = isQuiz
    ? await Promise.all([
        loadQuizSettingsSummary(supabase, resourceId),
        loadActiveQuizAttempt(supabase, resourceId, profile.id),
        loadLatestQuizAttempt(supabase, resourceId, profile.id),
      ])
    : [null, null, null];

  const quizQuestions =
    isQuiz && activeAttempt
      ? await loadQuizAttemptQuestions(supabase, activeAttempt.id)
      : [];

  return (
    <>
      <ModulePageNav
        programId={id}
        prevModuleId={ctx.prevModuleId}
        nextModuleId={ctx.nextModuleId}
        className="mb-6"
      />

      <Card>
        <CardContent className="space-y-6 pt-6">
          {ctx.canEdit ? (
            <div className="flex justify-end gap-2">
              {isQuiz && profile.role === "admin" ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/quizzes/${resourceId}/edit`}>Configure quiz</Link>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/instructor/programs/${id}/modules/${moduleId}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit module
                </Link>
              </Button>
            </div>
          ) : null}

          {isQuiz && settings ? (
            <QuizTaker
              programId={id}
              moduleId={moduleId}
              resourceId={resourceId}
              resourceTitle={resource.title}
              enrolled={ctx.enrolled}
              settings={settings}
              activeAttempt={activeAttempt}
              latestAttempt={latestAttempt}
              questions={quizQuestions}
            />
          ) : (
            <>
              <ModuleResourceDisplay resource={resource} />
              <MarkResourceCompleteButton
                programId={id}
                moduleId={moduleId}
                resourceId={resourceId}
                enrolled={ctx.enrolled}
                completed={ctx.completedResourceIds.includes(resourceId)}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ModulePageNav
        programId={id}
        prevModuleId={ctx.prevModuleId}
        nextModuleId={ctx.nextModuleId}
        className="mt-6"
      />
    </>
  );
}
