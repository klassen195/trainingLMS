import Link from "next/link";
import { Cross } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingEmsLevelsTable } from "@/lib/supabase/errors";
import { EMS_LEVEL_SELECT, type EmsLevel } from "@/lib/ems-levels-types";
import { EmsLevelsAdmin } from "@/components/EmsLevelsAdmin";
import { Button } from "@/components/ui/Button";

export default async function AdminEmsLevelsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("ems_levels")
    .select(EMS_LEVEL_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (isMissingEmsLevelsTable(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">EMS levels</h1>
        <p className="text-muted-foreground">
          Database not set up yet. Run{" "}
          <code className="rounded bg-muted px-1">
            supabase/migrations/20260809051429_ems_levels.sql
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
            <Cross className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">EMS levels</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage EMS license levels that can be recorded as licenses held on personnel files.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <EmsLevelsAdmin levels={(data ?? []) as EmsLevel[]} />
    </div>
  );
}
