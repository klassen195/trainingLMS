"use client";

import { useState, useTransition } from "react";
import { createPersonnelMember } from "@/app/personnel/actions";
import { defaultPermissionLevelId } from "@/lib/permission-levels";
import type { PermissionLevel } from "@/lib/permission-levels-types";
import { PermissionLevelPicker } from "@/components/PermissionLevelPicker";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function InvitePersonnelForm({ permissionLevels }: { permissionLevels: PermissionLevel[] }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [permissionLevelIds, setPermissionLevelIds] = useState(() => {
    const defaultId = defaultPermissionLevelId(permissionLevels);
    return defaultId ? [defaultId] : [];
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await createPersonnelMember({
              email,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              permissionLevelIds,
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
            setError(err instanceof Error ? err.message : "Failed to add member");
          }
        });
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="invite-email">Email</FieldLabel>
        <Input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="member@example.com"
          autoComplete="email"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="invite-first-name">First name</FieldLabel>
          <Input
            id="invite-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First"
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="invite-last-name">Last name</FieldLabel>
          <Input
            id="invite-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last"
            autoComplete="family-name"
          />
        </div>
      </div>

      <PermissionLevelPicker
        id="invite-roles"
        levels={permissionLevels}
        selectedIds={permissionLevelIds}
        onChange={setPermissionLevelIds}
        disabled={pending}
      />

      {error ? <FieldError>{error}</FieldError> : null}

      <Button type="submit" disabled={pending || permissionLevelIds.length === 0}>
        {pending ? "Adding…" : "Add member"}
      </Button>
    </form>
  );
}
