import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { loadApprovalStageMembersAdmin } from "@/app/admin/approval-tracker/actions";
import { ApprovalStageMembersAdmin } from "@/components/ApprovalStageMembersAdmin";
import { Button } from "@/components/ui/Button";
import { isMissingApprovalTrackerTables } from "@/lib/supabase/errors";

export default async function AdminApprovalTrackerPage() {
  await requireAdmin();

  let data: Awaited<ReturnType<typeof loadApprovalStageMembersAdmin>> | null = null;
  let loadError: string | null = null;

  try {
    data = await loadApprovalStageMembersAdmin();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load stage members.";
    if (err && typeof err === "object" && "code" in err && isMissingApprovalTrackerTables(err as never)) {
      loadError =
        "Database not set up yet. Run supabase/migrations/20260820120000_approval_tracker.sql, then refresh.";
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ListChecks className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Policy Tracker</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Assign the Assistant Chief of Special Projects, each committee and chair, the policy
            holder group, and Fire Chief. People still need the Policy Tracker capability under
            Permissions to open the board.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      {loadError || !data ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError ?? "Failed to load."}</p>
        </div>
      ) : (
        <ApprovalStageMembersAdmin
          profiles={data.profiles}
          members={data.members}
          committeeMembers={data.committeeMembers}
        />
      )}
    </div>
  );
}
