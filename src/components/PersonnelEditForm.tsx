"use client";

import { useState, useTransition } from "react";
import { updatePersonnelProfile } from "@/app/personnel/actions";
import type { Location } from "@/lib/locations-types";
import type {
  PersonnelCertification,
  PersonnelDocument,
  PersonnelNote,
  PersonnelProfile,
  PersonnelShift,
  PersonnelTrainingProgram,
} from "@/lib/personnel-types";
import {
  permissionLevels,
  personnelDisplayName,
  personnelShifts,
  personnelShiftLabel,
} from "@/lib/personnel-types";
import type { Profile, UserRole } from "@/lib/training-lms-types";
import { fireRanks, roleLabel } from "@/lib/labels";
import { PersonnelCertificationsPanel } from "@/components/PersonnelCertificationsPanel";
import { PersonnelDocumentsPanel } from "@/components/PersonnelDocumentsPanel";
import {
  PersonnelFileLayout,
  PersonnelSectionEmpty,
  type PersonnelFileSection,
} from "@/components/PersonnelFileLayout";
import { PersonnelNotesPanel } from "@/components/PersonnelNotesPanel";
import { PersonnelTrainingPanel } from "@/components/PersonnelTrainingPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function PersonnelEditForm({
  person,
  locations,
  supervisors,
  certifications,
  documents,
  notes,
  programs,
  allPrograms,
}: {
  person: PersonnelProfile;
  locations: Location[];
  supervisors: Profile[];
  certifications: PersonnelCertification[];
  documents: PersonnelDocument[];
  notes: PersonnelNote[];
  programs: PersonnelTrainingProgram[];
  allPrograms: { id: string; title: string; status: string }[];
}) {
  const [displayName, setDisplayName] = useState(person.display_name ?? "");
  const [rank, setRank] = useState(person.rank ?? "");
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
  const [error, setError] = useState<string | null>(null);

  const rankOptions =
    person.rank && !(fireRanks as readonly string[]).includes(person.rank)
      ? [...fireRanks, person.rank]
      : fireRanks;

  function saveProfile() {
    setError(null);
    startTransition(async () => {
      try {
        await updatePersonnelProfile({
          userId: person.id,
          displayName,
          rank: rank || null,
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
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel htmlFor="displayName">Name</FieldLabel>
                <Input
                  id="displayName"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
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
                <Select id="rank" value={rank} onChange={(e) => setRank(e.target.value)}>
                  <option value="">Not set</option>
                  {rankOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
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
                <FieldLabel htmlFor="supervisor">Supervisor</FieldLabel>
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
      id: "recognitions",
      label: "Recognitions",
      content: <PersonnelSectionEmpty message="No recognitions yet" />,
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
