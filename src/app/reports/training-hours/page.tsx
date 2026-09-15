import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { loadReportBranding } from "@/lib/reports/branding";
import {
  TRAINING_HOURS_COLUMNS,
  loadTrainingHoursReport,
} from "@/lib/reports/training-hours";
import { trainingHoursYearBounds } from "@/lib/personnel";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export default async function TrainingHoursReportPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
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

  // Convert inclusive end date to exclusive bound for the loader.
  const endDate = new Date(`${endInclusive}T00:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const endExclusive = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  const [{ rows }, branding] = await Promise.all([
    loadTrainingHoursReport({ start, endExclusive }),
    loadReportBranding(),
  ]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports">All reports</Link>
        </Button>
      </div>
      <ReportShell
        title="Document training hours"
        description="Hours logged in Document Training, totaled by person for the selected date range."
        branding={branding}
        columns={TRAINING_HOURS_COLUMNS}
        rows={rows}
        filterSummary={`${start} through ${endInclusive}`}
        filenameBase={`training-hours-${start}-to-${endInclusive}`}
        filters={
          <form className="flex flex-wrap items-end gap-3" method="get">
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
