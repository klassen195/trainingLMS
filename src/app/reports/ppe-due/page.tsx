import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { loadReportBranding } from "@/lib/reports/branding";
import { PPE_DUE_COLUMNS, loadPpeDueReport } from "@/lib/reports/ppe-due";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/Button";

export default async function PpeDueReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireCapability("access_reports");
  await requireCapability("access_assets");

  const params = await searchParams;
  const withinDays = [30, 90, 180, 365].includes(Number(params.days))
    ? Number(params.days)
    : 180;

  const [{ rows }, branding] = await Promise.all([
    loadPpeDueReport({ withinDays }),
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
        title="PPE expiry & inspection due"
        description="Equipment approaching expiry or with inspections due within the selected horizon."
        branding={branding}
        columns={PPE_DUE_COLUMNS}
        rows={rows}
        filterSummary={`Horizon: ${withinDays} days`}
        filenameBase={`ppe-due-${withinDays}d`}
        filters={
          <>
            {[30, 90, 180, 365].map((days) => (
              <Button
                key={days}
                size="sm"
                variant={days === withinDays ? "default" : "outline"}
                asChild
              >
                <Link href={`/reports/ppe-due?days=${days}`}>{days} days</Link>
              </Button>
            ))}
          </>
        }
      />
    </div>
  );
}
