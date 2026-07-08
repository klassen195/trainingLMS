"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  unlinkModuleFromProgram,
  updateModule,
  updateProgramModuleOrder,
} from "@/app/actions";
import type { ChecklistItem, ModuleResource, ProgramModuleEntry } from "@/lib/training-lms-types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ModuleResourcesEditor } from "@/components/ModuleResourcesEditor";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";

type SaveStatus = "idle" | "pending" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 800;

function SaveStatusMessage({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === "pending") {
    return <p className="text-xs text-muted-foreground">Saving...</p>;
  }
  if (status === "saved") {
    return <p className="text-xs text-primary">All changes saved</p>;
  }
  if (status === "error") {
    return <p className="text-xs text-destructive">{error ?? "Failed to save changes"}</p>;
  }
  return null;
}

export function ModuleEditForm({
  programId,
  moduleItem,
  canEdit,
  isAdmin = false,
  resources,
  checklistItemsByResourceId = {},
  showUnlink = true,
}: {
  programId: string;
  moduleItem: ProgramModuleEntry;
  canEdit: boolean;
  isAdmin?: boolean;
  resources: ModuleResource[];
  checklistItemsByResourceId?: Record<string, ChecklistItem[]>;
  showUnlink?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(moduleItem.title);
  const [content, setContent] = useState(moduleItem.content);
  const [sortOrder, setSortOrder] = useState(String(moduleItem.sort_order));
  const [savedSnapshot, setSavedSnapshot] = useState({
    title: moduleItem.title,
    content: moduleItem.content,
    sortOrder: moduleItem.sort_order,
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const debouncedTitle = useDebouncedValue(title, AUTOSAVE_DELAY_MS);
  const debouncedContent = useDebouncedValue(content, AUTOSAVE_DELAY_MS);
  const debouncedSortOrder = useDebouncedValue(sortOrder, AUTOSAVE_DELAY_MS);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const timer = window.setTimeout(() => setSaveStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [saveStatus]);

  useEffect(() => {
    const nextSortOrder = Number(debouncedSortOrder) || 0;
    const hasChanges =
      debouncedTitle !== savedSnapshot.title ||
      debouncedContent !== savedSnapshot.content ||
      nextSortOrder !== savedSnapshot.sortOrder;

    if (!hasChanges) return;

    if (canEdit && !debouncedTitle.trim()) {
      setSaveStatus("error");
      setSaveError("Title is required.");
      return;
    }

    startTransition(async () => {
      setSaveStatus("pending");
      setSaveError(null);
      try {
        if (canEdit) {
          await updateModule({
            programId,
            moduleId: moduleItem.id,
            title: debouncedTitle.trim(),
            content: debouncedContent,
            sortOrder: nextSortOrder,
          });
        } else {
          await updateProgramModuleOrder({
            programId,
            moduleId: moduleItem.id,
            sortOrder: nextSortOrder,
          });
        }
        setSavedSnapshot({
          title: debouncedTitle.trim(),
          content: debouncedContent,
          sortOrder: nextSortOrder,
        });
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("error");
        setSaveError(err instanceof Error ? err.message : "Failed to save changes");
      }
    });
  }, [
    canEdit,
    debouncedContent,
    debouncedSortOrder,
    debouncedTitle,
    moduleItem.id,
    programId,
    savedSnapshot.content,
    savedSnapshot.sortOrder,
    savedSnapshot.title,
  ]);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Changes save automatically.</p>
        <SaveStatusMessage status={saveStatus} error={saveError} />
      </div>

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
          checklistItemsByResourceId={checklistItemsByResourceId}
          isAdmin={isAdmin}
        />
      ) : null}
      {showUnlink ? (
        <div className="border-t border-border pt-6">
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
        </div>
      ) : null}
    </div>
  );
}
