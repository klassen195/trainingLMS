"use client";

import type { PermissionLevel } from "@/lib/permission-levels-types";
import { Button } from "@/components/ui/Button";
import { FieldHint, FieldLabel } from "@/components/ui/Field";

export function PermissionLevelPicker({
  levels,
  selectedIds,
  onChange,
  disabled,
  id,
}: {
  levels: PermissionLevel[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  id?: string;
}) {
  const selected = new Set(selectedIds);

  function toggle(levelId: string) {
    if (selected.has(levelId)) {
      onChange(selectedIds.filter((id) => id !== levelId));
      return;
    }
    onChange([...selectedIds, levelId]);
  }

  if (levels.length === 0) {
    return (
      <p className="text-sm text-destructive">
        Create a permission level under Admin → Permissions before assigning roles.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id}>Permission levels</FieldLabel>
      <FieldHint>Select every role this person should have. Access from each level is combined.</FieldHint>
      <div id={id} className="flex flex-wrap gap-2">
        {levels.map((level) => (
          <Button
            key={level.id}
            type="button"
            size="sm"
            disabled={disabled}
            variant={selected.has(level.id) ? "primary" : "secondary"}
            aria-pressed={selected.has(level.id)}
            onClick={() => toggle(level.id)}
          >
            {level.name}
            {level.is_default ? " (default)" : ""}
          </Button>
        ))}
      </div>
    </div>
  );
}
