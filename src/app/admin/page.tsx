import { Shield } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import type { Profile } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
        <p className="text-lg text-muted-foreground">
          Manage users, locations, roles, and department checklists.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Locations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Manage stations and other sites for asset assignment.
            </p>
            <Button asChild>
              <Link href="/admin/locations">Manage locations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vehicle checks</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Edit Daily and Weekly apparatus checklist templates.
            </p>
            <Button asChild>
              <Link href="/admin/vehicle-checks">Manage templates</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Maintenance requests</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Review and resolve apparatus maintenance requests.
            </p>
            <Button asChild>
              <Link href="/admin/maintenance">Manage requests</Link>
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
