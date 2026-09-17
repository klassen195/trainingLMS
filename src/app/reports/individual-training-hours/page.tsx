import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { loadReportBranding } from "@/lib/reports/branding";
import {
  INDIVIDUAL_TRAINING_HOURS_COLUMNS,
  listIndividualTrainingHoursPeople,
  loadIndividualTrainingHoursReport,
} from "@/lib/reports/individual-training-hours";
import { trainingHoursYearBounds } from "@/lib/personnel";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

export default async function IndividualTrainingHoursReportPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; start?: string; end?: string }>;
}) {
  await requireCapability("access_reports");
  await requireCapability("document_training");

  const params = await searchParams;
  const bounds = trainingHoursYearBounds();
  const start = params.start && /^\d{4}-\d{2}-\d{2}$/.test(params.start) ? params.start : bounds.start;
  const endInclusive =
    params.end && /^\d{4}-\d{2}-\d{2}$/.test(params.end)
      ? params.end
      : `${bounds.year}-12-31`;

  const endDate = new Date(`${endInclusive}T00:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const endExclusive = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  const personId =
    params.person && /^[0-9a-f-]{36}$/i.test(params.person) ? params.person : "";

  const [people, branding, report] = await Promise.all([
    listIndividualTrainingHoursPeople(),
    loadReportBranding(),
    personId
      ? loadIndividualTrainingHoursReport({ profileId: personId, start, endExclusive })
      : Promise.resolve({
          rows: [] as Awaited<ReturnType<typeof loadIndividualTrainingHoursReport>>["rows"],
          personName: null as string | null,
          totalHours: 0,
        }),
  ]);

  const selectedPerson = people.find((person) => person.id === personId);
  const personLabel = report.personName ?? selectedPerson?.label ?? null;
  const filterSummary = personLabel
    ? `${personLabel} · ${start} through ${endInclusive}`
    : "Select a person and date range to run this report.";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports">All reports</Link>
        </Button>
      </div>
      <ReportShell
        title="Individual Training Hours"
        description="Each Document Training session attended by the selected person for the date range."
        branding={branding}
        columns={INDIVIDUAL_TRAINING_HOURS_COLUMNS}
        rows={report.rows}
        filterSummary={filterSummary}
        facetFilters={[{ key: "category", label: "Category" }]}
        hoursByCategorySummary
        filenameBase={
          personLabel
            ? `individual-training-hours-${personLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${start}-to-${endInclusive}`
            : `individual-training-hours-${start}-to-${endInclusive}`
        }
        filters={
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-[16rem]">
              <FieldLabel htmlFor="person">Person</FieldLabel>
              <Select id="person" name="person" defaultValue={personId} required>
                <option value="">Select a person…</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="start">Start</FieldLabel>
              <Input id="start" name="start" type="date" defaultValue={start} />
            </div>
            <div>
              <FieldLabel htmlFor="end">End</FieldLabel>
              <Input id="end" name="end" type="date" defaultValue={endInclusive} />
            </div>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>
        }
      />
    </div>
  );
}
