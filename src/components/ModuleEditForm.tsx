"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  unlinkModuleFromProgram,
  updateModule,
  updateProgramModuleOrder,
} from "@/app/actions";
import type { ModuleResource, ProgramModuleEntry } from "@/lib/training-lms-types";
import { ModuleResourcesEditor } from "@/components/ModuleResourcesEditor";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";

export function ModuleEditForm({
  programId,
  moduleItem,
  canEdit,
  isAdmin = false,
  resources,
  showUnlink = true,
}: {
  programId: string;
  moduleItem: ProgramModuleEntry;
  canEdit: boolean;
  isAdmin?: boolean;
  resources: ModuleResource[];
  showUnlink?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(moduleItem.title);
  const [content, setContent] = useState(moduleItem.content);
  const [sortOrder, setSortOrder] = useState(String(moduleItem.sort_order));
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      {canEdit ? (
        <>
          <div className="space-y-2">
            <FieldLabel htmlFor="module-title">Title</FieldLabel>
            <Input id="module-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="module-content">Content</FieldLabel>
            <Textarea id="module-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <p className="font-medium">{moduleItem.title}</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{moduleItem.content}</p>
          <p className="text-xs text-muted-foreground">Shared module — only the creator can edit content.</p>
        </>
      )}
      <div className="space-y-2">
        <FieldLabel htmlFor="module-sort">Sort order</FieldLabel>
        <Input id="module-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
      {canEdit ? (
        <ModuleResourcesEditor
          programId={programId}
          moduleId={moduleItem.id}
          resources={resources}
          isAdmin={isAdmin}
        />
      ) : null}
      <div className="flex flex-wrap gap-2 border-t pt-6">
        {canEdit ? (
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                updateModule({
                  programId,
                  moduleId: moduleItem.id,
                  title,
                  content,
                  sortOrder: Number(sortOrder) || 0,
                })
              )
            }
          >
            {pending ? "Saving..." : "Save module"}
          </Button>
        ) : (
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                updateProgramModuleOrder({
                  programId,
                  moduleId: moduleItem.id,
                  sortOrder: Number(sortOrder) || 0,
                })
              )
            }
          >
            {pending ? "Saving..." : "Save order"}
          </Button>
        )}
        {showUnlink ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await unlinkModuleFromProgram({ programId, moduleId: moduleItem.id });
                router.push(`/instructor/programs/${programId}/edit`);
                router.refresh();
              })
            }
          >
            Remove from program
          </Button>
        ) : null}
      </div>
    </div>
  );
}
