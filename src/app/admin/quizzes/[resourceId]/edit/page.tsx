import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { loadQuestionBank, loadQuizConfig } from "@/lib/quiz-data";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { QuizConfigEditor } from "./ui";

export default async function QuizConfigPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  await requireRole(["admin"]);
  const { resourceId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: resource, error } = await supabase
    .from("module_resources")
    .select("id, title, resource_type, module_id")
    .eq("id", resourceId)
    .maybeSingle();

  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;
  if (!resource || resource.resource_type !== "quiz") notFound();

  const [bankQuestions, quizConfig] = await Promise.all([
    loadQuestionBank(supabase, resourceId),
    loadQuizConfig(supabase, resourceId),
  ]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Configure quiz</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Manage this quiz&apos;s question bank and set attempt rules.
        </p>
      </div>

      <QuizConfigEditor
        resourceId={resourceId}
        resourceTitle={resource.title}
        questionsPerAttempt={quizConfig.settings?.questions_per_attempt ?? 5}
        passPercent={quizConfig.settings?.pass_percent ?? 80}
        bankQuestions={bankQuestions}
      />
    </div>
  );
}
