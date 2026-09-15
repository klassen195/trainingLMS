import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { loadReportBranding } from "@/lib/reports/branding";
import { LMS_PROGRESS_COLUMNS, loadLmsProgressReport } from "@/lib/reports/lms-progress";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/Button";

export default async function LmsProgressReportPage() {
  await requireCapability("access_reports");
  await requireCapability("access_programs");

  const [{ rows }, branding] = await Promise.all([
    loadLmsProgressReport(),
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
        title="LMS progress"
        description="Program enrollment and completion progress for active personnel."
        branding={branding}
        columns={LMS_PROGRESS_COLUMNS}
        rows={rows}
        filenameBase="lms-progress"
      />
    </div>
  );
}
