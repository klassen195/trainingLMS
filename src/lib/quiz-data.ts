import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  QuestionBankItemWithOptions,
  QuizAttempt,
  QuizQuestionForAttempt,
  QuizSettings,
} from "@/lib/training-lms-types";

export async function loadQuestionBank(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<QuestionBankItemWithOptions[]> {
  const { data: questions } = await supabase
    .from("question_bank_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (!questions?.length) return [];

  const questionIds = questions.map((q) => q.id);
  const { data: options } = await supabase
    .from("question_bank_options")
    .select("*")
    .in("question_id", questionIds)
    .order("sort_order");

  const optionsByQuestion = new Map<string, QuestionBankItemWithOptions["options"]>();
  for (const option of options ?? []) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push(option);
    optionsByQuestion.set(option.question_id, list);
  }

  return questions.map((question) => ({
    ...question,
    options: optionsByQuestion.get(question.id) ?? [],
  })) as QuestionBankItemWithOptions[];
}

export async function loadQuizConfig(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resourceId: string
) {
  const { data: settings } = await supabase
    .from("quiz_settings")
    .select("*")
    .eq("resource_id", resourceId)
    .maybeSingle();

  const { data: poolRows } = await supabase
    .from("quiz_pool_questions")
    .select("question_id")
    .eq("resource_id", resourceId);

  return {
    settings: (settings ?? null) as QuizSettings | null,
    poolQuestionIds: (poolRows ?? []).map((row) => row.question_id),
  };
}

export async function loadActiveQuizAttempt(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resourceId: string,
  userId: string
) {
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("resource_id", resourceId)
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (attempt ?? null) as QuizAttempt | null;
}

export async function loadLatestQuizAttempt(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resourceId: string,
  userId: string
) {
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("resource_id", resourceId)
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (attempt ?? null) as QuizAttempt | null;
}

export async function loadQuizAttemptQuestions(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  attemptId: string
): Promise<QuizQuestionForAttempt[]> {
  const { data: attemptQuestions } = await supabase
    .from("quiz_attempt_questions")
    .select("question_id, sort_order")
    .eq("attempt_id", attemptId)
    .order("sort_order");

  if (!attemptQuestions?.length) return [];

  const questionIds = attemptQuestions.map((row) => row.question_id);
  const { data: questions } = await supabase
    .from("question_bank_items")
    .select("id, prompt")
    .in("id", questionIds);

  const { data: options } = await supabase
    .from("question_bank_options")
    .select("id, question_id, option_text, sort_order")
    .in("question_id", questionIds)
    .order("sort_order");

  const questionMap = new Map((questions ?? []).map((q) => [q.id, q.prompt]));
  const optionsByQuestion = new Map<string, { id: string; option_text: string }[]>();
  for (const option of options ?? []) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push({ id: option.id, option_text: option.option_text });
    optionsByQuestion.set(option.question_id, list);
  }

  return attemptQuestions
    .map((row) => ({
      id: row.question_id,
      prompt: questionMap.get(row.question_id) ?? "",
      options: optionsByQuestion.get(row.question_id) ?? [],
    }))
    .filter((q) => q.prompt);
}

export async function loadQuizSettingsSummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resourceId: string
) {
  const { data: settings } = await supabase
    .from("quiz_settings")
    .select("questions_per_attempt, pass_percent")
    .eq("resource_id", resourceId)
    .maybeSingle();

  const { count } = await supabase
    .from("quiz_pool_questions")
    .select("question_id", { count: "exact", head: true })
    .eq("resource_id", resourceId);

  return {
    questionsPerAttempt: settings?.questions_per_attempt ?? 5,
    passPercent: settings?.pass_percent ?? 80,
    poolSize: count ?? 0,
  };
}
