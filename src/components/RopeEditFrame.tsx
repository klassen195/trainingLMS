"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RopeEditFrame({
  canManage,
  editLabel,
  actions,
  header,
  editor,
  children,
}: {
  canManage: boolean;
  editLabel: string;
  actions?: ReactNode;
  header: ReactNode;
  editor?: ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      {canManage || actions ? (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          {actions}
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant={editing ? "secondary" : "outline"}
              aria-expanded={editing}
              onClick={() => setEditing((open) => !open)}
            >
              {editing ? "Cancel" : editLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mb-4">{header}</div>
      {canManage && editing ? <div className="mb-4 space-y-4">{editor}</div> : null}
      {children}
    </>
  );
}
