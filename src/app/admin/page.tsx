import Link from "next/link";
import { HelpCircle, Shield } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Profile } from "@/lib/training-lms-types";
import { AdminUserManager } from "./ui";

export default async function AdminPage() {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at");
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Admin</h1>
        </div>
        <p className="text-lg text-muted-foreground">Manage users, question banks, and quiz configuration.</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="h-5 w-5" />
              Question bank
            </CardTitle>
            <CardDescription>Create and edit reusable quiz questions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/question-bank">Open question bank</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4">
        <h2 className="text-2xl font-bold">User profiles</h2>
        <p className="text-muted-foreground">Select a member to edit their name, rank, and role.</p>
      </div>

      <AdminUserManager users={(profiles ?? []) as Profile[]} />
    </div>
  );
}
