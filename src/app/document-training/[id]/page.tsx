import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPen } from "lucide-react";
import { requireCapability, getProfileCapabilities } from "@/lib/capability-access";
import { getTrainingSession } from "@/app/document-training/actions";
import { TrainingSessionFileDownloadButton } from "@/components/TrainingSessionFileDownloadButton";
import { DeleteTrainingSessionButton } from "@/components/DeleteTrainingSessionButton";
import {
  trainingSessionDayLabel,
  trainingSessionDisplayDate,
  trainingSessionTimeRange,
  trainingSessionTypeLabel,
} from "@/lib/document-training-types";
import { personnelDisplayName, formatTrainingHours } from "@/lib/personnel-types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/dates";

export default async function DocumentTrainingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireCapability("document_training");
  const caps = await getProfileCapabilities(profile);
  const { id } = await params;
  const session = await getTrainingSession(id);
  if (!session) notFound();

  const dateLabel = trainingSessionDisplayDate(session);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/document-training">Back to list</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {caps.delete_training_reports ? (
            <DeleteTrainingSessionButton sessionId={id} title={session.title} />
          ) : null}
          <Button asChild size="sm">
            <Link href={`/document-training/${id}/edit`}>Edit report</Link>
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ClipboardPen className="h-7 w-7 text-primary" />
          <Badge variant="secondary">{trainingSessionTypeLabel(session.session_type)}</Badge>
          {session.category?.name ? (
            <Badge variant="outline">{session.category.name}</Badge>
          ) : null}
        </div>
        <h1 className="text-3xl font-bold">{session.title}</h1>
        {dateLabel ? <p className="mt-2 text-muted-foreground">{dateLabel}</p> : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Category" value={session.category?.name} />
              {session.session_type === "in_house" ? (
                <>
                  <DetailItem label="Instructor" value={session.instructor_name} />
                  <DetailItem
                    label="Time"
                    value={trainingSessionTimeRange(session)}
                  />
                </>
              ) : (
                <>
                  <DetailItem label="Provider" value={session.provider} />
                  <DetailItem
                    label="Expiration"
                    value={session.expires_on ? formatDate(session.expires_on) : null}
                  />
                </>
              )}
              <DetailItem
                label="Hours"
                value={
                  session.hours != null
                    ? `${formatTrainingHours(session.hours)}${
                        session.hours_overridden ? " (overridden)" : ""
                      }`
                    : null
                }
              />
              <DetailItem label="Location" value={session.location} />
              <DetailItem
                label="Qualifies for"
                value={session.qualification?.name}
              />
              <DetailItem
                label="Logged by"
                value={session.recorder ? personnelDisplayName(session.recorder) : null}
              />
            </dl>
            {session.session_type === "certification_course" &&
            session.days.length > 0 ? (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Session days
                </p>
                <ul className="space-y-1.5">
                  {session.days.map((day) => (
                    <li key={day.id} className="text-sm">
                      {trainingSessionDayLabel(day)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {session.notes ? (
              <div className="mt-4 border-t pt-4">
                <p className="mb-1 text-sm font-medium text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap text-sm">{session.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Attendees ({session.attendees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {session.attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendees recorded.</p>
            ) : (
              <ul className="space-y-2">
                {session.attendees.map((attendee) => (
                  <li key={attendee.profile_id} className="text-sm">
                    {attendee.profile
                      ? personnelDisplayName(attendee.profile)
                      : attendee.profile_id}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {session.files.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.files.map((file) => (
                <TrainingSessionFileDownloadButton
                  key={file.id}
                  fileId={file.id}
                  sessionId={session.id}
                  fileName={file.file_name}
                />
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
