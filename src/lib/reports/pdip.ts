import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import {
  isCertExpired,
  personnelDisplayName,
} from "@/lib/personnel-types";
import {
  listCertificationsReportPeople,
  type CertificationsReportPersonOption,
} from "@/lib/reports/certifications";

export type PdipReportRow = Record<string, unknown> & {
  type: string;
  name: string;
  earnedOrIssued: string;
  expiresOn: string;
  status: string;
};

export type PdipReportPersonOption = CertificationsReportPersonOption;

export async function loadPdipReport(options: { profileId: string }): Promise<{
  rows: PdipReportRow[];
  personName: string | null;
  certCount: number;
  qualCount: number;
  total: number;
}> {
  const profileId = options.profileId;
  const supabase = await createSupabaseServerClient();

  const [
    { data: certs, error: certsError },
    { data: quals, error: qualsError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase
      .from("personnel_certifications")
      .select("id, name, issued_on, expires_on, sort_order")
      .eq("profile_id", profileId)
      .eq("pdip_eligible", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("personnel_qualifications")
      .select(
        "id, earned_on, expires_on, qualification:qualifications!inner(id, name, pdip_eligible)"
      )
      .eq("profile_id", profileId)
      .eq("qualification.pdip_eligible", true)
      .order("earned_on", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, first_name, last_name, email")
      .eq("id", profileId)
      .maybeSingle(),
  ]);

  if (certsError) throw certsError;
  if (qualsError) throw qualsError;
  if (profileError) throw profileError;

  const personName = profile
    ? personnelDisplayName({
        display_name: profile.display_name as string | null,
        first_name: profile.first_name as string | null,
        last_name: profile.last_name as string | null,
        email: profile.email as string | null,
      })
    : null;

  const rows: PdipReportRow[] = [];

  for (const cert of certs ?? []) {
    const expiresOn = (cert.expires_on as string | null) ?? null;
    if (isCertExpired(expiresOn)) continue;

    rows.push({
      type: "Certification",
      name: (cert.name as string | null)?.trim() || "Untitled certification",
      earnedOrIssued: formatDate(cert.issued_on as string | null) || "—",
      expiresOn: expiresOn ? formatDate(expiresOn) : "No expiry",
      status: "Active",
    });
  }

  for (const row of quals ?? []) {
    const expiresOn = (row.expires_on as string | null) ?? null;
    if (isCertExpired(expiresOn)) continue;

    const qualification = row.qualification as
      | { id: string; name: string; pdip_eligible: boolean }
      | { id: string; name: string; pdip_eligible: boolean }[]
      | null;
    const qual = Array.isArray(qualification) ? qualification[0] : qualification;
    if (!qual?.pdip_eligible) continue;

    rows.push({
      type: "Qualification",
      name: (qual.name ?? "").trim() || "Untitled qualification",
      earnedOrIssued: formatDate(row.earned_on as string | null) || "—",
      expiresOn: expiresOn ? formatDate(expiresOn) : "No expiry",
      status: "Active",
    });
  }

  rows.sort((a, b) => {
    if (a.type !== b.type) return String(a.type).localeCompare(String(b.type));
    return String(a.name).localeCompare(String(b.name));
  });

  const certCount = rows.filter((row) => row.type === "Certification").length;
  const qualCount = rows.filter((row) => row.type === "Qualification").length;

  return {
    rows,
    personName,
    certCount,
    qualCount,
    total: certCount + qualCount,
  };
}

export async function listPdipReportPeople(): Promise<PdipReportPersonOption[]> {
  return listCertificationsReportPeople();
}

export const PDIP_COLUMNS = [
  { key: "type", header: "Type" },
  { key: "name", header: "Credential" },
  { key: "earnedOrIssued", header: "Issued / earned" },
  { key: "expiresOn", header: "Expires" },
  { key: "status", header: "Status" },
];
