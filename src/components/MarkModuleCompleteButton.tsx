"use client";

import { useTransition } from "react";
import { setModuleComplete } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function MarkModuleCompleteButton({
  programId,
  moduleId,
  enrolled,
  completed,
}: {
  programId: string;
  moduleId: string;
  enrolled: boolean;
  completed: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (!enrolled) {
    return <p className="text-sm text-muted-foreground">Not enrolled</p>;
  }

  return (
    <Button
      variant={completed ? "outline" : "primary"}
      disabled={pending}
      onClick={() =>
        startTransition(() =>
          setModuleComplete({ programId, moduleId, completed: !completed })
        )
      }
    >
      {pending ? "Saving..." : completed ? "Mark incomplete" : "Mark complete"}
    </Button>
  );
}
