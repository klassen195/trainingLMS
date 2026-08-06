import Link from "next/link";
import { Tags } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingCategoriesTable } from "@/lib/supabase/errors";
import {
  TRAINING_CATEGORY_SELECT,
  type TrainingCategory,
} from "@/lib/training-categories-types";
import { TrainingCategoriesAdmin } from "@/components/TrainingCategoriesAdmin";
import { Button } from "@/components/ui/Button";

export default async function AdminTrainingCategoriesPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("training_categories")
    .select(TRAINING_CATEGORY_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (isMissingTrainingCategoriesTable(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Training categories</h1>
        <p className="text-muted-foreground">
          Database not set up yet. Run{" "}
          <code className="rounded bg-muted px-1">
            supabase/migrations/20260804130000_training_categories.sql
          </code>
          , then refresh this page.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    );
  }
  if (error) throw error;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Tags className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Training categories</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage categories used when logging Document Training sessions.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <TrainingCategoriesAdmin categories={(data ?? []) as TrainingCategory[]} />
    </div>
  );
}
