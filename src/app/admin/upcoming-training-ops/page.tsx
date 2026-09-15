import Link from "next/link";
import { Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  listAdminUpcomingTrainingProfiles,
  listUpcomingTrainingOpsMembers,
} from "@/app/document-training/upcoming/actions";
import { UpcomingTrainingOpsMembersAdmin } from "@/components/UpcomingTrainingOpsMembersAdmin";
import { Button } from "@/components/ui/Button";
import { isMissingUpcomingTrainingTables } from "@/lib/supabase/errors";
import type { ApprovalProfileOption } from "@/lib/approval-tracker-types";

export default async function AdminUpcomingTrainingOpsPage() {
  await requireAdmin();

  let profiles: ApprovalProfileOption[] = [];
  let members: Awaited<ReturnType<typeof listUpcomingTrainingOpsMembers>> = [];
  let loadError: string | null = null;

  try {
    const [profileRows, memberRows] = await Promise.all([
      listAdminUpcomingTrainingProfiles(),
      listUpcomingTrainingOpsMembers(),
    ]);
    profiles = profileRows as unknown as ApprovalProfileOption[];
    members = memberRows;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load Ops Team.";
    if (isMissingUpcomingTrainingTables(err as never)) {
      loadError =
        "Database not set up yet. Run supabase/migrations/20260915120000_upcoming_training_requests.sql, then refresh.";
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Upcoming training Ops</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Assign Ops Team members who approve the final step of training attendance
            requests. People who advertise opportunities also need the Manage upcoming
            training capability under Permissions.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </div>
      ) : (
        <UpcomingTrainingOpsMembersAdmin profiles={profiles} members={members} />
      )}
    </div>
  );
}
