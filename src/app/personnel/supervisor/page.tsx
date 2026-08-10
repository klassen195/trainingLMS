import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { fetchSupervisorCrew } from "@/lib/personnel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
} from "@/lib/supabase/errors";
import { PersonnelDatabaseSetup } from "@/components/PersonnelDatabaseSetup";
import { SupervisorDashboard } from "@/components/SupervisorDashboard";
import { Button } from "@/components/ui/Button";

export default async function SupervisorDashboardPage() {
  const viewer = await requireUserProfile();
  const supabase = await createSupabaseServerClient();
  const { rows, taskbooksByProfile, qualificationsByProfile, error } = await fetchSupervisorCrew(
    supabase,
    viewer
  );

  if (isMissingTrainingLmsTables(error) || isMissingPersonnelTables(error)) {
    return <PersonnelDatabaseSetup />;
  }
  if (error) throw error;

  if (rows.length === 0) {
    redirect("/personnel");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Supervisor dashboard</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Station, EMS, rank, swing-up, upcoming dates, qualifications, and open taskbooks for
            your crew. Captains see assigned personnel; Battalion Chiefs see everyone on their
            shift.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/personnel">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to directory
          </Link>
        </Button>
      </div>

      <SupervisorDashboard
        rows={rows}
        taskbooksByProfile={taskbooksByProfile}
        qualificationsByProfile={qualificationsByProfile}
      />
    </div>
  );
}
