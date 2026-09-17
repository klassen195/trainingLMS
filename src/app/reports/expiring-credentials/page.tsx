import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { loadReportBranding } from "@/lib/reports/branding";
import {
  EXPIRING_CREDENTIAL_COLUMNS,
  loadExpiringCredentialsReport,
} from "@/lib/reports/expiring-credentials";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/Button";

export default async function ExpiringCredentialsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  await requireCapability("access_reports");
  await requireCapability("access_personnel");

  const params = await searchParams;
  const withinMonths = [1, 3, 6, 12].includes(Number(params.months))
    ? Number(params.months)
    : 6;

  const [{ rows }, branding] = await Promise.all([
    loadExpiringCredentialsReport({ withinMonths }),
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
        title="Expiring credentials"
        description="Certifications, EMS licenses, and qualifications that are expired or within the selected horizon."
        branding={branding}
        columns={EXPIRING_CREDENTIAL_COLUMNS}
        rows={rows}
        filterSummary={`Horizon: ${withinMonths} month${withinMonths === 1 ? "" : "s"}`}
        filenameBase={`expiring-credentials-${withinMonths}mo`}
        facetFilters={[{ key: "kind", label: "Credential type" }]}
        filters={
          <>
            {[1, 3, 6, 12].map((months) => (
              <Button
                key={months}
                size="sm"
                variant={months === withinMonths ? "default" : "outline"}
                asChild
              >
                <Link href={`/reports/expiring-credentials?months=${months}`}>
                  {months} mo
                </Link>
              </Button>
            ))}
          </>
        }
      />
    </div>
  );
}
