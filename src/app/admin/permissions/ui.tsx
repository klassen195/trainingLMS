"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPermissionLevel,
  deletePermissionLevel,
  updateLevelCapabilities,
  updatePermissionLevel,
} from "@/app/admin/permissions/actions";
import {
  APP_CAPABILITIES,
  capabilityGroups,
  capabilityMeta,
  emptyCapabilityRow,
  type AppCapability,
  type CapabilityMatrix,
} from "@/lib/capabilities";
import type { PermissionLevel } from "@/lib/permission-levels-types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel, FieldSuccess } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function PermissionMatrixEditor({
  levels,
  initialMatrix,
}: {
  levels: PermissionLevel[];
  initialMatrix: CapabilityMatrix;
}) {
  const router = useRouter();
  const groups = useMemo(() => capabilityGroups(), []);
  const [selectedId, setSelectedId] = useState(levels[0]?.id ?? "");
  const selected = levels.find((level) => level.id === selectedId) ?? levels[0] ?? null;

  const [name, setName] = useState(selected?.name ?? "");
  const [newName, setNewName] = useState("");
  const [row, setRow] = useState<Record<AppCapability, boolean>>(
    () => (selected ? (initialMatrix[selected.id] ?? emptyCapabilityRow()) : emptyCapabilityRow())
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelError, setLevelError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setRow(initialMatrix[selected.id] ?? emptyCapabilityRow());
    setSaved(false);
    setError(null);
  }, [selected, initialMatrix]);

  useEffect(() => {
    if (!selectedId && levels[0]) setSelectedId(levels[0].id);
  }, [levels, selectedId]);

  const initialRow = selected ? (initialMatrix[selected.id] ?? emptyCapabilityRow()) : emptyCapabilityRow();
  const dirtyCapabilities = JSON.stringify(row) !== JSON.stringify(initialRow);
  const dirtyName = Boolean(selected && name.trim() !== selected.name);

  function toggle(capability: AppCapability) {
    setSaved(false);
    setError(null);
    setRow((current) => ({ ...current, [capability]: !current[capability] }));
  }

  function run(action: () => Promise<void>) {
    setError(null);
    setLevelError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Permission levels</p>
            <p className="text-xs text-muted-foreground">Select a level to edit its matrix.</p>
          </div>
          {levels.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No permission levels yet.</p>
          ) : (
            <ul className="p-1">
              {levels.map((level) => (
                <li key={level.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                      selected?.id === level.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() => {
                      if (
                        dirtyCapabilities &&
                        !window.confirm("Discard unsaved capability changes for this level?")
                      ) {
                        return;
                      }
                      setSelectedId(level.id);
                    }}
                  >
                    <span className="truncate font-medium">{level.name}</span>
                    {level.is_default ? (
                      <span
                        className={cn(
                          "ml-2 shrink-0 text-[10px] uppercase tracking-wide",
                          selected?.id === level.id ? "opacity-80" : "text-muted-foreground"
                        )}
                      >
                        Default
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          className="space-y-3 rounded-xl border border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setLevelError(null);
            startTransition(async () => {
              try {
                const created = await createPermissionLevel({ name: newName });
                setNewName("");
                setSelectedId(created.id);
                router.refresh();
              } catch (err) {
                setLevelError(err instanceof Error ? err.message : "Failed to create permission level");
              }
            });
          }}
        >
          <p className="text-sm font-medium">New permission level</p>
          <div className="space-y-2">
            <FieldLabel htmlFor="new-permission-level-name">Name</FieldLabel>
            <Input
              id="new-permission-level-name"
              required
              value={newName}
              disabled={pending}
              placeholder="e.g. Lieutenant"
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          {levelError ? <FieldError>{levelError}</FieldError> : null}
          <Button type="submit" size="sm" disabled={pending || !newName.trim()}>
            {pending ? "Adding…" : "Add level"}
          </Button>
        </form>
      </aside>

      {selected ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1 space-y-2">
                <FieldLabel htmlFor="permission-level-name">Level name</FieldLabel>
                <Input
                  id="permission-level-name"
                  value={name}
                  disabled={pending}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !dirtyName}
                onClick={() =>
                  run(async () => {
                    await updatePermissionLevel({ id: selected.id, name });
                  })
                }
              >
                Rename
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selected.is_default}
                  disabled={pending || selected.is_default}
                  onChange={() =>
                    run(async () => {
                      await updatePermissionLevel({ id: selected.id, isDefault: true });
                    })
                  }
                />
                Use for new members
              </label>
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={pending || levels.length <= 1}
                onClick={() => {
                  if (!window.confirm(`Delete permission level "${selected.name}"?`)) return;
                  run(async () => {
                    await deletePermissionLevel({ id: selected.id });
                  });
                }}
              >
                Delete level
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Capability
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">
                    {selected.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([group, capabilities]) => (
                  <Fragment key={group}>
                    <tr className="border-b border-border">
                      <td
                        colSpan={2}
                        className="bg-muted/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {group}
                      </td>
                    </tr>
                    {capabilities.map((capability) => {
                      const meta = capabilityMeta[capability];
                      return (
                        <tr key={capability} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-3 align-top">
                            <p className="font-medium text-foreground">{meta.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={row[capability]}
                              disabled={pending}
                              onChange={() => toggle(capability)}
                              aria-label={`${meta.label} for ${selected.name}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              disabled={pending || !dirtyCapabilities}
              onClick={() =>
                run(async () => {
                  await updateLevelCapabilities({
                    permissionLevelId: selected.id,
                    rows: APP_CAPABILITIES.map((capability) => ({
                      capability,
                      enabled: row[capability],
                    })),
                  });
                  setSaved(true);
                })
              }
            >
              {pending ? "Saving..." : "Save capabilities"}
            </Button>
            {saved ? <FieldSuccess>Capabilities saved.</FieldSuccess> : null}
            {error ? <FieldError>{error}</FieldError> : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Create a permission level to configure its capabilities.</p>
      )}
    </div>
  );
}
