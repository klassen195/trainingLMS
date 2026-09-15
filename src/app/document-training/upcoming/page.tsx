import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { getProfileCapabilities, requireCapability } from "@/lib/capability-access";
import { listUpcomingTrainings } from "@/app/document-training/upcoming/actions";
import { TrainingSectionNav } from "@/components/TrainingSectionNav";
import { UpcomingTrainingTable } from "@/components/UpcomingTrainingTable";
import { Button } from "@/components/ui/Button";
import { isMissingUpcomingTrainingTables } from "@/lib/supabase/errors";

export default async function UpcomingTrainingPage() {
  const profile = await requireCapability("document_training");
  const caps = await getProfileCapabilities(profile);
  const canManage = caps.manage_upcoming_training;

  let rows: Awaited<ReturnType<typeof listUpcomingTrainings>> = [];
  let loadError: string | null = null;

  try {
    rows = await listUpcomingTrainings({ includeNonOpen: canManage });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load upcoming training.";
    if (err && typeof err === "object" && "code" in err && isMissingUpcomingTrainingTables(err as never)) {
      loadError =
        "Database not set up yet. Run supabase/migrations/20260915120000_upcoming_training_requests.sql, then refresh.";
    }
  }

  return (
    <div className="container mx-auto px-4 py-5">
      <TrainingSectionNav pathname="/document-training/upcoming" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Upcoming Training</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            External courses and conferences open for attendance requests.
          </p>
        </div>
        {canManage ? (
          <Button asChild size="sm">
            <Link href="/document-training/upcoming/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Advertise training
            </Link>
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </div>
      ) : (
        <UpcomingTrainingTable
          rows={canManage ? rows : rows.filter((row) => row.status === "open")}
          showStatus={canManage}
          emptyMessage={
            canManage
              ? "No upcoming training yet. Advertise the first opportunity."
              : "No open training opportunities right now."
          }
        />
      )}
    </div>
  );
}
