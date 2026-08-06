import Link from "next/link";
import { ClipboardPen, Plus } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { listTrainingSessions } from "@/app/document-training/actions";
import { TrainingSessionsTable } from "@/components/TrainingSessionsTable";
import { Button } from "@/components/ui/Button";

export default async function DocumentTrainingPage() {
  await requireCapability("document_training");

  let sessions: Awaited<ReturnType<typeof listTrainingSessions>> = [];
  let loadError: string | null = null;

  try {
    sessions = await listTrainingSessions();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load training sessions.";
  }

  return (
    <div className="container mx-auto px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ClipboardPen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Document Training</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Record and track completed training sessions.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/document-training/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Log training
          </Link>
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </div>
      ) : (
        <TrainingSessionsTable
          rows={sessions}
          emptyMessage="No training logged yet. Log the first session."
        />
      )}
    </div>
  );
}
