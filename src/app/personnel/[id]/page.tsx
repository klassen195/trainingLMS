import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, Users } from "lucide-react";
import { isAdmin, requireUserProfile } from "@/lib/auth";
import {
  fetchPersonnelCertifications,
  fetchPersonnelDocuments,
  fetchPersonnelNotes,
  fetchPersonnelProfile,
  fetchPersonnelTraining,
} from "@/lib/personnel";
import { isCertExpired, personnelDisplayName, personnelShiftLabel } from "@/lib/personnel-types";
import { roleLabel } from "@/lib/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingPersonnelTables,
  isMissingTrainingLmsTables,
} from "@/lib/supabase/errors";
import { PersonnelCertificationsPanel } from "@/components/PersonnelCertificationsPanel";
import { PersonnelDatabaseSetup } from "@/components/PersonnelDatabaseSetup";
import { PersonnelDocumentsPanel } from "@/components/PersonnelDocumentsPanel";
import {
  PersonnelFieldGrid,
  PersonnelFileLayout,
  PersonnelSectionEmpty,
  type PersonnelFileSection,
} from "@/components/PersonnelFileLayout";
import { PersonnelNotesPanel } from "@/components/PersonnelNotesPanel";
import { PersonnelTrainingPanel } from "@/components/PersonnelTrainingPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

export default async function PersonnelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUserProfile();
  const canManage = isAdmin(viewer);
  if (!canManage && viewer.id !== id) {
    redirect(`/personnel/${viewer.id}`);
  }

  const supabase = await createSupabaseServerClient();
  const { profile, error } = await fetchPersonnelProfile(supabase, id);

  if (isMissingTrainingLmsTables(error) || isMissingPersonnelTables(error)) {
    return <PersonnelDatabaseSetup />;
  }
  if (error) throw error;
  if (!profile) notFound();

  const [
    { rows: certifications, error: certError },
    { rows: documents, error: docError },
    { rows: notes, error: notesError },
    { programs, error: trainingError },
  ] = await Promise.all([
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

  const { data: allPrograms } = canManage
    ? await supabase.from("programs").select("id, title, status").order("title")
    : { data: [] as { id: string; title: string; status: string }[] };

  const expiredCount = certifications.filter((c) => isCertExpired(c.expires_on)).length;

  const demographicsRows = [
    { label: "Name", value: personnelDisplayName(profile) },
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

  const workRows = [
    { label: "Rank", value: profile.rank || "—" },
    { label: "Shift", value: personnelShiftLabel(profile.shift) },
    { label: "Employee #", value: profile.employee_number || "—" },
    { label: "Hire date", value: formatDate(profile.hire_date) },
    { label: "Station", value: profile.primary_location?.name || "—" },
    {
      label: "Supervisor",
      value: profile.supervisor ? personnelDisplayName(profile.supervisor) : "—",
    },
  ];

  const securityRows = [
    { label: "Permission level", value: roleLabel(profile.role) },
    { label: "System admin", value: profile.is_admin ? "Yes" : "No" },
  ];

  const sections: PersonnelFileSection[] = [
    {
      id: "demographics",
      label: "Demographics",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelFieldGrid rows={demographicsRows} />
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
      id: "recognitions",
      label: "Recognitions",
      content: <PersonnelSectionEmpty message="No recognitions yet" />,
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
        <Card>
          <CardContent className="pt-6">
            <PersonnelTrainingPanel
              profileId={id}
              programs={programs}
              allPrograms={allPrograms ?? []}
              canManage={canManage}
            />
          </CardContent>
        </Card>
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
          </div>
          {profile.email ? (
            <p className="text-lg text-muted-foreground">{profile.email}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.is_admin ? <Badge variant="outline">System admin</Badge> : null}
            {profile.rank ? <Badge variant="outline">{profile.rank}</Badge> : null}
            {expiredCount > 0 ? (
              <Badge className="bg-destructive text-destructive-foreground">
                {expiredCount} expired certification{expiredCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <>
              <Button asChild variant="secondary">
                <Link href="/personnel">Directory</Link>
              </Button>
              <Button asChild>
                <Link href={`/personnel/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <PersonnelFileLayout sections={sections} />
    </div>
  );
}
