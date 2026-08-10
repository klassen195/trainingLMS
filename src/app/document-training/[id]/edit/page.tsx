import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPen } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import {
  getTrainingSession,
  listTrainingSessionProfiles,
} from "@/app/document-training/actions";
import { listTrainingCategories } from "@/lib/training-categories";
import { listQualifications } from "@/lib/qualifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DocumentTrainingForm,
  type DocumentTrainingFormInitial,
} from "@/components/DocumentTrainingForm";
import { Button } from "@/components/ui/Button";

export default async function EditDocumentTrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("document_training");
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [
    session,
    profiles,
    { rows: activeCategories, error: categoriesError },
    { rows: activeQualifications, error: qualificationsError },
  ] = await Promise.all([
    getTrainingSession(id),
    listTrainingSessionProfiles(),
    listTrainingCategories(supabase, { activeOnly: true }),
    listQualifications(supabase, { activeOnly: true }),
  ]);

  if (categoriesError) throw new Error(categoriesError.message);
  if (qualificationsError) throw new Error(qualificationsError.message);
  if (!session) notFound();

  // Keep the current category available even if it was later deactivated.
  let categories = activeCategories;
  if (session.category && !categories.some((c) => c.id === session.category_id)) {
    const { rows: allCategories } = await listTrainingCategories(supabase);
    const current = allCategories.find((c) => c.id === session.category_id);
    if (current) categories = [current, ...categories];
  }

  let qualifications = activeQualifications;
  if (
    session.qualification &&
    !qualifications.some((q) => q.id === session.qualification_id)
  ) {
    const { rows: allQualifications } = await listQualifications(supabase);
    const current = allQualifications.find((q) => q.id === session.qualification_id);
    if (current) qualifications = [current, ...qualifications];
  }

  const initial: DocumentTrainingFormInitial = {
    sessionId: session.id,
    sessionType: session.session_type,
    categoryId: session.category_id,
    title: session.title,
    location: session.location ?? "",
    notes: session.notes ?? "",
    attendeeIds: session.attendees.map((a) => a.profile_id),
    occurredOn: session.occurred_on ?? "",
    startTime: session.start_time ?? "",
    endTime: session.end_time ?? "",
    instructorName: session.instructor_name ?? "",
    provider: session.provider ?? "",
    expiresOn: session.expires_on ?? "",
    qualificationId: session.qualification_id ?? "",
    hours: session.hours,
    hoursOverridden: session.hours_overridden,
    days:
      session.days.length > 0
        ? session.days.map((day) => ({
            occurredOn: day.occurred_on,
            startTime: day.start_time,
            endTime: day.end_time,
          }))
        : session.started_on
          ? [
              {
                occurredOn: session.started_on,
                startTime: session.start_time ?? "",
                endTime: session.end_time ?? "",
              },
            ]
          : [],
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ClipboardPen className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Edit training</h1>
        </div>
        <p className="text-muted-foreground">
          Update session details or add attendees who were missing from the original report.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/document-training/${id}`}>Back to report</Link>
          </Button>
        </div>
      </div>

      <DocumentTrainingForm
        profiles={profiles}
        categories={categories}
        qualifications={qualifications}
        initial={initial}
      />
    </div>
  );
}
