"use client";

import { useTransition } from "react";
import { markModuleComplete } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function MarkModuleCompleteButton({
  programId,
  moduleId,
  completed,
}: {
  programId: string;
  moduleId: string;
  completed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (completed) {
    return <p className="text-sm font-medium text-green-700">Module completed</p>;
  }

  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() => startTransition(() => markModuleComplete({ programId, moduleId }))}
      className="bg-[#0B2E4B] text-white hover:bg-[#082238] dark:bg-[#0B2E4B] dark:text-white"
    >
      {pending ? "Saving..." : "Mark complete"}
    </Button>
  );
}
