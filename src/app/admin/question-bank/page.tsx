import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { loadQuestionBank } from "@/lib/quiz-data";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { Button } from "@/components/ui/Button";
import { QuestionBankManager } from "./ui";

export default async function QuestionBankPage() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  let questions;
  try {
    questions = await loadQuestionBank(supabase);
  } catch (error) {
    if (isMissingTrainingLmsTables(error as Parameters<typeof isMissingTrainingLmsTables>[0])) {
      return <DatabaseSetup />;
    }
    throw error;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Question Bank</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Build reusable questions for module quizzes. Each quiz draws a random subset so attempts stay fresh.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <QuestionBankManager questions={questions} />
    </div>
  );
}
