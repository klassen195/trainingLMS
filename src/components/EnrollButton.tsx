"use client";

import { useTransition } from "react";
import { enrollInProgram } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function EnrollButton({ programId }: { programId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() => startTransition(() => enrollInProgram(programId))}
      className="bg-[#C11B2B] text-white hover:bg-[#a01624] dark:bg-[#C11B2B] dark:text-white"
    >
      {pending ? "Enrolling..." : "Enroll"}
    </Button>
  );
}
