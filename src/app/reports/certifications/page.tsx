import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { loadReportBranding } from "@/lib/reports/branding";
import {
  CERTIFICATIONS_COLUMNS,
  listCertificationsReportPeople,
  loadCertificationsReport,
  type CertificationsScope,
} from "@/lib/reports/certifications";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Select } from "@/components/ui/Input";

export default async function CertificationsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; scope?: string }>;
}) {
  await requireCapability("access_reports");
  await requireCapability("access_personnel");

  const params = await searchParams;
  const personId =
    params.person && /^[0-9a-f-]{36}$/i.test(params.person) ? params.person : "";
  const scope: CertificationsScope = params.scope === "all" ? "all" : "active";

  const [people, branding, report] = await Promise.all([
    listCertificationsReportPeople(),
    loadReportBranding(),
    personId
      ? loadCertificationsReport({ profileId: personId, scope })
      : Promise.resolve({
          rows: [] as Awaited<ReturnType<typeof loadCertificationsReport>>["rows"],
          personName: null as string | null,
          scope,
        }),
  ]);

  const selectedPerson = people.find((person) => person.id === personId);
  const personLabel = report.personName ?? selectedPerson?.label ?? null;
  const scopeLabel = scope === "all" ? "All certifications" : "Active certifications";
  const filterSummary = personLabel
    ? `${personLabel} · ${scopeLabel}`
    : "Select a person to run this report.";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports">All reports</Link>
        </Button>
      </div>
      <ReportShell
        title="Certifications"
        description="Certifications on file for a selected person, limited to active credentials or including expired ones."
        branding={branding}
        columns={CERTIFICATIONS_COLUMNS}
        rows={report.rows}
        filterSummary={filterSummary}
        facetFilters={[{ key: "status", label: "Status" }]}
        filenameBase={
          personLabel
            ? `certifications-${personLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${scope}`
            : `certifications-${scope}`
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
            <div className="min-w-[14rem]">
              <FieldLabel htmlFor="scope">Show</FieldLabel>
              <Select id="scope" name="scope" defaultValue={scope}>
                <option value="active">Active certifications</option>
                <option value="all">All certifications (including expired)</option>
              </Select>
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
