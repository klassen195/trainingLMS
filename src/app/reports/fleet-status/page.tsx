import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { loadReportBranding } from "@/lib/reports/branding";
import { FLEET_STATUS_COLUMNS, loadFleetStatusReport } from "@/lib/reports/fleet-status";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/Button";

export default async function FleetStatusReportPage() {
  await requireCapability("access_reports");
  await requireCapability("view_fleet");

  const [{ rows }, branding] = await Promise.all([
    loadFleetStatusReport(),
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
        title="Fleet status"
        description="Apparatus readiness overview with open work orders and preventive maintenance."
        branding={branding}
        columns={FLEET_STATUS_COLUMNS}
        rows={rows}
        filenameBase="fleet-status"
      />
    </div>
  );
}
