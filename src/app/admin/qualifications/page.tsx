import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingQualificationsTable } from "@/lib/supabase/errors";
import {
  QUALIFICATION_SELECT,
  type Qualification,
} from "@/lib/qualifications-types";
import { QualificationsAdmin } from "@/components/QualificationsAdmin";
import { Button } from "@/components/ui/Button";

export default async function AdminQualificationsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("qualifications")
    .select(QUALIFICATION_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (isMissingQualificationsTable(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Qualifications</h1>
        <p className="text-muted-foreground">
          Database not set up yet. Run{" "}
          <code className="rounded bg-muted px-1">
            supabase/migrations/20260809041352_qualifications.sql
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
            <BadgeCheck className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Qualifications</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage qualifications that training can grant and that appear on personnel files.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <QualificationsAdmin qualifications={(data ?? []) as Qualification[]} />
    </div>
  );
}
