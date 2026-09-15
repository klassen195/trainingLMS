import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import {
  listMyTrainingAttendanceRequests,
  listTrainingAttendanceRequestsWaitingOnMe,
} from "@/app/document-training/requests/actions";
import { TrainingAttendanceRequestsTable } from "@/components/TrainingAttendanceRequestsTable";
import { TrainingSectionNav } from "@/components/TrainingSectionNav";
import { Button } from "@/components/ui/Button";
import { isMissingUpcomingTrainingTables } from "@/lib/supabase/errors";

export default async function TrainingRequestsPage() {
  await requireCapability("document_training");

  let mine: Awaited<ReturnType<typeof listMyTrainingAttendanceRequests>> = [];
  let waiting: Awaited<ReturnType<typeof listTrainingAttendanceRequestsWaitingOnMe>> = [];
  let loadError: string | null = null;

  try {
    [mine, waiting] = await Promise.all([
      listMyTrainingAttendanceRequests(),
      listTrainingAttendanceRequestsWaitingOnMe(),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load requests.";
    if (isMissingUpcomingTrainingTables(err as never)) {
      loadError =
        "Database not set up yet. Run supabase/migrations/20260915120000_upcoming_training_requests.sql, then refresh.";
    }
  }

  return (
    <div className="container mx-auto px-4 py-5">
      <TrainingSectionNav pathname="/document-training/requests" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Training Requests</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Apply to listed opportunities or request unlisted external training.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/document-training/requests/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Request unlisted training
          </Link>
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Waiting on me</h2>
            <TrainingAttendanceRequestsTable
              rows={waiting}
              showApplicant
              emptyMessage="No training requests waiting on you."
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">My requests</h2>
            <TrainingAttendanceRequestsTable
              rows={mine}
              emptyMessage="You have not submitted any training attendance requests."
            />
          </section>
        </div>
      )}
    </div>
  );
}
