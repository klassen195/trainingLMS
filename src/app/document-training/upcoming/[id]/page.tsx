import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfileCapabilities, requireCapability } from "@/lib/capability-access";
import {
  getUpcomingTraining,
} from "@/app/document-training/upcoming/actions";
import { listMyTrainingAttendanceRequests } from "@/app/document-training/requests/actions";
import { ApplyToUpcomingTrainingForm } from "@/components/ApplyToUpcomingTrainingForm";
import { TrainingSectionNav } from "@/components/TrainingSectionNav";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/dates";
import {
  formatEstimatedCost,
  upcomingTrainingStatusLabel,
} from "@/lib/upcoming-training-types";
import { isMissingUpcomingTrainingTables } from "@/lib/supabase/errors";

export default async function UpcomingTrainingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireCapability("document_training");
  const caps = await getProfileCapabilities(profile);

  let listing: Awaited<ReturnType<typeof getUpcomingTraining>> | null = null;
  let loadError: string | null = null;
  let alreadyApplied = false;

  try {
    listing = await getUpcomingTraining(id);
    const mine = await listMyTrainingAttendanceRequests();
    alreadyApplied = mine.some(
      (row) =>
        row.upcoming_training_id === id &&
        ["pending_captain", "pending_bc", "pending_ops", "approved"].includes(row.current_stage)
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) notFound();
    loadError = err instanceof Error ? err.message : "Failed to load.";
    if (isMissingUpcomingTrainingTables(err as never)) {
      loadError =
        "Database not set up yet. Run supabase/migrations/20260915120000_upcoming_training_requests.sql, then refresh.";
    }
  }

  if (loadError || !listing) {
    return (
      <div className="container mx-auto px-4 py-5">
        <TrainingSectionNav pathname="/document-training/upcoming" />
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError ?? "Not found."}</p>
        </div>
      </div>
    );
  }

  const canManage = caps.manage_upcoming_training;
  const canApply = listing.status === "open";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-5">
      <TrainingSectionNav pathname="/document-training/upcoming" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            <Badge variant={listing.status === "open" ? "default" : "secondary"}>
              {upcomingTrainingStatusLabel(listing.status)}
            </Badge>
          </div>
          {listing.provider ? (
            <p className="text-sm text-muted-foreground">{listing.provider}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/document-training/upcoming">Back</Link>
          </Button>
          {canManage ? (
            <Button size="sm" asChild>
              <Link href={`/document-training/upcoming/${listing.id}/edit`}>Edit</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Location</dt>
          <dd>{listing.location || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dates</dt>
          <dd>
            {listing.starts_on ? formatDate(listing.starts_on) : "—"}
            {listing.ends_on && listing.ends_on !== listing.starts_on
              ? ` – ${formatDate(listing.ends_on)}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Apply by</dt>
          <dd>
            {listing.application_deadline ? formatDate(listing.application_deadline) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estimated cost</dt>
          <dd>{formatEstimatedCost(listing.estimated_cost)}</dd>
        </div>
        {listing.external_url ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">External link</dt>
            <dd>
              <a
                href={listing.external_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {listing.external_url}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {listing.description ? (
        <div className="mb-6 whitespace-pre-wrap text-sm">{listing.description}</div>
      ) : null}

      {canManage && listing.notes ? (
        <div className="mb-6 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="mb-1 font-medium">Internal notes</div>
          <div className="whitespace-pre-wrap text-muted-foreground">{listing.notes}</div>
        </div>
      ) : null}

      {canApply ? (
        <div className="rounded-md border p-4">
          <h2 className="mb-3 text-lg font-semibold">Apply to attend</h2>
          <ApplyToUpcomingTrainingForm
            upcomingTrainingId={listing.id}
            alreadyApplied={alreadyApplied}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This opportunity is not open for applications.
        </p>
      )}
    </div>
  );
}
