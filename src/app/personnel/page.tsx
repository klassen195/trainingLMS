import Link from "next/link";
import { ClipboardList, Plus, Users } from "lucide-react";
import { isAdmin } from "@/lib/auth";
import { requireCapability } from "@/lib/capability-access";
import { fetchPersonnelDirectory, viewerHasDirectReports } from "@/lib/personnel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
} from "@/lib/supabase/errors";
import { PersonnelDirectory } from "@/components/PersonnelDirectory";
import { PersonnelDatabaseSetup } from "@/components/PersonnelDatabaseSetup";
import { Button } from "@/components/ui/Button";

export default async function PersonnelPage() {
  const profile = await requireCapability("access_personnel");
  const admin = isAdmin(profile);

  const supabase = await createSupabaseServerClient();
  const [{ rows, error }, { hasReports }] = await Promise.all([
    fetchPersonnelDirectory(supabase),
    viewerHasDirectReports(supabase, profile),
  ]);

  if (isMissingTrainingLmsTables(error) || isMissingPersonnelTables(error)) {
    return <PersonnelDatabaseSetup />;
  }
  if (error) throw error;

  const { data: certRows } = await supabase
    .from("personnel_certifications")
    .select("profile_id, expires_on");

  const expiredCertCountByUser: Record<string, number> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const row of certRows ?? []) {
    if (!row.expires_on) continue;
    if (new Date(`${row.expires_on}T00:00:00`) < today) {
      expiredCertCountByUser[row.profile_id] =
        (expiredCertCountByUser[row.profile_id] ?? 0) + 1;
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Personnel</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Department directory, training assignments, certifications, and documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasReports ? (
            <Button asChild variant="outline">
              <Link href="/personnel/supervisor">
                <ClipboardList className="mr-2 h-4 w-4" />
                Supervisor dashboard
              </Link>
            </Button>
          ) : null}
          {admin ? (
            <Button asChild>
              <Link href="/personnel/new">
                <Plus className="mr-2 h-4 w-4" />
                Add member
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <PersonnelDirectory
        rows={rows}
        expiredCertCountByUser={expiredCertCountByUser}
        viewerId={profile.id}
        canOpenAllFiles={admin}
      />
    </div>
  );
}
