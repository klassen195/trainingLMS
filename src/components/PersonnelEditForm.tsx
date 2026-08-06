"use client";

import { useState, useTransition } from "react";
import { updatePersonnelProfile, setPersonnelActive, deletePersonnelMember } from "@/app/personnel/actions";
import type { Location } from "@/lib/locations-types";
import type {
  PersonnelCertification,
  PersonnelDocument,
  PersonnelNote,
  PersonnelProfile,
  PersonnelRecognition,
  PersonnelShift,
  PersonnelTaskbook,
  PersonnelTaskbookPrerequisiteCheck,
  PersonnelTrainingProgram,
} from "@/lib/personnel-types";
import {
  permissionLevels,
  personnelDisplayName,
  personnelShifts,
  personnelShiftLabel,
  isRankOnProbation,
  normalizeSwingUpRanks,
} from "@/lib/personnel-types";
import type { Profile, UserRole } from "@/lib/training-lms-types";
import { fireRanks, swingUpRanks, roleLabel } from "@/lib/labels";
import { PersonnelCertificationsPanel } from "@/components/PersonnelCertificationsPanel";
import { PersonnelDocumentsPanel } from "@/components/PersonnelDocumentsPanel";
import {
  PersonnelFileLayout,
  type PersonnelFileSection,
} from "@/components/PersonnelFileLayout";
import { PersonnelNotesPanel } from "@/components/PersonnelNotesPanel";
import { PersonnelRecognitionsPanel } from "@/components/PersonnelRecognitionsPanel";
import { PersonnelTaskbooksPanel } from "@/components/PersonnelTaskbooksPanel";
import { PersonnelTrainingPanel } from "@/components/PersonnelTrainingPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function PersonnelEditForm({
  person,
  viewerId,
  locations,
  supervisors,
  certifications,
  documents,
  notes,
  taskbooks,
  prerequisiteChecks = [],
  recognitions = [],
  programs,
  allPrograms,
}: {
  person: PersonnelProfile;
  viewerId: string;
  locations: Location[];
  supervisors: Profile[];
  certifications: PersonnelCertification[];
  documents: PersonnelDocument[];
  notes: PersonnelNote[];
  taskbooks: PersonnelTaskbook[];
  prerequisiteChecks?: PersonnelTaskbookPrerequisiteCheck[];
  recognitions?: PersonnelRecognition[];
  programs: PersonnelTrainingProgram[];
  allPrograms: { id: string; title: string; status: string }[];
}) {
  const [firstName, setFirstName] = useState(person.first_name ?? "");
  const [lastName, setLastName] = useState(person.last_name ?? "");
  const [rank, setRank] = useState(person.rank ?? "");
  const [swingUp, setSwingUp] = useState<string[]>(() => normalizeSwingUpRanks(person.swing_up));
  const [rankPromotedOn, setRankPromotedOn] = useState(person.rank_promoted_on ?? "");
  const [employeeNumber, setEmployeeNumber] = useState(person.employee_number ?? "");
  const [phone, setPhone] = useState(person.phone ?? "");
  const [hireDate, setHireDate] = useState(person.hire_date ?? "");
  const [shift, setShift] = useState<PersonnelShift | "">(person.shift ?? "");
  const [homeAddress, setHomeAddress] = useState(person.home_address ?? "");
  const [emergencyContacts, setEmergencyContacts] = useState(person.emergency_contacts ?? "");
  const [hrInfo, setHrInfo] = useState(person.hr_info ?? "");
  const [primaryLocationId, setPrimaryLocationId] = useState(person.primary_location_id ?? "");
  const [supervisorId, setSupervisorId] = useState(person.supervisor_id ?? "");
  const [role, setRole] = useState<UserRole>(person.role);
  const [isAdmin, setIsAdmin] = useState(person.is_admin);
  const [pending, startTransition] = useTransition();
  const [accountPending, startAccountTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const isSelf = viewerId === person.id;
  const isActive = person.is_active !== false;

  const rankOptions =
    person.rank && !(fireRanks as readonly string[]).includes(person.rank)
      ? [...fireRanks, person.rank]
      : fireRanks;
  const swingUpOptions = swingUpRanks;

  function saveProfile() {
    setError(null);
    startTransition(async () => {
      try {
        await updatePersonnelProfile({
          userId: person.id,
          firstName,
          lastName,
          rank: rank || null,
          swingUp,
          rankPromotedOn: rankPromotedOn || null,
          employeeNumber: employeeNumber || null,
          phone: phone || null,
          hireDate: hireDate || null,
          shift: shift || null,
          homeAddress: homeAddress || null,
          emergencyContacts: emergencyContacts || null,
          hrInfo: hrInfo || null,
          primaryLocationId: primaryLocationId || null,
          supervisorId: supervisorId || null,
          role,
          isAdmin,
          section: typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : null,
        });
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function runAccountAction(action: () => Promise<void>, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;
    setAccountError(null);
    startAccountTransition(async () => {
      try {
        await action();
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        setAccountError(err instanceof Error ? err.message : "Account action failed");
      }
    });
  }

  function renderSaveBar() {
    return (
      <div className="space-y-3 border-t pt-4">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button type="button" disabled={pending} onClick={saveProfile}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    );
  }

  const sections: PersonnelFileSection[] = [
    {
      id: "demographics",
      label: "Demographics",
      content: (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" value={person.email ?? "—"} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <Input
                  id="firstName"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                <Input
                  id="lastName"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel htmlFor="homeAddress">Home address</FieldLabel>
                <Textarea
                  id="homeAddress"
                  rows={3}
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel htmlFor="emergencyContacts">Emergency contact(s)</FieldLabel>
                <Textarea
                  id="emergencyContacts"
                  rows={3}
                  placeholder="Name, relationship, phone…"
                  value={emergencyContacts}
                  onChange={(e) => setEmergencyContacts(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel htmlFor="hrInfo">HR info</FieldLabel>
                <Textarea
                  id="hrInfo"
                  rows={3}
                  value={hrInfo}
                  onChange={(e) => setHrInfo(e.target.value)}
                />
              </div>
            </div>
            {renderSaveBar()}
          </CardContent>
        </Card>
      ),
    },
    {
      id: "work",
      label: "Work",
      content: (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="rank">Rank</FieldLabel>
                <Select
                  id="rank"
                  value={rank}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRank(next);
                    if (next && next !== (person.rank ?? "")) {
                      const today = new Date().toISOString().slice(0, 10);
                      setRankPromotedOn(today);
                    }
                    if (!next) setRankPromotedOn("");
                  }}
                >
                  <option value="">Not set</option>
                  {rankOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
                {rank && isRankOnProbation(rankPromotedOn || null) ? (
                  <p className="text-xs text-amber-800">On probation (first year in rank)</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel>Swing up</FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Select every rank this person is qualified to work above their promoted rank.
                </p>
                <div className="flex flex-wrap gap-2">
                  {swingUpOptions.map((option) => {
                    const checked = swingUp.includes(option);
                    return (
                      <label
                        key={option}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border"
                          checked={checked}
                          onChange={(e) => {
                            setSwingUp((prev) =>
                              e.target.checked
                                ? [...prev, option]
                                : prev.filter((r) => r !== option)
                            );
                          }}
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="rankPromotedOn">Promoted to this rank</FieldLabel>
                <Input
                  id="rankPromotedOn"
                  type="date"
                  value={rankPromotedOn}
                  onChange={(e) => setRankPromotedOn(e.target.value)}
                  disabled={!rank}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="shift">Shift</FieldLabel>
                <Select
                  id="shift"
                  value={shift}
                  onChange={(e) => setShift(e.target.value as PersonnelShift | "")}
                >
                  <option value="">Not set</option>
                  {personnelShifts.map((option) => (
                    <option key={option} value={option}>
                      {personnelShiftLabel(option)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="employeeNumber">Employee number</FieldLabel>
                <Input
                  id="employeeNumber"
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="hireDate">Hire date</FieldLabel>
                <Input
                  id="hireDate"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="location">Primary station / location</FieldLabel>
                <Select
                  id="location"
                  value={primaryLocationId}
                  onChange={(e) => setPrimaryLocationId(e.target.value)}
                >
                  <option value="">Not set</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="supervisor">Supervisor (Captain)</FieldLabel>
                <Select
                  id="supervisor"
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                >
                  <option value="">Not set</option>
                  {supervisors
                    .filter((s) => s.id !== person.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {personnelDisplayName(s)}
                      </option>
                    ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Captains are assigned here. Battalion Chiefs automatically supervise everyone on
                  their shift.
                </p>
              </div>
            </div>
            {renderSaveBar()}
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
              profileId={person.id}
              certifications={certifications}
              canManage
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
          profileId={person.id}
          taskbooks={taskbooks}
          prerequisiteChecks={prerequisiteChecks}
          canRequest={false}
          canCheckPrerequisites={viewerId === person.id}
          canDecide
          canIssue
          hasSupervisor={Boolean(person.supervisor_id)}
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
              profileId={person.id}
              recognitions={recognitions}
              canManage
            />
          </CardContent>
        </Card>
      ),
    },
    {
      id: "security",
      label: "Security",
      content: (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <FieldLabel>Permission level</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {permissionLevels.map((level) => (
                    <Button
                      key={level}
                      type="button"
                      size="sm"
                      variant={role === level ? "primary" : "secondary"}
                      onClick={() => setRole(level)}
                    >
                      {roleLabel(level)}
                    </Button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                />
                <span>
                  <span className="font-medium">System admin</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Full access to users, locations, checklists, and inventory management.
                  </span>
                </span>
              </label>
            </div>
            {renderSaveBar()}

            <div className="space-y-3 border-t pt-4">
              <div>
                <p className="text-sm font-medium">Account status</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isActive
                    ? "This account can sign in and appears in active personnel pickers."
                    : "This account is deactivated. They cannot sign in until reactivated."}
                </p>
              </div>
              {isSelf ? (
                <p className="text-sm text-muted-foreground">
                  You cannot deactivate or delete your own account.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={accountPending}
                      onClick={() =>
                        runAccountAction(
                          () =>
                            setPersonnelActive({
                              userId: person.id,
                              isActive: false,
                              section: window.location.hash.replace(/^#/, "") || null,
                            }),
                          `Deactivate ${personnelDisplayName(person)}? They will be signed out and cannot log in until reactivated.`
                        )
                      }
                    >
                      {accountPending ? "Working…" : "Deactivate account"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={accountPending}
                      onClick={() =>
                        runAccountAction(
                          () =>
                            setPersonnelActive({
                              userId: person.id,
                              isActive: true,
                              section: window.location.hash.replace(/^#/, "") || null,
                            }),
                          `Reactivate ${personnelDisplayName(person)}?`
                        )
                      }
                    >
                      {accountPending ? "Working…" : "Reactivate account"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={accountPending}
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      runAccountAction(
                        () => deletePersonnelMember({ userId: person.id }),
                        `Permanently delete ${personnelDisplayName(person)}? This cannot be undone. Prefer deactivate if they have training or maintenance history.`
                      )
                    }
                  >
                    {accountPending ? "Working…" : "Delete permanently"}
                  </Button>
                </div>
              )}
              {accountError ? <p className="text-sm text-red-700">{accountError}</p> : null}
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: "training",
      label: "Training",
      content: (
        <Card>
          <CardContent className="pt-6">
            <PersonnelTrainingPanel
              profileId={person.id}
              programs={programs}
              allPrograms={allPrograms}
              canManage
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
            <PersonnelDocumentsPanel profileId={person.id} documents={documents} canManage />
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
            <PersonnelNotesPanel profileId={person.id} notes={notes} canManage />
          </CardContent>
        </Card>
      ),
    },
  ];

  return <PersonnelFileLayout sections={sections} />;
}
