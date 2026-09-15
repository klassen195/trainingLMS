import Link from "next/link";
import { ChevronRight, FileBarChart } from "lucide-react";
import { requireCapability, getProfileCapabilities } from "@/lib/capability-access";
import { REPORT_CATALOG } from "@/lib/reports/types";
import { cn } from "@/lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function ReportsHubPage() {
  const profile = await requireCapability("access_reports");
  const caps = await getProfileCapabilities(profile);

  const available = REPORT_CATALOG.filter((report) =>
    report.requiredCapabilities.every((cap) => caps[cap])
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <FileBarChart className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Reports</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Pull department reports as on-screen tables, CSV, or branded PDF.
        </p>
      </div>

      {available.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          You have Reports access, but no individual report domains are enabled for your
          permission level.
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold tracking-tight text-muted-foreground">
              Available reports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {available.map((report) => (
                <li key={report.id}>
                  <Link
                    href={report.href}
                    className={cn(
                      "flex items-center gap-3 px-6 py-4 transition-colors",
                      "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{report.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {report.description}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
