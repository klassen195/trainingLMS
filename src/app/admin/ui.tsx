"use client";

import { useState, useTransition } from "react";
import { updateUserProfile, updateUserRole } from "@/app/actions";
import type { UserRole } from "@/lib/training-lms-types";
import { fireRanks, roleLabel } from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

const roles: UserRole[] = ["learner", "instructor", "admin"];

type AdminUserFormProps = {
  userId: string;
  email: string | null;
  displayName: string | null;
  rank: string | null;
  currentRole: UserRole;
};

export function AdminUserForm({
  userId,
  email,
  displayName,
  rank,
  currentRole,
}: AdminUserFormProps) {
  const [name, setName] = useState(displayName ?? "");
  const [selectedRank, setSelectedRank] = useState(rank ?? "");
  const [profilePending, startProfileTransition] = useTransition();
  const [rolePending, startRoleTransition] = useTransition();
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const rankOptions =
    rank && !(fireRanks as readonly string[]).includes(rank) ? [...fireRanks, rank] : fireRanks;

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <form
        className="min-w-0 flex-1 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setProfileError(null);
          setProfileSaved(false);
          startProfileTransition(async () => {
            try {
              await updateUserProfile({
                userId,
                displayName: name,
                rank: selectedRank || null,
              });
              setProfileSaved(true);
            } catch (err) {
              setProfileError(err instanceof Error ? err.message : "Failed to save profile");
            }
          });
        }}
      >
        <div className="space-y-2">
          <FieldLabel htmlFor={`email-${userId}`}>Email</FieldLabel>
          <Input
            id={`email-${userId}`}
            type="email"
            value={email ?? "—"}
            readOnly
            className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor={`name-${userId}`}>Name</FieldLabel>
          <Input
            id={`name-${userId}`}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor={`rank-${userId}`}>Rank</FieldLabel>
          <Select
            id={`rank-${userId}`}
            value={selectedRank}
            onChange={(e) => setSelectedRank(e.target.value)}
          >
            <option value="">Not set</option>
            {rankOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={profilePending}
            className="bg-[#0B2E4B] text-white"
          >
            {profilePending ? "Saving..." : "Save profile"}
          </Button>
          {profileSaved ? <p className="text-sm text-green-700">Profile saved.</p> : null}
          {profileError ? <p className="text-sm text-red-700">{profileError}</p> : null}
        </div>
      </form>

      <div className="shrink-0 space-y-2 lg:w-56">
        <FieldLabel>Role</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Button
              key={role}
              size="sm"
              variant={role === currentRole ? "primary" : "secondary"}
              disabled={rolePending || role === currentRole}
              onClick={() => startRoleTransition(() => updateUserRole({ userId, role }))}
            >
              {roleLabel(role)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
