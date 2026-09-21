import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/dates";
import {
  isCertExpired,
  PERSONNEL_DOCUMENTS_BUCKET,
  personnelDisplayName,
} from "@/lib/personnel-types";
import {
  listCertificationsReportPeople,
  type CertificationsReportPersonOption,
} from "@/lib/reports/certifications";
import type { ReportColumn } from "@/lib/reports/types";

export type PdipReportRow = Record<string, unknown> & {
  type: string;
  previewUrl: string;
  previewMimeType: string;
  previewFileName: string;
  name: string;
  issuingAuthority: string;
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
  taskbookCount: number;
  languageCount: number;
  total: number;
}> {
  const profileId = options.profileId;
  const supabase = await createSupabaseServerClient();

  const [
    { data: certs, error: certsError },
    { data: quals, error: qualsError },
    { data: taskbooks, error: taskbooksError },
    { data: pdipTaskbookTypes, error: pdipTaskbookTypesError },
    { data: languages, error: languagesError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase
      .from("personnel_certifications")
      .select(
        "id, name, issuing_authority, issued_on, expires_on, sort_order, file_name, mime_type, storage_path"
      )
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
      .from("personnel_taskbooks")
      .select("id, rank, completed_on, file_name, mime_type, storage_path")
      .eq("profile_id", profileId)
      .eq("status", "completed")
      .order("completed_on", { ascending: false })
      .order("rank", { ascending: true }),
    supabase.from("taskbook_types").select("name").eq("pdip_eligible", true),
    supabase
      .from("personnel_languages")
      .select("id, name, verified_at")
      .eq("profile_id", profileId)
      .eq("verified", true)
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, display_name, first_name, last_name, email")
      .eq("id", profileId)
      .maybeSingle(),
  ]);

  if (certsError) throw certsError;
  if (qualsError) throw qualsError;
  if (taskbooksError) throw taskbooksError;
  if (pdipTaskbookTypesError) throw pdipTaskbookTypesError;
  if (languagesError) throw languagesError;
  if (profileError) throw profileError;

  const pdipTaskbookNames = new Set(
    (pdipTaskbookTypes ?? [])
      .map((row) => ((row.name as string | null) ?? "").trim())
      .filter(Boolean)
  );

  const personName = profile
    ? personnelDisplayName({
        display_name: profile.display_name as string | null,
        first_name: profile.first_name as string | null,
        last_name: profile.last_name as string | null,
        email: profile.email as string | null,
      })
    : null;

  const storagePaths = [
    ...new Set(
      [
        ...(certs ?? []).map((cert) => (cert.storage_path as string | null) ?? null),
        ...(taskbooks ?? []).map((taskbook) => (taskbook.storage_path as string | null) ?? null),
      ].filter((path): path is string => Boolean(path))
    ),
  ];
  const previewByPath = new Map<string, string>();
  if (storagePaths.length > 0) {
    const service = createSupabaseServiceClient();
    const { data: signed } = await service.storage
      .from(PERSONNEL_DOCUMENTS_BUCKET)
      .createSignedUrls(storagePaths, 60 * 60);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) previewByPath.set(item.path, item.signedUrl);
    }
  }

  const rows: PdipReportRow[] = [];

  for (const cert of certs ?? []) {
    const expiresOn = (cert.expires_on as string | null) ?? null;
    if (isCertExpired(expiresOn)) continue;

    const storagePath = (cert.storage_path as string | null) ?? null;
    rows.push({
      type: "Certification",
      previewUrl: storagePath ? previewByPath.get(storagePath) ?? "" : "",
      previewMimeType: ((cert.mime_type as string | null) ?? "").trim(),
      previewFileName: ((cert.file_name as string | null) ?? "").trim(),
      name: (cert.name as string | null)?.trim() || "Untitled certification",
      issuingAuthority: ((cert.issuing_authority as string | null) ?? "").trim(),
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
      previewUrl: "",
      previewMimeType: "",
      previewFileName: "",
      name: (qual.name ?? "").trim() || "Untitled qualification",
      issuingAuthority: "",
      earnedOrIssued: formatDate(row.earned_on as string | null) || "—",
      expiresOn: expiresOn ? formatDate(expiresOn) : "No expiry",
      status: "Active",
    });
  }

  for (const taskbook of taskbooks ?? []) {
    const rank = ((taskbook.rank as string | null) ?? "").trim() || "Taskbook";
    if (!pdipTaskbookNames.has(rank)) continue;

    const storagePath = (taskbook.storage_path as string | null) ?? null;
    rows.push({
      type: "Taskbook",
      previewUrl: storagePath ? previewByPath.get(storagePath) ?? "" : "",
      previewMimeType: ((taskbook.mime_type as string | null) ?? "").trim(),
      previewFileName: ((taskbook.file_name as string | null) ?? "").trim(),
      name: `${rank} taskbook`,
      issuingAuthority: "",
      earnedOrIssued: formatDate(taskbook.completed_on as string | null) || "—",
      expiresOn: "No expiry",
      status: "Completed",
    });
  }

  for (const language of languages ?? []) {
    rows.push({
      type: "Language",
      previewUrl: "",
      previewMimeType: "",
      previewFileName: "",
      name: ((language.name as string | null) ?? "").trim() || "Untitled language",
      issuingAuthority: "",
      earnedOrIssued: formatDate(language.verified_at as string | null) || "—",
      expiresOn: "No expiry",
      status: "Verified",
    });
  }

  rows.sort((a, b) => {
    if (a.type !== b.type) return String(a.type).localeCompare(String(b.type));
    return String(a.name).localeCompare(String(b.name));
  });

  const certCount = rows.filter((row) => row.type === "Certification").length;
  const qualCount = rows.filter((row) => row.type === "Qualification").length;
  const taskbookCount = rows.filter((row) => row.type === "Taskbook").length;
  const languageCount = rows.filter((row) => row.type === "Language").length;

  return {
    rows,
    personName,
    certCount,
    qualCount,
    taskbookCount,
    languageCount,
    total: certCount + qualCount + taskbookCount + languageCount,
  };
}

export async function listPdipReportPeople(): Promise<PdipReportPersonOption[]> {
  return listCertificationsReportPeople();
}

export const PDIP_COLUMNS: ReportColumn[] = [
  {
    key: "previewUrl",
    header: "Preview",
    format: "image",
    mimeKey: "previewMimeType",
    fileNameKey: "previewFileName",
  },
  { key: "type", header: "Type" },
  { key: "name", header: "Credential" },
  { key: "issuingAuthority", header: "Issuing authority" },
  { key: "earnedOrIssued", header: "Issued / earned" },
  { key: "expiresOn", header: "Expires" },
  { key: "status", header: "Status" },
];
