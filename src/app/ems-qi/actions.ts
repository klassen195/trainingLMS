"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { buildEmsQiSummary, calculateEmsQiScores, extractCallMetadata } from "@/lib/ems-qi-summary";
import type { EmsQiAnswers } from "@/lib/ems-qi-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables, supabaseErrorMessage } from "@/lib/supabase/errors";

function throwIfDbError(error: import("@supabase/supabase-js").PostgrestError | null) {
  if (!error) return;
  if (isMissingTrainingLmsTables(error)) {
    throw new Error("Database not set up yet. Run the EMS QI migration in Supabase.");
  }
  throw new Error(supabaseErrorMessage(error));
}

export async function saveEmsQiReview(input: {
  id?: string;
  answers: EmsQiAnswers;
  summaryText: string;
}) {
  const profile = await requireRole(["instructor", "admin"]);
  const supabase = await createSupabaseServerClient();

  const { callDate, callNumber } = extractCallMetadata(input.answers);
  const { totalScore, maxScore } = calculateEmsQiScores(input.answers);
  const summaryText = input.summaryText.trim() || buildEmsQiSummary(input.answers);

  const payload = {
    reviewer_id: profile.id,
    call_date: callDate,
    call_number: callNumber,
    unit: null,
    answers: input.answers,
    summary_text: summaryText,
    total_score: maxScore > 0 ? totalScore : null,
    max_score: maxScore > 0 ? maxScore : null,
  };

  if (input.id) {
    const { error } = await supabase.from("ems_qi_reviews").update(payload).eq("id", input.id);
    throwIfDbError(error);
    revalidatePath("/ems-qi");
    revalidatePath(`/ems-qi/${input.id}`);
    return { id: input.id };
  }

  const { data, error } = await supabase.from("ems_qi_reviews").insert(payload).select("id").single();
  throwIfDbError(error);
  if (!data) throw new Error("Could not save review.");
  revalidatePath("/ems-qi");
  redirect(`/ems-qi/${data.id}`);
}

export async function deleteEmsQiReview(reviewId: string) {
  await requireRole(["instructor", "admin"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ems_qi_reviews").delete().eq("id", reviewId);
  throwIfDbError(error);
  revalidatePath("/ems-qi");
  redirect("/ems-qi");
}
