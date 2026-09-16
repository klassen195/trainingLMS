import Link from "next/link";
import { ClipboardPen } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { listTrainingSessionProfiles } from "@/app/document-training/actions";
import {
  getUpcomingTraining,
  listApprovedApplicantIdsForUpcomingTraining,
} from "@/app/document-training/upcoming/actions";
import { listTrainingCategories } from "@/lib/training-categories";
import { listQualifications } from "@/lib/qualifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trainingReportDraftFromUpcomingTraining } from "@/lib/document-training-from-opportunity";
import {
  DocumentTrainingForm,
  type DocumentTrainingFormInitial,
} from "@/components/DocumentTrainingForm";
import { TrainingSectionNav } from "@/components/TrainingSectionNav";
import { Button } from "@/components/ui/Button";

export default async function NewDocumentTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireCapability("document_training");
  const { from: fromOpportunityId } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [
    profiles,
    { rows: categories, error: categoriesError },
    { rows: qualifications, error: qualificationsError },
  ] = await Promise.all([
    listTrainingSessionProfiles(),
    listTrainingCategories(supabase, { activeOnly: true }),
    listQualifications(supabase, { activeOnly: true }),
  ]);
  if (categoriesError) throw new Error(categoriesError.message);
  if (qualificationsError) throw new Error(qualificationsError.message);

  let initial: DocumentTrainingFormInitial | undefined;
  let sourceOpportunity:
    | { id: string; title: string; approvedCount: number }
    | null = null;
  let fromError: string | null = null;

  if (fromOpportunityId?.trim()) {
    try {
      const [listing, approvedIds] = await Promise.all([
        getUpcomingTraining(fromOpportunityId.trim()),
        listApprovedApplicantIdsForUpcomingTraining(fromOpportunityId.trim()),
      ]);
      const draft = trainingReportDraftFromUpcomingTraining(listing, {
        attendeeIds: approvedIds,
        categoryId: categories[0]?.id ?? "",
      });
      initial = {
        sessionType: draft.sessionType,
        categoryId: draft.categoryId,
        title: draft.title,
        location: draft.location,
        notes: draft.notes,
        attendeeIds: draft.attendeeIds,
        occurredOn: draft.occurredOn,
        startTime: draft.startTime,
        endTime: draft.endTime,
        instructorName: draft.instructorName,
        provider: draft.provider,
        expiresOn: draft.expiresOn,
        qualificationId: draft.qualificationId,
        hours: draft.hours,
        hoursOverridden: draft.hoursOverridden,
        days: draft.days,
      };
      sourceOpportunity = {
        id: draft.sourceUpcomingTrainingId,
        title: draft.sourceUpcomingTrainingTitle,
        approvedCount: approvedIds.length,
      };
    } catch (err) {
      fromError =
        err instanceof Error ? err.message : "Could not load that opportunity.";
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <TrainingSectionNav pathname="/document-training" />
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ClipboardPen className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">
            {sourceOpportunity ? "Convert to training report" : "Log training"}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {sourceOpportunity
            ? "Review the details pulled from the opportunity, choose a category, then save the report."
            : "Start by choosing in-house training or a certification course, then fill in the details."}
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link
              href={
                sourceOpportunity
                  ? `/document-training/upcoming/${sourceOpportunity.id}`
                  : "/document-training"
              }
            >
              {sourceOpportunity ? "Back to opportunity" : "Back to list"}
            </Link>
          </Button>
        </div>
      </div>

      {fromError ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {fromError}
        </div>
      ) : null}

      {sourceOpportunity ? (
        <div className="mb-6 rounded-md border bg-muted/30 px-4 py-3 text-sm">
          <p>
            Prefilling from{" "}
            <Link
              href={`/document-training/upcoming/${sourceOpportunity.id}`}
              className="font-medium text-primary hover:underline"
            >
              {sourceOpportunity.title}
            </Link>
            .
            {sourceOpportunity.approvedCount > 0
              ? ` ${sourceOpportunity.approvedCount} approved applicant${
                  sourceOpportunity.approvedCount === 1 ? "" : "s"
                } added as attendees — adjust as needed.`
              : " No approved applicants yet; add attendees below."}
          </p>
        </div>
      ) : null}

      <DocumentTrainingForm
        profiles={profiles}
        categories={categories}
        qualifications={qualifications}
        initial={initial}
        cancelHref={
          sourceOpportunity
            ? `/document-training/upcoming/${sourceOpportunity.id}`
            : "/document-training"
        }
      />
    </div>
  );
}
