"use client";

import { useTransition } from "react";
import { unenrollFromProgram } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function UnenrollFromProgramButton({
  programId,
  enrolledCount,
}: {
  programId: string;
  enrolledCount: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        const moduleLabel = enrolledCount === 1 ? "1 module" : `${enrolledCount} modules`;
        if (
          !window.confirm(
            `Leave this program? You'll be unenrolled from ${moduleLabel}. Your progress will be saved if you enroll again later.`
          )
        ) {
          return;
        }
        startTransition(() => unenrollFromProgram({ programId }));
      }}
    >
      {pending ? "Leaving..." : "Leave program"}
    </Button>
  );
}
