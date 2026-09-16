import { addCalendarDaysIso } from "@/lib/dates";
import type { TrainingSessionType } from "@/lib/document-training-types";
import {
  formatEstimatedCost,
  type UpcomingTraining,
} from "@/lib/upcoming-training-types";

/** Cap seeded session days so a long date range does not flood the form. */
export const MAX_SESSION_DAYS_FROM_OPPORTUNITY = 31;

export type TrainingReportDraftFromOpportunity = {
  sessionType: TrainingSessionType;
  categoryId: string;
  title: string;
  location: string;
  notes: string;
  attendeeIds: string[];
  occurredOn: string;
  startTime: string;
  endTime: string;
  instructorName: string;
  provider: string;
  expiresOn: string;
  qualificationId: string;
  hours: number | null;
  hoursOverridden: boolean;
  days: Array<{
    occurredOn: string;
    startTime: string;
    endTime: string;
  }>;
  sourceUpcomingTrainingId: string;
  sourceUpcomingTrainingTitle: string;
};

function inclusiveIsoDateRange(
  start: string,
  end: string | null | undefined,
  maxDays = MAX_SESSION_DAYS_FROM_OPPORTUNITY
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  const endDate =
    end && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start ? end : start;
  const dates: string[] = [];
  let cursor = start;
  while (dates.length < maxDays) {
    dates.push(cursor);
    if (cursor >= endDate) break;
    cursor = addCalendarDaysIso(cursor, 1);
  }
  return dates;
}

function combineLocation(location: string, city: string) {
  const venue = location.trim();
  const place = city.trim();
  if (venue && place) {
    if (venue.toLowerCase().includes(place.toLowerCase())) return venue;
    return `${venue}, ${place}`;
  }
  return venue || place;
}

function buildNotes(listing: Pick<
  UpcomingTraining,
  "description" | "notes" | "estimated_cost" | "external_url"
>) {
  const parts: string[] = [];
  const description = listing.description?.trim() ?? "";
  const notes = listing.notes?.trim() ?? "";
  if (description) parts.push(description);
  if (notes) parts.push(notes);
  if (listing.estimated_cost != null) {
    parts.push(`Estimated cost: ${formatEstimatedCost(listing.estimated_cost)}`);
  }
  const url = listing.external_url?.trim() ?? "";
  if (url) parts.push(`External link: ${url}`);
  return parts.join("\n\n");
}

/**
 * Prefill a certification-course training report from an upcoming opportunity.
 * Category must still be chosen by the user (or supplied).
 */
export function trainingReportDraftFromUpcomingTraining(
  listing: Pick<
    UpcomingTraining,
    | "id"
    | "title"
    | "description"
    | "provider"
    | "location"
    | "city"
    | "starts_on"
    | "ends_on"
    | "start_time"
    | "end_time"
    | "estimated_cost"
    | "external_url"
    | "notes"
  >,
  options?: {
    attendeeIds?: string[];
    categoryId?: string;
  }
): TrainingReportDraftFromOpportunity {
  const startTime = listing.start_time?.trim() ?? "";
  const endTime = listing.end_time?.trim() ?? "";
  const dateSeeds = listing.starts_on
    ? inclusiveIsoDateRange(listing.starts_on, listing.ends_on)
    : [];

  return {
    sessionType: "certification_course",
    categoryId: options?.categoryId ?? "",
    title: listing.title?.trim() ?? "",
    location: combineLocation(listing.location ?? "", listing.city ?? ""),
    notes: buildNotes(listing),
    attendeeIds: options?.attendeeIds ?? [],
    occurredOn: "",
    startTime: "",
    endTime: "",
    instructorName: "",
    provider: listing.provider?.trim() ?? "",
    expiresOn: "",
    qualificationId: "",
    hours: null,
    hoursOverridden: false,
    days:
      dateSeeds.length > 0
        ? dateSeeds.map((occurredOn) => ({
            occurredOn,
            startTime,
            endTime,
          }))
        : [{ occurredOn: "", startTime, endTime }],
    sourceUpcomingTrainingId: listing.id,
    sourceUpcomingTrainingTitle: listing.title?.trim() ?? "Opportunity",
  };
}
