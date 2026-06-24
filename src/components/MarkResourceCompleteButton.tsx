"use client";

import { useTransition } from "react";
import { setResourceComplete } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function MarkResourceCompleteButton({
  programId,
  moduleId,
  resourceId,
  enrolled,
  completed,
}: {
  programId: string;
  moduleId: string;
  resourceId: string;
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
          setResourceComplete({
            programId,
            moduleId,
            resourceId,
            completed: !completed,
          })
        )
      }
    >
      {pending ? "Saving..." : completed ? "Mark incomplete" : "Mark complete"}
    </Button>
  );
}
