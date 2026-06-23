"use client";

import { useTransition } from "react";
import { updateUserRole } from "@/app/actions";
import type { UserRole } from "@/lib/training-lms-types";
import { roleLabel } from "@/lib/labels";
import { Button } from "@/components/ui/Button";

const roles: UserRole[] = ["learner", "instructor", "admin"];

export function AdminRoleForm({ userId, currentRole }: { userId: string; currentRole: UserRole }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {roles.map((role) => (
        <Button
          key={role}
          size="sm"
          variant={role === currentRole ? "primary" : "secondary"}
          disabled={pending || role === currentRole}
          onClick={() => startTransition(() => updateUserRole({ userId, role }))}
        >
          {roleLabel(role)}
        </Button>
      ))}
    </div>
  );
}
