import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { loadApprovalBoardContext } from "@/app/approval-tracker/actions";
import { ApprovalTrackerBoard } from "@/components/ApprovalTrackerBoard";
import { Button } from "@/components/ui/Button";
import { isMissingApprovalTrackerTables } from "@/lib/supabase/errors";

export default async function ApprovalTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; committee?: string }>;
}) {
  await requireCapability("approval_tracker");
  const { archived, committee: committeeParam } = await searchParams;
  const showArchived = archived === "1";
  const committeeFilter =
    committeeParam === "admin" ||
    committeeParam === "operations" ||
    committeeParam === "logistics" ||
    committeeParam === "prevention"
      ? committeeParam
      : "all";

  let board: Awaited<ReturnType<typeof loadApprovalBoardContext>> | null = null;
  let loadError: string | null = null;

  try {
    board = await loadApprovalBoardContext();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load approval tracker.";
    loadError = message;
    if (err && typeof err === "object" && "code" in err) {
      if (isMissingApprovalTrackerTables(err as never)) {
        loadError =
          "Database not set up yet. Run supabase/migrations/20260820120000_approval_tracker.sql, then refresh.";
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Policy Tracker</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            See where policies, best practices, and training aids sit on the path to approval.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/approval-tracker/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New document
          </Link>
        </Button>
      </div>

      {loadError || !board ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError ?? "Failed to load board."}</p>
        </div>
      ) : (
        <ApprovalTrackerBoard
          documents={board.documents}
          currentUserId={board.profile.id}
          stageMemberIds={board.stageMemberIds}
          committeeMembers={board.committeeMembers}
          votes={board.votes}
          showArchived={showArchived}
          committeeFilter={committeeFilter}
        />
      )}
    </div>
  );
}
