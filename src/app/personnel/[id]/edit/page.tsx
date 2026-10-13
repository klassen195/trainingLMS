import { notFound, redirect } from "next/navigation";
import { isAdmin, requireUserProfile } from "@/lib/auth";
import {
  fetchPersonnelCertifications,
  fetchPersonnelCertificationSections,
  fetchPersonnelDocuments,
  fetchPersonnelEmsLicenses,
  fetchPersonnelEmsClearanceLog,
  fetchPersonnelNotes,
  fetchPersonnelProfile,
  fetchPersonnelQualifications,
  fetchPersonnelRecognitions,
  fetchPersonnelLanguages,
  fetchPersonnelTaskbooks,
  fetchPersonnelTaskbookPrerequisiteChecks,
  fetchPersonnelTraining,
  fetchPersonnelYtdTrainingHours,
} from "@/lib/personnel";
import { personnelDisplayName } from "@/lib/personnel-types";
import type { Profile } from "@/lib/training-lms-types";
import { LOCATION_SELECT, type Location } from "@/lib/locations-types";
import { listEmsClearanceLevels } from "@/lib/ems-clearance-levels";
import { listEmsLevels } from "@/lib/ems-levels";
import { listPersonnelRanks } from "@/lib/ranks";
import { listQualifications } from "@/lib/qualifications";
import { listTaskbookTypes } from "@/lib/taskbooks";
import { listPermissionLevels } from "@/lib/permission-levels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { excludePlatformOperatorsFromRoster } from "@/lib/department-roster";
import {
  isMissingEmsLevelsTable,
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
} from "@/lib/supabase/errors";
import { PersonnelDatabaseSetup } from "@/components/PersonnelDatabaseSetup";
import { PersonnelEditForm } from "@/components/PersonnelEditForm";
import { PersonnelBackToFileButton } from "@/components/PersonnelSectionNavButtons";
import { currentUserHasCapability } from "@/lib/capability-access";

export default async function PersonnelEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUserProfile();
  const { id } = await params;
  const asAdmin = isAdmin(viewer);
  const isSelf = viewer.id === id;
  const canEditOwn = await currentUserHasCapability("edit_own_personnel");

  if (!asAdmin && !(isSelf && canEditOwn)) {
    redirect(isSelf ? `/personnel/${id}` : "/personnel");
  }

  const supabase = await createSupabaseServerClient();
  const pdipEnabled = await currentUserHasCapability("access_pdip");
  const canVerifyLanguages = await currentUserHasCapability("verify_personnel_languages");

  const { profile, error } = await fetchPersonnelProfile(supabase, id);
  if (isMissingTrainingLmsTables(error) || isMissingPersonnelTables(error)) {
    return <PersonnelDatabaseSetup />;
  }
  if (error) throw error;
  if (!profile) notFound();
  if (profile.is_platform_operator && !viewer.is_platform_operator) notFound();

  const [
    { data: locations },
    { data: supervisors },
    { rows: certifications, error: certError },
    { rows: certificationSections, error: certSectionError },
    { rows: emsLicenses, error: emsLicensesError },
    { rows: emsClearanceLog, error: emsClearanceLogError },
    { rows: qualifications, error: qualificationsError },
    { rows: documents, error: docError },
    { rows: notes, error: notesError },
    { rows: taskbooks, error: taskbooksError },
    { rows: prerequisiteChecks, error: prereqError },
    { rows: recognitions, error: recognitionsError },
    { rows: languages, error: languagesError },
    { programs, error: trainingError },
    { hours: ytdHours, year: ytdYear, error: ytdError },
    { rows: qualificationCatalog, error: catalogError },
    { rows: taskbookCatalog, error: taskbookCatalogError },
    { rows: emsLevelCatalog, error: emsCatalogError },
    { rows: emsClearanceCatalog, error: emsClearanceCatalogError },
    { rows: rankCatalog, error: rankCatalogError },
    { rows: permissionLevels, error: permissionLevelsError },
  ] = await Promise.all([
    supabase
      .from("locations")
      .select(LOCATION_SELECT)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    excludePlatformOperatorsFromRoster(
      supabase
        .from("profiles")
        .select(
          "id, display_name, first_name, last_name, email, rank, swing_up, rank_promoted_on, is_admin, is_active, invited_at, created_at, employee_number, job_title, department, phone, hire_date, shift, primary_location_id, supervisor_id"
        )
        .or(
          profile.supervisor_id
            ? `is_active.eq.true,id.eq.${profile.supervisor_id}`
            : "is_active.eq.true"
        )
        .order("display_name", { ascending: true, nullsFirst: false })
    ),
    fetchPersonnelCertifications(supabase, id, { withPreviewUrls: true }),
    fetchPersonnelCertificationSections(supabase, id),
    fetchPersonnelEmsLicenses(supabase, id),
    fetchPersonnelEmsClearanceLog(supabase, id),
    fetchPersonnelQualifications(supabase, id),
    fetchPersonnelDocuments(supabase, id),
    fetchPersonnelNotes(supabase, id),
    fetchPersonnelTaskbooks(supabase, id),
    fetchPersonnelTaskbookPrerequisiteChecks(supabase, id),
    fetchPersonnelRecognitions(supabase, id),
    fetchPersonnelLanguages(supabase, id),
    fetchPersonnelTraining(supabase, id),
    fetchPersonnelYtdTrainingHours(supabase, id),
    listQualifications(supabase, { activeOnly: true }),
    listTaskbookTypes(supabase, { withPrerequisites: true }),
    listEmsLevels(supabase, { activeOnly: true }),
    listEmsClearanceLevels(supabase, { activeOnly: true }),
    listPersonnelRanks(supabase, { activeOnly: true }),
    listPermissionLevels(supabase),
  ]);

  if (
    (certError && isMissingPersonnelTables(certError)) ||
    (certSectionError && isMissingPersonnelTables(certSectionError)) ||
    (emsLicensesError &&
      (isMissingPersonnelTables(emsLicensesError) || isMissingEmsLevelsTable(emsLicensesError))) ||
    (emsClearanceLogError && isMissingPersonnelTables(emsClearanceLogError)) ||
    (qualificationsError && isMissingPersonnelTables(qualificationsError)) ||
    (docError && isMissingPersonnelTables(docError)) ||
    (notesError && isMissingPersonnelTables(notesError)) ||
    (taskbooksError && isMissingPersonnelTables(taskbooksError)) ||
    (prereqError && isMissingPersonnelTables(prereqError)) ||
    (recognitionsError && isMissingPersonnelTables(recognitionsError)) ||
    (languagesError && isMissingPersonnelTables(languagesError)) ||
    (taskbookCatalogError &&
      (taskbookCatalogError.code === "PGRST205" ||
        taskbookCatalogError.message.includes("taskbook_types")))
  ) {
    return <PersonnelDatabaseSetup />;
  }
  if (certError) throw certError;
  if (certSectionError) throw certSectionError;
  if (emsLicensesError) throw emsLicensesError;
  if (emsClearanceLogError) throw emsClearanceLogError;
  if (qualificationsError) throw qualificationsError;
  if (docError) throw docError;
  if (notesError) throw notesError;
  if (taskbooksError) throw taskbooksError;
  if (prereqError) throw prereqError;
  if (recognitionsError) throw recognitionsError;
  if (languagesError) throw languagesError;
  if (trainingError) throw trainingError;
  if (ytdError) throw ytdError;
  if (catalogError) throw new Error(catalogError.message);
  if (taskbookCatalogError) throw new Error(taskbookCatalogError.message);
  if (emsCatalogError) throw new Error(emsCatalogError.message);
  if (emsClearanceCatalogError) throw new Error(emsClearanceCatalogError.message);
  if (rankCatalogError) throw new Error(rankCatalogError.message);
  if (permissionLevelsError) throw new Error(permissionLevelsError.message);

  const { data: allPrograms } = asAdmin
    ? await supabase.from("programs").select("id, title, status").order("title")
    : { data: [] as { id: string; title: string; status: string }[] };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{asAdmin ? "Edit personnel" : "Edit my file"}</h1>
          <p className="mt-2 text-muted-foreground">{personnelDisplayName(profile)}</p>
        </div>
        <PersonnelBackToFileButton personId={id} />
      </div>

      <PersonnelEditForm
        person={profile}
        viewerId={viewer.id}
        locations={(locations ?? []) as Location[]}
        supervisors={(supervisors ?? []) as Profile[]}
        certifications={certifications}
        certificationSections={certificationSections}
        emsLicenses={emsLicenses}
        emsClearanceLog={emsClearanceLog}
        emsLevelCatalog={emsLevelCatalog}
        emsClearanceCatalog={emsClearanceCatalog}
        rankCatalog={rankCatalog}
        qualifications={qualifications}
        qualificationCatalog={qualificationCatalog}
        documents={documents}
        notes={notes}
        taskbooks={taskbooks}
        taskbookCatalog={taskbookCatalog}
        prerequisiteChecks={prerequisiteChecks}
        recognitions={recognitions}
        languages={languages}
        programs={programs}
        allPrograms={allPrograms ?? []}
        ytdHours={ytdHours}
        ytdYear={ytdYear}
        permissionLevels={permissionLevels}
        pdipEnabled={pdipEnabled}
        canVerifyLanguages={canVerifyLanguages}
        asAdminEditor={asAdmin}
      />
    </div>
  );
}
