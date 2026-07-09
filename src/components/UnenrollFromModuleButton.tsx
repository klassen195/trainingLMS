"use client";

import { useTransition } from "react";
import { unenrollFromModule } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function UnenrollFromModuleButton({
  programId,
  moduleId,
}: {
  programId: string;
  moduleId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Leave this module? Your progress will be saved if you enroll again later.")) return;
        startTransition(() => unenrollFromModule({ programId, moduleId }));
      }}
    >
      {pending ? "Leaving..." : "Leave module"}
    </Button>
  );
}
