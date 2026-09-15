import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  collectExpiringPersonnelItems,
  expiringItemKindLabel,
  personnelDisplayName,
  personnelShiftLabel,
  type PersonnelShift,
} from "@/lib/personnel-types";
import { formatDate } from "@/lib/dates";

export type ExpiringCredentialReportRow = Record<string, unknown> & {
  person: string;
  employeeNumber: string;
  shift: string;
  station: string;
  kind: string;
  credential: string;
  expiresOn: string;
  daysUntil: number | string;
};

export async function loadExpiringCredentialsReport(options?: {
  withinMonths?: number;
}): Promise<{ rows: ExpiringCredentialReportRow[]; withinMonths: number }> {
  const withinMonths = options?.withinMonths ?? 6;
  const supabase = await createSupabaseServerClient();

  const [
    { data: profiles, error: profilesError },
    { data: certs, error: certsError },
    { data: licenses, error: licensesError },
    { data: quals, error: qualsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, first_name, last_name, email, employee_number, shift, primary_location_id, primary_location:locations!profiles_primary_location_id_fkey(id, name), is_active, is_platform_operator"
      )
      .eq("is_active", true)
      .eq("is_platform_operator", false),
    supabase
      .from("personnel_certifications")
      .select("id, profile_id, name, expires_on"),
    supabase
      .from("personnel_ems_licenses")
      .select("id, profile_id, expires_on, ems_level:ems_levels!ems_level_id(id, name)"),
    supabase
      .from("personnel_qualifications")
      .select(
        "id, profile_id, expires_on, qualification:qualifications!qualification_id(id, name)"
      ),
  ]);

  if (profilesError) throw profilesError;
  if (certsError) throw certsError;
  if (licensesError) throw licensesError;
  if (qualsError) throw qualsError;

  type Loc = { id: string; name: string } | { id: string; name: string }[] | null;
  const profileById = new Map(
    (profiles ?? []).map((row) => {
      const loc = row.primary_location as Loc;
      const primary_location = Array.isArray(loc) ? loc[0] ?? null : loc;
      return [
        row.id as string,
        {
          ...row,
          primary_location,
        },
      ] as const;
    })
  );

  const certsByProfile = new Map<string, { id: string; name: string; expires_on: string | null }[]>();
  for (const cert of certs ?? []) {
    const list = certsByProfile.get(cert.profile_id as string) ?? [];
    list.push({
      id: cert.id as string,
      name: cert.name as string,
      expires_on: (cert.expires_on as string | null) ?? null,
    });
    certsByProfile.set(cert.profile_id as string, list);
  }

  const licensesByProfile = new Map<
    string,
    {
      id: string;
      expires_on: string | null;
      ems_level: { name: string } | null;
    }[]
  >();
  for (const license of licenses ?? []) {
    const level = license.ems_level as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const ems_level = Array.isArray(level) ? level[0] ?? null : level;
    const list = licensesByProfile.get(license.profile_id as string) ?? [];
    list.push({
      id: license.id as string,
      expires_on: (license.expires_on as string | null) ?? null,
      ems_level,
    });
    licensesByProfile.set(license.profile_id as string, list);
  }

  const qualsByProfile = new Map<
    string,
    {
      id: string;
      expires_on: string | null;
      qualification: { name: string } | null;
    }[]
  >();
  for (const row of quals ?? []) {
    const qualification = row.qualification as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const qual = Array.isArray(qualification) ? qualification[0] ?? null : qualification;
    const list = qualsByProfile.get(row.profile_id as string) ?? [];
    list.push({
      id: row.id as string,
      expires_on: (row.expires_on as string | null) ?? null,
      qualification: qual,
    });
    qualsByProfile.set(row.profile_id as string, list);
  }

  const rows: ExpiringCredentialReportRow[] = [];
  for (const [profileId, profile] of profileById) {
    const items = collectExpiringPersonnelItems(
      {
        certifications: certsByProfile.get(profileId) ?? [],
        emsLicenses: licensesByProfile.get(profileId) ?? [],
        qualifications: qualsByProfile.get(profileId) ?? [],
      },
      { withinMonths }
    );
    if (items.length === 0) continue;

    const person = personnelDisplayName({
      display_name: profile.display_name as string | null,
      first_name: profile.first_name as string | null,
      last_name: profile.last_name as string | null,
      email: profile.email as string | null,
    });

    for (const item of items) {
      rows.push({
        person,
        employeeNumber: (profile.employee_number as string | null) ?? "",
        shift: personnelShiftLabel(profile.shift as PersonnelShift | null),
        station: profile.primary_location?.name ?? "",
        kind: expiringItemKindLabel(item.kind),
        credential: item.label,
        expiresOn: formatDate(item.expiresOn),
        daysUntil: item.daysUntil,
      });
    }
  }

  rows.sort((a, b) => Number(a.daysUntil) - Number(b.daysUntil) || String(a.person).localeCompare(String(b.person)));
  return { rows, withinMonths };
}

export const EXPIRING_CREDENTIAL_COLUMNS = [
  { key: "person", header: "Person" },
  { key: "employeeNumber", header: "Employee #" },
  { key: "shift", header: "Shift" },
  { key: "station", header: "Station" },
  { key: "kind", header: "Kind" },
  { key: "credential", header: "Credential" },
  { key: "expiresOn", header: "Expires" },
  { key: "daysUntil", header: "Days until" },
];
