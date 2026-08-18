import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { isAdmin, requireUserProfile } from "@/lib/auth";
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
  fetchPendingTaskbookApprovals,
  fetchPersonnelTraining,
  fetchPersonnelYtdTrainingHours,
  personHasSupervisorCoverage,
} from "@/lib/personnel";
import {
  collectExpiringPersonnelItems,
  isCertExpired,
  isRankOnProbation,
  formatSwingUpRanks,
  personnelDisplayName,
  personnelShiftLabel,
  isPersonnelSupervisorOf,
  familyDateEventLabel,
  familyDateTitle,
  listFamilyDates,
} from "@/lib/personnel-types";
import { permissionLevelName } from "@/lib/permission-levels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listEmsClearanceLevels } from "@/lib/ems-clearance-levels";
import { listEmsLevels } from "@/lib/ems-levels";
import { PersonnelCertificationsPanel } from "@/components/PersonnelCertificationsPanel";
import { PersonnelDatabaseSetup } from "@/components/PersonnelDatabaseSetup";
import { PersonnelDocumentsPanel } from "@/components/PersonnelDocumentsPanel";
import { PersonnelEmsPanel } from "@/components/PersonnelEmsPanel";
import { PersonnelExpiringNotifications } from "@/components/PersonnelExpiringNotifications";
import {
  PersonnelFieldGrid,
  PersonnelFileLayout,
  type PersonnelFileSection,
} from "@/components/PersonnelFileLayout";
import { PersonnelNotesPanel } from "@/components/PersonnelNotesPanel";
import { PersonnelQualificationsPanel } from "@/components/PersonnelQualificationsPanel";
import { PersonnelRecognitionsPanel } from "@/components/PersonnelRecognitionsPanel";
import { PersonnelTaskbooksPanel } from "@/components/PersonnelTaskbooksPanel";
import { PersonnelTrainingPanel } from "@/components/PersonnelTrainingPanel";
import { PersonnelDirectoryButton, PersonnelEditButton } from "@/components/PersonnelSectionNavButtons";
import { SendPersonnelInviteButton } from "@/components/SendPersonnelInviteButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { formatDate } from "@/lib/dates";
import {
  isMissingEmsLevelsTable,
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
} from "@/lib/supabase/errors";
import { listQualifications } from "@/lib/qualifications";

export default async function PersonnelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUserProfile();
  const canManage = isAdmin(viewer);
  const isSelf = viewer.id === id;

  const supabase = await createSupabaseServerClient();
  const { profile, error } = await fetchPersonnelProfile(supabase, id);

  if (isMissingTrainingLmsTables(error) || isMissingPersonnelTables(error)) {
    return <PersonnelDatabaseSetup />;
  }
  if (error) throw error;
  if (!profile) notFound();

  const isSupervisorOfPerson = isPersonnelSupervisorOf(viewer, profile);
  if (!canManage && !isSelf && !isSupervisorOfPerson) {
    redirect(`/personnel/${viewer.id}`);
  }

  const [
    { rows: certifications, error: certError },
    { rows: emsLicenses, error: emsLicensesError },
    { rows: qualifications, error: qualificationsError },
    { rows: documents, error: docError },
    { rows: notes, error: notesError },
    { rows: taskbooks, error: taskbooksError },
    { rows: prerequisiteChecks, error: prereqError },
    { rows: recognitions, error: recognitionsError },
    { rows: pendingApprovals, error: pendingError },
    { programs, error: trainingError },
    { hours: ytdHours, year: ytdYear, error: ytdError },
    { hasSupervisor, error: supervisorCoverageError },
    { rows: qualificationCatalog, error: catalogError },
    { rows: emsLevelCatalog, error: emsCatalogError },
    { rows: emsClearanceCatalog, error: emsClearanceCatalogError },
  ] = await Promise.all([
    fetchPersonnelCertifications(supabase, id),
    fetchPersonnelEmsLicenses(supabase, id),
    fetchPersonnelQualifications(supabase, id),
    fetchPersonnelDocuments(supabase, id),
    fetchPersonnelNotes(supabase, id),
    fetchPersonnelTaskbooks(supabase, id),
    fetchPersonnelTaskbookPrerequisiteChecks(supabase, id),
    fetchPersonnelRecognitions(supabase, id),
    isSelf
      ? fetchPendingTaskbookApprovals(supabase, viewer)
      : Promise.resolve({ rows: [], error: null }),
    fetchPersonnelTraining(supabase, id),
    fetchPersonnelYtdTrainingHours(supabase, id),
    personHasSupervisorCoverage(supabase, profile),
    listQualifications(supabase, { activeOnly: true }),
    listEmsLevels(supabase, { activeOnly: true }),
    listEmsClearanceLevels(supabase, { activeOnly: true }),
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
    (recognitionsError && isMissingPersonnelTables(recognitionsError)) ||
    (pendingError && isMissingPersonnelTables(pendingError)) ||
    (supervisorCoverageError && isMissingPersonnelTables(supervisorCoverageError))
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
  if (pendingError) throw pendingError;
  if (trainingError) throw trainingError;
  if (ytdError) throw ytdError;
  if (supervisorCoverageError) throw supervisorCoverageError;
  if (catalogError) throw new Error(catalogError.message);
  if (emsCatalogError) throw new Error(emsCatalogError.message);
  if (emsClearanceCatalogError) throw new Error(emsClearanceCatalogError.message);

  const { data: allPrograms } = canManage
    ? await supabase.from("programs").select("id, title, status").order("title")
    : { data: [] as { id: string; title: string; status: string }[] };

  const expiredCount = certifications.filter((c) => isCertExpired(c.expires_on)).length;
  const expiringItems = collectExpiringPersonnelItems(
    { certifications, emsLicenses, qualifications },
    { withinMonths: 6 }
  );

  const demographicsRows = [
    { label: "First name", value: profile.first_name?.trim() || "—" },
    { label: "Last name", value: profile.last_name?.trim() || "—" },
    { label: "Email", value: profile.email || "—" },
    { label: "Phone", value: profile.phone || "—" },
    { label: "Home address", value: profile.home_address || "—", fullWidth: true },
    {
      label: "Emergency contact(s)",
      value: profile.emergency_contacts || "—",
      fullWidth: true,
    },
    { label: "HR info", value: profile.hr_info || "—", fullWidth: true },
  ];

  const familyDates = listFamilyDates(profile);

  const onProbation = isRankOnProbation(profile.rank_promoted_on);

  const workRows = [
    {
      label: "Rank",
      value: (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{profile.rank || "—"}</span>
          {profile.rank && onProbation ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              Probation
            </Badge>
          ) : null}
        </span>
      ),
    },
    { label: "Swing up", value: formatSwingUpRanks(profile.swing_up) },
    {
      label: "Promoted to this rank",
      value: formatDate(profile.rank_promoted_on),
    },
    { label: "Shift", value: personnelShiftLabel(profile.shift) },
    { label: "Employee #", value: profile.employee_number || "—" },
    { label: "Hire date", value: formatDate(profile.hire_date) },
    { label: "Station", value: profile.primary_location?.name || "—" },
    {
      label: "Supervisor (Captain)",
      value: profile.supervisor ? personnelDisplayName(profile.supervisor) : "—",
    },
  ];

  const securityRows = [
    { label: "Permission levels", value: permissionLevelName(profile.permission_levels) },
    { label: "System admin", value: profile.is_admin ? "Yes" : "No" },
  ];

  const sections: PersonnelFileSection[] = [
    {
      id: "demographics",
      label: "Demographics",
      content: (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <PersonnelFieldGrid rows={demographicsRows} />
            <div className="space-y-3 border-t pt-6">
              <h3 className="text-sm font-medium">Family</h3>
              {familyDates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No family info recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {familyDates.map((item) => {
                    const familyRole = familyDateEventLabel(item);
                    const dateLabel = item.date ? formatDate(item.date) : null;
                    // When the title is already the role (no name), don't repeat it in the detail.
                    const detailParts =
                      item.name || item.role === "anniversary"
                        ? [item.name ? familyRole : null, dateLabel]
                        : [dateLabel];
                    const detail = detailParts.filter(Boolean).join(" · ");
                    return (
                      <li key={`${item.role}-${item.name ?? ""}-${item.date ?? ""}`}>
                        <p className="text-sm font-medium">{familyDateTitle(item)}</p>
                        {detail ? (
                          <p className="text-sm text-muted-foreground">{detail}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: "work",
      label: "Work",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelFieldGrid rows={workRows} />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "ems",
      label: "EMS",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelEmsPanel
              profileId={id}
              licenses={emsLicenses}
              licenseCatalog={emsLevelCatalog}
              clearanceCatalog={emsClearanceCatalog}
              clearedLevelId={profile.ems_cleared_level_id}
              clearedLevel={profile.ems_cleared_level}
              canManage={canManage}
            />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "certifications",
      label: "Certifications",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelCertificationsPanel
              profileId={id}
              certifications={certifications}
              canManage={canManage}
            />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "qualifications",
      label: "Qualifications",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelQualificationsPanel
              profileId={id}
              qualifications={qualifications}
              catalog={qualificationCatalog}
              canManage={canManage}
            />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "taskbooks",
      label: "Taskbooks",
      content: (
        <PersonnelTaskbooksPanel
          profileId={id}
          taskbooks={taskbooks}
          prerequisiteChecks={prerequisiteChecks}
          pendingApprovals={isSelf ? pendingApprovals : []}
          canRequest={isSelf}
          canCheckPrerequisites={isSelf}
          canDecide={canManage || isSupervisorOfPerson}
          canIssue={canManage}
          hasSupervisor={hasSupervisor}
        />
      ),
    },
    {
      id: "recognitions",
      label: "Recognitions",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelRecognitionsPanel
              profileId={id}
              recognitions={recognitions}
              canManage={canManage}
            />
          </CardContent>
        </Card>
      ),
    },
    ...(canManage
      ? [
          {
            id: "security" as const,
            label: "Security",
            content: (
              <Card>
                <CardContent className="pt-6">
                  <PersonnelFieldGrid rows={securityRows} />
                </CardContent>
              </Card>
            ),
          },
        ]
      : []),
    {
      id: "training",
      label: "Training",
      content: (
        <PersonnelTrainingPanel
          profileId={id}
          programs={programs}
          allPrograms={allPrograms ?? []}
          canManage={canManage}
          ytdHours={ytdHours}
          ytdYear={ytdYear}
        />
      ),
    },
    {
      id: "documents",
      label: "Documents",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelDocumentsPanel
              profileId={id}
              documents={documents}
              canManage={canManage}
            />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "notes",
      label: "Notes",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelNotesPanel profileId={id} notes={notes} canManage={canManage} />
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{personnelDisplayName(profile)}</h1>
            <PersonnelExpiringNotifications items={expiringItems} withinMonths={6} />
          </div>
          {profile.email ? (
            <p className="text-lg text-muted-foreground">{profile.email}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.is_active === false ? <Badge variant="outline">Inactive</Badge> : null}
            {!profile.invited_at ? <Badge variant="outline">Not invited</Badge> : null}
            {profile.is_admin ? <Badge variant="outline">System admin</Badge> : null}
            {profile.rank ? <Badge variant="outline">{profile.rank}</Badge> : null}
            {profile.rank && onProbation ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                Probation
              </Badge>
            ) : null}
            {expiredCount > 0 ? (
              <Badge className="bg-destructive text-destructive-foreground">
                {expiredCount} expired certification{expiredCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PersonnelDirectoryButton />
          {canManage ? (
            <>
              {profile.is_active !== false && profile.email ? (
                <SendPersonnelInviteButton
                  userId={profile.id}
                  hasBeenInvited={Boolean(profile.invited_at)}
                />
              ) : null}
              <PersonnelEditButton personId={id} />
            </>
          ) : null}
        </div>
      </div>

      <PersonnelFileLayout sections={sections} />
    </div>
  );
}
