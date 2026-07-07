import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import type { EmsQiAnswers, EmsQiReview } from "@/lib/ems-qi-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

export default async function EmsQiPage() {
  await requireRole(["instructor", "admin"]);
  const supabase = await createSupabaseServerClient();

  const { data: reviews, error } = await supabase
    .from("ems_qi_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error && isMissingTrainingLmsTables(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <DatabaseSetup />
      </div>
    );
  }

  if (error) throw error;

  const reviewList = (reviews ?? []) as EmsQiReview[];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">EMS Call QA/QI</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Review EMS calls, score checklist items, and copy a summary into your charting or QA program.
          </p>
        </div>
        <Button asChild>
          <Link href="/ems-qi/new">
            <Plus className="mr-2 h-4 w-4" />
            New review
          </Link>
        </Button>
      </div>

      {reviewList.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No reviews yet</CardTitle>
            <CardDescription>Start a new EMS call review to capture answers and generate an export summary.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/ems-qi/new">Create first review</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviewList.map((review) => {
            const answers = review.answers as EmsQiAnswers;
            const leadProvider = answers.lead_provider?.trim() || answers.crew?.trim();

            return (
            <Link
              key={review.id}
              href={`/ems-qi/${review.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {review.call_number ? `Call ${review.call_number}` : "EMS Call Review"}
                    {leadProvider ? ` · ${leadProvider}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Call date: {formatDate(review.call_date)} · Saved {new Date(review.created_at).toLocaleString()}
                  </p>
                </div>
                {review.max_score != null ? (
                  <div className="rounded-md border px-3 py-1 text-sm font-medium">
                    {review.total_score}/{review.max_score}
                  </div>
                ) : null}
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
