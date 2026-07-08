"use client";

import type { ModuleChecklistWithProgress } from "@/lib/checklist-data";
import { ChecklistItemsPanel } from "@/components/ChecklistItemsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function ModuleChecklistsSection({
  programId,
  moduleId,
  checklists,
  enrolled,
  embedded = false,
}: {
  programId: string;
  moduleId: string;
  checklists: ModuleChecklistWithProgress[];
  enrolled: boolean;
  embedded?: boolean;
}) {
  if (checklists.length === 0) {
    return null;
  }

  const content = (
    <>
      {!embedded ? (
        <CardHeader>
          <CardTitle className="text-lg">Checklists</CardTitle>
          {!enrolled ? (
            <p className="text-sm text-muted-foreground">Enroll in this module to track checklist progress.</p>
          ) : null}
        </CardHeader>
      ) : (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Checklists</h2>
          {!enrolled ? (
            <p className="text-sm text-muted-foreground">Enroll in this module to track checklist progress.</p>
          ) : null}
        </div>
      )}
      <CardContent className={embedded ? "space-y-6 px-0 pb-0 pt-4" : "space-y-6"}>
        {checklists.map((checklist) => {
          const completedCount = checklist.items.filter((item) => item.completed_at).length;
          return (
            <section key={checklist.resourceId} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">{checklist.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {completedCount}/{checklist.items.length} complete
                </p>
              </div>
              <ChecklistItemsPanel
                programId={programId}
                moduleId={moduleId}
                resourceId={checklist.resourceId}
                items={checklist.items}
                enrolled={enrolled}
                resourceCompleted={checklist.resourceCompleted}
              />
            </section>
          );
        })}
      </CardContent>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return <Card className="mt-6">{content}</Card>;
}
