"use client";

import type { ChecklistItemWithProgress } from "@/lib/training-lms-types";
import { ChecklistItemsPanel } from "@/components/ChecklistItemsPanel";
import { Badge } from "@/components/ui/Badge";

export function ChecklistTaker({
  programId,
  moduleId,
  resourceId,
  resourceTitle,
  enrolled,
  items,
  resourceCompleted,
}: {
  programId: string;
  moduleId: string;
  resourceId: string;
  resourceTitle: string;
  enrolled: boolean;
  items: ChecklistItemWithProgress[];
  resourceCompleted: boolean;
}) {
  const completedCount = items.filter((item) => item.completed_at).length;

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{resourceTitle}</h1>
          <Badge variant="outline" className="mt-2">
            Checklist
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {completedCount}/{items.length} complete
        </p>
      </div>

      {!enrolled ? (
        <p className="text-sm text-muted-foreground">Enroll in this module to track checklist progress.</p>
      ) : null}

      <ChecklistItemsPanel
        programId={programId}
        moduleId={moduleId}
        resourceId={resourceId}
        items={items}
        enrolled={enrolled}
        resourceCompleted={resourceCompleted}
      />
    </article>
  );
}
