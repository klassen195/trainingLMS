"use client";

import { useState, useTransition } from "react";
import { updateUserProfile, updateUserRole } from "@/app/actions";
import type { Profile, UserRole } from "@/lib/training-lms-types";
import { fireRanks, roleLabel } from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

const roles: UserRole[] = ["learner", "instructor", "admin"];

function userListLabel(user: Profile) {
  return user.display_name?.trim() || user.email || "Unnamed member";
}

function listItemClass(selected: boolean) {
  return selected
    ? "w-full rounded-xl border border-[#C11B2B] bg-[#C11B2B]/5 p-4 text-left transition-colors"
    : "w-full rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900";
}

export function AdminUserManager({ users }: { users: Profile[] }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Members</h2>
        {users.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No users yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {users.map((user) => {
              const selected = user.id === selectedUserId;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={listItemClass(selected)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-950 dark:text-zinc-50">
                          {userListLabel(user)}
                        </p>
                        {user.email ? (
                          <p className="mt-1 truncate text-sm text-zinc-500">{user.email}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-zinc-500">
                          {[user.rank, roleLabel(user.role)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {selected ? (
                        <span className="shrink-0 rounded-full bg-[#C11B2B] px-2 py-1 text-xs font-medium text-white">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 lg:min-h-[24rem]">
        {selectedUser ? (
          <AdminUserForm key={selectedUser.id} user={selectedUser} />
        ) : (
          <div className="flex h-full min-h-[12rem] items-center justify-center px-4 text-center">
            <p className="text-sm text-zinc-500">Select a member from the list to edit their profile.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function AdminUserForm({ user }: { user: Profile }) {
  const [name, setName] = useState(user.display_name ?? "");
  const [selectedRank, setSelectedRank] = useState(user.rank ?? "");
  const [profilePending, startProfileTransition] = useTransition();
  const [rolePending, startRoleTransition] = useTransition();
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const rankOptions =
    user.rank && !(fireRanks as readonly string[]).includes(user.rank) ? [...fireRanks, user.rank] : fireRanks;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0B2E4B]">{userListLabel(user)}</h2>
        <p className="mt-1 text-sm text-zinc-500">Edit profile details and access role.</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setProfileError(null);
          setProfileSaved(false);
          startProfileTransition(async () => {
            try {
              await updateUserProfile({
                userId: user.id,
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
          <FieldLabel htmlFor={`email-${user.id}`}>Email</FieldLabel>
          <Input
            id={`email-${user.id}`}
            type="email"
            value={user.email ?? "—"}
            readOnly
            className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor={`name-${user.id}`}>Name</FieldLabel>
          <Input
            id={`name-${user.id}`}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor={`rank-${user.id}`}>Rank</FieldLabel>
          <Select
            id={`rank-${user.id}`}
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

      <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <FieldLabel>Role</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Button
              key={role}
              size="sm"
              variant={role === user.role ? "primary" : "secondary"}
              disabled={rolePending || role === user.role}
              onClick={() => startRoleTransition(() => updateUserRole({ userId: user.id, role }))}
            >
              {roleLabel(role)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
