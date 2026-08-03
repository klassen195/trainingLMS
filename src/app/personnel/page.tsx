import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { requireUserProfile, isAdmin } from "@/lib/auth";
import { fetchPersonnelDirectory } from "@/lib/personnel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
} from "@/lib/supabase/errors";
import { PersonnelDirectory } from "@/components/PersonnelDirectory";
import { PersonnelDatabaseSetup } from "@/components/PersonnelDatabaseSetup";
import { Button } from "@/components/ui/Button";

export default async function PersonnelPage() {
  const profile = await requireUserProfile();
  if (!isAdmin(profile)) {
    redirect(`/personnel/${profile.id}`);
  }

  const supabase = await createSupabaseServerClient();
  const { rows, error } = await fetchPersonnelDirectory(supabase);

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
        <Button asChild>
          <Link href="/personnel/new">
            <Plus className="mr-2 h-4 w-4" />
            Invite member
          </Link>
        </Button>
      </div>

      <PersonnelDirectory rows={rows} expiredCertCountByUser={expiredCertCountByUser} />
    </div>
  );
}
