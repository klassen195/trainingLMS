"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { setChecklistItemComplete } from "@/app/actions";
import type { ChecklistItemWithProgress } from "@/lib/training-lms-types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";

export function ChecklistItemsPanel({
  programId,
  moduleId,
  resourceId,
  items,
  enrolled,
  resourceCompleted,
}: {
  programId: string;
  moduleId: string;
  resourceId: string;
  items: ChecklistItemWithProgress[];
  enrolled: boolean;
  resourceCompleted: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No checklist items yet.</p>;
  }

  return (
    <>
      <ul className="space-y-2">
        {items.map((item) => {
          const checked = Boolean(item.completed_at);
          return (
            <li
              key={item.id}
              className={cn(
                "rounded-lg border px-3 py-3 transition-colors",
                checked && "border-primary/30 bg-primary/5"
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  checked={checked}
                  disabled={!enrolled || pending}
                  onChange={(event) =>
                    startTransition(() =>
                      setChecklistItemComplete({
                        programId,
                        moduleId,
                        resourceId,
                        itemId: item.id,
                        completed: event.target.checked,
                      })
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("text-sm", checked && "text-muted-foreground line-through")}>
                    {item.label}
                  </span>
                  {item.completed_at ? (
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3 w-3" />
                      Completed {formatDateTime(item.completed_at)}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {enrolled && resourceCompleted ? (
        <p className="mt-3 text-sm font-medium text-primary">All checklist items completed.</p>
      ) : null}
    </>
  );
}
