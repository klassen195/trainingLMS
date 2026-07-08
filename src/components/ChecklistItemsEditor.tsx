"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  addChecklistItem,
  deleteChecklistItem,
  updateChecklistItem,
} from "@/app/actions";
import type { ChecklistItem } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function ChecklistItemsEditor({
  programId,
  moduleId,
  resourceId,
  items,
}: {
  programId: string;
  moduleId: string;
  resourceId: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [newItemLabel, setNewItemLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-dashed border-border bg-background/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Checklist items</p>

      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2">
              <Input
                defaultValue={item.label}
                disabled={pending}
                onBlur={(event) => {
                  const nextLabel = event.target.value.trim();
                  if (!nextLabel || nextLabel === item.label) return;
                  startTransition(async () => {
                    setError(null);
                    try {
                      await updateChecklistItem({
                        programId,
                        moduleId,
                        resourceId,
                        itemId: item.id,
                        label: nextLabel,
                      });
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to update item");
                    }
                  });
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    try {
                      await deleteChecklistItem({
                        programId,
                        moduleId,
                        resourceId,
                        itemId: item.id,
                      });
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to remove item");
                    }
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No checklist items yet.</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1 space-y-2">
          <FieldLabel htmlFor={`checklist-new-item-${resourceId}`}>New item</FieldLabel>
          <Input
            id={`checklist-new-item-${resourceId}`}
            placeholder="e.g. Review pump operations manual"
            value={newItemLabel}
            onChange={(event) => setNewItemLabel(event.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={pending || !newItemLabel.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await addChecklistItem({
                  programId,
                  moduleId,
                  resourceId,
                  label: newItemLabel.trim(),
                });
                setNewItemLabel("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add item");
              }
            })
          }
        >
          <Plus className="h-4 w-4" />
          Add item
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
