import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  fetchPersonnelCertifications,
  fetchPersonnelDocuments,
  fetchPersonnelNotes,
  fetchPersonnelProfile,
  fetchPersonnelTraining,
} from "@/lib/personnel";
import { personnelDisplayName } from "@/lib/personnel-types";
import type { Profile } from "@/lib/training-lms-types";
import { LOCATION_SELECT, type Location } from "@/lib/locations-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
} from "@/lib/supabase/errors";
import { PersonnelDatabaseSetup } from "@/components/PersonnelDatabaseSetup";
import { PersonnelEditForm } from "@/components/PersonnelEditForm";
import { Button } from "@/components/ui/Button";

export default async function PersonnelEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
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
    { rows: documents, error: docError },
    { rows: notes, error: notesError },
    { programs, error: trainingError },
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
        "id, display_name, email, rank, role, is_admin, created_at, employee_number, job_title, department, phone, hire_date, shift, home_address, emergency_contacts, hr_info, primary_location_id, supervisor_id"
      )
      .order("display_name", { ascending: true, nullsFirst: false }),
    fetchPersonnelCertifications(supabase, id),
    fetchPersonnelDocuments(supabase, id),
    fetchPersonnelNotes(supabase, id),
    fetchPersonnelTraining(supabase, id),
  ]);

  if (
    (certError && isMissingPersonnelTables(certError)) ||
    (docError && isMissingPersonnelTables(docError)) ||
    (notesError && isMissingPersonnelTables(notesError))
  ) {
    return <PersonnelDatabaseSetup />;
  }
  if (certError) throw certError;
  if (docError) throw docError;
  if (notesError) throw notesError;
  if (trainingError) throw trainingError;

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
        <Button asChild variant="secondary">
          <Link href={`/personnel/${id}`}>Back to file</Link>
        </Button>
      </div>

      <PersonnelEditForm
        person={profile}
        locations={(locations ?? []) as Location[]}
        supervisors={(supervisors ?? []) as Profile[]}
        certifications={certifications}
        documents={documents}
        notes={notes}
        programs={programs}
        allPrograms={allPrograms ?? []}
      />
    </div>
  );
}
