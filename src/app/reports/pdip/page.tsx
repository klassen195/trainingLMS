import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { loadReportBranding } from "@/lib/reports/branding";
import {
  PDIP_COLUMNS,
  listPdipReportPeople,
  loadPdipReport,
} from "@/lib/reports/pdip";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Select } from "@/components/ui/Input";

export default async function PdipReportPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  await requireCapability("access_reports");
  await requireCapability("access_pdip");
  await requireCapability("access_personnel");

  const params = await searchParams;
  const personId =
    params.person && /^[0-9a-f-]{36}$/i.test(params.person) ? params.person : "";

  const [people, branding, report] = await Promise.all([
    listPdipReportPeople(),
    loadReportBranding(),
    personId
      ? loadPdipReport({ profileId: personId })
      : Promise.resolve({
          rows: [] as Awaited<ReturnType<typeof loadPdipReport>>["rows"],
          personName: null as string | null,
          certCount: 0,
          qualCount: 0,
          total: 0,
        }),
  ]);

  const selectedPerson = people.find((person) => person.id === personId);
  const personLabel = report.personName ?? selectedPerson?.label ?? null;
  const filterSummary = personLabel
    ? `${personLabel} · PDIP certifications: ${report.certCount} · PDIP qualifications: ${report.qualCount} · Total: ${report.total}`
    : "Select a person to run this report.";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports">All reports</Link>
        </Button>
      </div>
      <ReportShell
        title="PDIP"
        description="Active PDIP-eligible certifications and qualifications for a selected person."
        branding={branding}
        columns={PDIP_COLUMNS}
        rows={report.rows}
        filterSummary={filterSummary}
        facetFilters={[{ key: "type", label: "Type" }]}
        filenameBase={
          personLabel
            ? `pdip-${personLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`
            : "pdip"
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
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>
        }
      />
    </div>
  );
}
