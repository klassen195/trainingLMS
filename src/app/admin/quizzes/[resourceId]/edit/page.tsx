import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { loadQuestionBank, loadQuizConfig } from "@/lib/quiz-data";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { Button } from "@/components/ui/Button";
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
    loadQuestionBank(supabase),
    loadQuizConfig(supabase, resourceId),
  ]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Configure quiz</h1>
          </div>
          <p className="text-lg text-muted-foreground">Select questions from the bank and set attempt rules.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/question-bank">Question bank</Link>
          </Button>
        </div>
      </div>

      <QuizConfigEditor
        resourceId={resourceId}
        resourceTitle={resource.title}
        questionsPerAttempt={quizConfig.settings?.questions_per_attempt ?? 5}
        passPercent={quizConfig.settings?.pass_percent ?? 80}
        poolQuestionIds={quizConfig.poolQuestionIds}
        bankQuestions={bankQuestions}
      />
    </div>
  );
}
