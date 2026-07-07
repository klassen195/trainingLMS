import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import type { EmsQiAnswers, EmsQiReview } from "@/lib/ems-qi-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DeleteEmsQiReviewButton } from "@/components/DeleteEmsQiReviewButton";
import { EmsQiReviewForm } from "@/components/EmsQiReviewForm";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { Button } from "@/components/ui/Button";

export default async function EmsQiReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["instructor", "admin"]);
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: review, error } = await supabase.from("ems_qi_reviews").select("*").eq("id", id).maybeSingle();

  if (error && isMissingTrainingLmsTables(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <DatabaseSetup />
      </div>
    );
  }

  if (error) throw error;
  if (!review) notFound();

  const item = review as EmsQiReview;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" asChild className="mb-4 px-0 hover:bg-transparent">
            <Link href="/ems-qi">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to reviews
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">
            {item.call_number ? `Call ${item.call_number}` : "EMS Call Review"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Last updated {new Date(item.updated_at).toLocaleString()}
          </p>
        </div>
        <DeleteEmsQiReviewButton reviewId={item.id} />
      </div>

      <EmsQiReviewForm
        reviewId={item.id}
        initialAnswers={item.answers as EmsQiAnswers}
        initialSummary={item.summary_text}
      />
    </div>
  );
}
