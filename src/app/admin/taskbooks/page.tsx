import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { currentUserHasCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTaskbookTypes } from "@/lib/taskbooks";
import { TaskbooksAdmin } from "@/components/TaskbooksAdmin";
import { Button } from "@/components/ui/Button";

export default async function AdminTaskbooksPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const pdipEnabled = await currentUserHasCapability("access_pdip");
  const { rows, error } = await listTaskbookTypes(supabase, { withPrerequisites: true });

  if (
    error &&
    (error.code === "PGRST205" ||
      error.message.includes("taskbook_types") ||
      error.message.includes("Could not find the table"))
  ) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Taskbooks</h1>
        <p className="text-muted-foreground">
          Database not set up yet. Run{" "}
          <code className="rounded bg-muted px-1">
            supabase/migrations/20260921214821_taskbook_types_catalog.sql
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
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Taskbooks</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage which taskbooks are available, how they group, prerequisites, and PDIP credit.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <TaskbooksAdmin taskbooks={rows} pdipEnabled={pdipEnabled} />
    </div>
  );
}
