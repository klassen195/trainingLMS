"use client";

import { useState, useTransition } from "react";
import { invitePersonnelMember } from "@/app/personnel/actions";
import type { UserRole } from "@/lib/training-lms-types";
import { permissionLevels } from "@/lib/personnel-types";
import { roleLabel } from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

export function InvitePersonnelForm() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("firefighter");
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
            await invitePersonnelMember({
              email,
              displayName: displayName || undefined,
              role,
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
            setError(err instanceof Error ? err.message : "Invite failed");
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

      <div className="space-y-2">
        <FieldLabel htmlFor="invite-name">Display name (optional)</FieldLabel>
        <Input
          id="invite-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Full name"
        />
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="invite-role">Permission level</FieldLabel>
        <Select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          {permissionLevels.map((level) => (
            <option key={level} value={level}>
              {roleLabel(level)}
            </option>
          ))}
        </Select>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Sending invite…" : "Send invite"}
      </Button>
    </form>
  );
}
