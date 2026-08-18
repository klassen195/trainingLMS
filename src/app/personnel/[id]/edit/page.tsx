import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  fetchPersonnelCertifications,
  fetchPersonnelDocuments,
  fetchPersonnelEmsLicenses,
  fetchPersonnelNotes,
  fetchPersonnelProfile,
  fetchPersonnelQualifications,
  fetchPersonnelRecognitions,
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
import { listQualifications } from "@/lib/qualifications";
import { listPermissionLevels } from "@/lib/permission-levels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingEmsLevelsTable,
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
} from "@/lib/supabase/errors";
import { PersonnelDatabaseSetup } from "@/components/PersonnelDatabaseSetup";
import { PersonnelEditForm } from "@/components/PersonnelEditForm";
import { PersonnelBackToFileButton } from "@/components/PersonnelSectionNavButtons";

export default async function PersonnelEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { profile, error } = await fetchPersonnelProfile(supabase, id);
  if (isMissingTrainingLmsTables(error) || isMissingPersonnelTables(error)) {
    return <PersonnelDatabaseSetup />;
  }
  if (error) throw error;
  if (!profile) notFound();

  const [
    { data: locations },
    { data: supervisors },
    { rows: certifications, error: certError },
    { rows: emsLicenses, error: emsLicensesError },
    { rows: qualifications, error: qualificationsError },
    { rows: documents, error: docError },
    { rows: notes, error: notesError },
    { rows: taskbooks, error: taskbooksError },
    { rows: prerequisiteChecks, error: prereqError },
    { rows: recognitions, error: recognitionsError },
    { programs, error: trainingError },
    { hours: ytdHours, year: ytdYear, error: ytdError },
    { rows: qualificationCatalog, error: catalogError },
    { rows: emsLevelCatalog, error: emsCatalogError },
    { rows: emsClearanceCatalog, error: emsClearanceCatalogError },
    { rows: permissionLevels, error: permissionLevelsError },
  ] = await Promise.all([
    supabase
      .from("locations")
      .select(LOCATION_SELECT)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("profiles")
      .select(
        "id, display_name, first_name, last_name, email, rank, swing_up, rank_promoted_on, is_admin, is_active, invited_at, created_at, employee_number, job_title, department, phone, hire_date, shift, home_address, emergency_contacts, hr_info, primary_location_id, supervisor_id"
      )
      .or(
        profile.supervisor_id
          ? `is_active.eq.true,id.eq.${profile.supervisor_id}`
          : "is_active.eq.true"
      )
      .order("display_name", { ascending: true, nullsFirst: false }),
    fetchPersonnelCertifications(supabase, id),
    fetchPersonnelEmsLicenses(supabase, id),
    fetchPersonnelQualifications(supabase, id),
    fetchPersonnelDocuments(supabase, id),
    fetchPersonnelNotes(supabase, id),
    fetchPersonnelTaskbooks(supabase, id),
    fetchPersonnelTaskbookPrerequisiteChecks(supabase, id),
    fetchPersonnelRecognitions(supabase, id),
    fetchPersonnelTraining(supabase, id),
    fetchPersonnelYtdTrainingHours(supabase, id),
    listQualifications(supabase, { activeOnly: true }),
    listEmsLevels(supabase, { activeOnly: true }),
    listEmsClearanceLevels(supabase, { activeOnly: true }),
    listPermissionLevels(supabase),
  ]);

  if (
    (certError && isMissingPersonnelTables(certError)) ||
    (emsLicensesError &&
      (isMissingPersonnelTables(emsLicensesError) || isMissingEmsLevelsTable(emsLicensesError))) ||
    (qualificationsError && isMissingPersonnelTables(qualificationsError)) ||
    (docError && isMissingPersonnelTables(docError)) ||
    (notesError && isMissingPersonnelTables(notesError)) ||
    (taskbooksError && isMissingPersonnelTables(taskbooksError)) ||
    (prereqError && isMissingPersonnelTables(prereqError)) ||
    (recognitionsError && isMissingPersonnelTables(recognitionsError))
  ) {
    return <PersonnelDatabaseSetup />;
  }
  if (certError) throw certError;
  if (emsLicensesError) throw emsLicensesError;
  if (qualificationsError) throw qualificationsError;
  if (docError) throw docError;
  if (notesError) throw notesError;
  if (taskbooksError) throw taskbooksError;
  if (prereqError) throw prereqError;
  if (recognitionsError) throw recognitionsError;
  if (trainingError) throw trainingError;
  if (ytdError) throw ytdError;
  if (catalogError) throw new Error(catalogError.message);
  if (emsCatalogError) throw new Error(emsCatalogError.message);
  if (emsClearanceCatalogError) throw new Error(emsClearanceCatalogError.message);
  if (permissionLevelsError) throw new Error(permissionLevelsError.message);

  const { data: allPrograms } = await supabase
    .from("programs")
    .select("id, title, status")
    .order("title");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Edit personnel</h1>
          <p className="mt-2 text-muted-foreground">{personnelDisplayName(profile)}</p>
        </div>
        <PersonnelBackToFileButton personId={id} />
      </div>

      <PersonnelEditForm
        person={profile}
        viewerId={admin.id}
        locations={(locations ?? []) as Location[]}
        supervisors={(supervisors ?? []) as Profile[]}
        certifications={certifications}
        emsLicenses={emsLicenses}
        emsLevelCatalog={emsLevelCatalog}
        emsClearanceCatalog={emsClearanceCatalog}
        qualifications={qualifications}
        qualificationCatalog={qualificationCatalog}
        documents={documents}
        notes={notes}
        taskbooks={taskbooks}
        prerequisiteChecks={prerequisiteChecks}
        recognitions={recognitions}
        programs={programs}
        allPrograms={allPrograms ?? []}
        ytdHours={ytdHours}
        ytdYear={ytdYear}
        permissionLevels={permissionLevels}
      />
    </div>
  );
}
