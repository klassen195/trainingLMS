"use client";

import { useTransition } from "react";
import { enrollInProgram } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function EnrollInProgramButton({
  programId,
  label = "Enroll in program",
}: {
  programId: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() => startTransition(() => enrollInProgram({ programId }))}
    >
      {pending ? "Enrolling..." : label}
    </Button>
  );
}
