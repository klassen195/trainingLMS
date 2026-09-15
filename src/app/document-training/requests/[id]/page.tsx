import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTrainingAttendanceRequest,
  viewerCanDecideTrainingRequest,
} from "@/app/document-training/requests/actions";
import { requireCapability } from "@/lib/capability-access";
import { isAdmin } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/dates";
import { personnelDisplayName } from "@/lib/personnel-types";
import {
  formatEstimatedCost,
  isTrainingAttendancePending,
  trainingAttendanceStageLabel,
} from "@/lib/upcoming-training-types";
import { TrainingAttendanceRequestActions } from "@/components/TrainingAttendanceRequestActions";
import { TrainingSectionNav } from "@/components/TrainingSectionNav";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { isMissingUpcomingTrainingTables } from "@/lib/supabase/errors";

export default async function TrainingRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireCapability("document_training");

  let request: Awaited<ReturnType<typeof getTrainingAttendanceRequest>> | null = null;
  let loadError: string | null = null;

  try {
    request = await getTrainingAttendanceRequest(id);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) notFound();
    loadError = err instanceof Error ? err.message : "Failed to load request.";
    if (isMissingUpcomingTrainingTables(err as never)) {
      loadError =
        "Database not set up yet. Run supabase/migrations/20260915120000_upcoming_training_requests.sql, then refresh.";
    }
  }

  if (loadError || !request) {
    return (
      <div className="container mx-auto px-4 py-5">
        <TrainingSectionNav pathname="/document-training/requests" />
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError ?? "Not found."}</p>
        </div>
      </div>
    );
  }

  const canDecide = await viewerCanDecideTrainingRequest(profile, request);
  const canWithdraw =
    isTrainingAttendancePending(request.current_stage) &&
    (request.applicant_id === profile.id || isAdmin(profile));

  return (
    <div className="container mx-auto max-w-3xl px-4 py-5">
      <TrainingSectionNav pathname="/document-training/requests" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{request.title}</h1>
            <Badge>{trainingAttendanceStageLabel(request.current_stage)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {request.upcoming_training_id ? "Listed opportunity" : "Unlisted request"}
            {request.applicant
              ? ` · ${personnelDisplayName(request.applicant)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/document-training/requests">Back</Link>
          </Button>
          {request.upcoming_training_id ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/document-training/upcoming/${request.upcoming_training_id}`}>
                View listing
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Provider</dt>
          <dd>{request.provider || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Location</dt>
          <dd>{request.location || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dates</dt>
          <dd>
            {request.starts_on ? formatDate(request.starts_on) : "—"}
            {request.ends_on && request.ends_on !== request.starts_on
              ? ` – ${formatDate(request.ends_on)}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estimated cost</dt>
          <dd>{formatEstimatedCost(request.estimated_cost)}</dd>
        </div>
      </dl>

      {request.description ? (
        <div className="mb-4 whitespace-pre-wrap text-sm">{request.description}</div>
      ) : null}
      {request.justification ? (
        <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="mb-1 font-medium">Justification</div>
          <div className="whitespace-pre-wrap">{request.justification}</div>
        </div>
      ) : null}
      {request.denial_reason ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="mb-1 font-medium">Denial reason</div>
          <div className="whitespace-pre-wrap">{request.denial_reason}</div>
        </div>
      ) : null}

      <div className="mb-6">
        <TrainingAttendanceRequestActions
          requestId={request.id}
          canDecide={canDecide}
          canWithdraw={canWithdraw}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        {request.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {request.events.map((event) => (
              <li key={event.id} className="rounded-md border px-3 py-2">
                <div className="font-medium capitalize">{event.action.replaceAll("_", " ")}</div>
                <div className="text-muted-foreground">
                  {event.from_stage ?? "—"} → {event.to_stage ?? "—"}
                  {event.acted_by_profile
                    ? ` · ${personnelDisplayName({
                        ...event.acted_by_profile,
                        email: null,
                      })}`
                    : ""}
                  {` · ${formatDateTime(event.created_at)}`}
                </div>
                {event.comment ? (
                  <div className="mt-1 whitespace-pre-wrap">{event.comment}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
