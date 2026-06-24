"use client";

import { useTransition } from "react";
import { enrollInModule } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function EnrollInModuleButton({
  programId,
  moduleId,
}: {
  programId: string;
  moduleId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() => startTransition(() => enrollInModule({ programId, moduleId }))}
    >
      {pending ? "Enrolling..." : "Enroll in module"}
    </Button>
  );
}
