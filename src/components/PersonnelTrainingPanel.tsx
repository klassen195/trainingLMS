"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  assignProgramToUser,
  unassignProgramFromUser,
} from "@/app/personnel/actions";
import type { PersonnelTrainingProgram } from "@/lib/personnel-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Select } from "@/components/ui/Input";

type ProgramOption = { id: string; title: string; status: string };

export function PersonnelTrainingPanel({
  profileId,
  programs,
  allPrograms,
  canManage,
}: {
  profileId: string;
  programs: PersonnelTrainingProgram[];
  allPrograms: ProgramOption[];
  canManage: boolean;
}) {
  const enrolledIds = new Set(programs.map((p) => p.program_id).filter((id) => id !== "_unlinked"));
  const assignable = allPrograms.filter((p) => !enrolledIds.has(p.id));

  return (
    <div className="space-y-4">
      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No training enrollments.</p>
      ) : (
        <ul className="space-y-3">
          {programs.map((program) => (
            <li key={program.program_id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {program.program_id === "_unlinked" ? (
                    <p className="font-medium">{program.title}</p>
                  ) : (
                    <Link
                      href={`/programs/${program.program_id}`}
                      className="font-medium hover:underline"
                    >
                      {program.title}
                    </Link>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {program.completed_count} of {program.enrolled_count} modules completed
                  </p>
                </div>
                {canManage && program.program_id !== "_unlinked" ? (
                  <UnassignProgramButton userId={profileId} programId={program.program_id} />
                ) : null}
              </div>
              <ul className="mt-3 space-y-1 border-t pt-3 text-sm">
                {program.modules.map((mod) => (
                  <li key={mod.module_id} className="flex justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{mod.title}</span>
                    <span className="shrink-0">
                      {mod.completed_at ? "Completed" : "In progress"}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <AssignProgramForm userId={profileId} assignable={assignable} />
      ) : null}
    </div>
  );
}

function UnassignProgramButton({ userId, programId }: { userId: string; programId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove all module enrollments for this program?")) return;
        startTransition(async () => {
          await unassignProgramFromUser({ userId, programId });
        });
      }}
    >
      {pending ? "Removing…" : "Unassign"}
    </Button>
  );
}

function AssignProgramForm({
  userId,
  assignable,
}: {
  userId: string;
  assignable: ProgramOption[];
}) {
  const [programId, setProgramId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (assignable.length === 0) {
    return <p className="text-sm text-muted-foreground">All programs are already assigned.</p>;
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!programId) return;
        setError(null);
        startTransition(async () => {
          try {
            await assignProgramToUser({ userId, programId });
            setProgramId("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to assign");
          }
        });
      }}
    >
      <div className="min-w-[12rem] flex-1 space-y-2">
        <FieldLabel htmlFor="assign-program">Assign program</FieldLabel>
        <Select
          id="assign-program"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          required
        >
          <option value="">Select a program…</option>
          {assignable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.status !== "published" ? ` (${p.status})` : ""}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={pending || !programId}>
        {pending ? "Assigning…" : "Assign"}
      </Button>
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
