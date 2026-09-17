import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import {
  daysUntilExpiry,
  isCertExpired,
  personnelDisplayName,
} from "@/lib/personnel-types";

export type CertificationsReportRow = Record<string, unknown> & {
  name: string;
  issuingAuthority: string;
  issuedOn: string;
  expiresOn: string;
  status: string;
  daysUntil: number | string;
  notes: string;
};

export type CertificationsReportPersonOption = {
  id: string;
  label: string;
};

export type CertificationsScope = "active" | "all";

export async function loadCertificationsReport(options: {
  profileId: string;
  scope?: CertificationsScope;
}): Promise<{
  rows: CertificationsReportRow[];
  personName: string | null;
  scope: CertificationsScope;
}> {
  const scope: CertificationsScope = options.scope === "all" ? "all" : "active";
  const profileId = options.profileId;

  const supabase = await createSupabaseServerClient();
  const [{ data: certs, error: certsError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("personnel_certifications")
        .select(
          "id, name, issuing_authority, issued_on, expires_on, notes, sort_order"
        )
        .eq("profile_id", profileId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name, email")
        .eq("id", profileId)
        .maybeSingle(),
    ]);

  if (certsError) throw certsError;
  if (profileError) throw profileError;

  const personName = profile
    ? personnelDisplayName({
        display_name: profile.display_name as string | null,
        first_name: profile.first_name as string | null,
        last_name: profile.last_name as string | null,
        email: profile.email as string | null,
      })
    : null;

  const rows: CertificationsReportRow[] = [];
  for (const cert of certs ?? []) {
    const expiresOn = (cert.expires_on as string | null) ?? null;
    const expired = isCertExpired(expiresOn);
    if (scope === "active" && expired) continue;

    const daysUntil = expiresOn ? daysUntilExpiry(expiresOn) : null;

    rows.push({
      name: (cert.name as string | null)?.trim() || "Untitled certification",
      issuingAuthority: ((cert.issuing_authority as string | null) ?? "").trim(),
      issuedOn: formatDate(cert.issued_on as string | null),
      expiresOn: expiresOn ? formatDate(expiresOn) : "No expiry",
      status: expired ? "Expired" : "Active",
      daysUntil: daysUntil == null ? "—" : daysUntil,
      notes: ((cert.notes as string | null) ?? "").trim(),
    });
  }

  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === "Expired" ? 1 : -1;
    const aDays = typeof a.daysUntil === "number" ? a.daysUntil : Number.POSITIVE_INFINITY;
    const bDays = typeof b.daysUntil === "number" ? b.daysUntil : Number.POSITIVE_INFINITY;
    return aDays - bDays || String(a.name).localeCompare(String(b.name));
  });

  return { rows, personName, scope };
}

export async function listCertificationsReportPeople(): Promise<
  CertificationsReportPersonOption[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, first_name, last_name, email, is_active, is_platform_operator"
    )
    .eq("is_active", true)
    .eq("is_platform_operator", false)
    .order("display_name", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((profile) => ({
      id: profile.id as string,
      label: personnelDisplayName({
        display_name: profile.display_name as string | null,
        first_name: profile.first_name as string | null,
        last_name: profile.last_name as string | null,
        email: profile.email as string | null,
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export const CERTIFICATIONS_COLUMNS = [
  { key: "name", header: "Certification" },
  { key: "issuingAuthority", header: "Issuing authority" },
  { key: "issuedOn", header: "Issued" },
  { key: "expiresOn", header: "Expires" },
  { key: "status", header: "Status" },
  { key: "daysUntil", header: "Days until" },
  { key: "notes", header: "Notes" },
];
