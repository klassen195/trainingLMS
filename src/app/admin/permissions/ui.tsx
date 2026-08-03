"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { updateCapabilityMatrix } from "@/app/admin/permissions/actions";
import {
  APP_CAPABILITIES,
  PERMISSION_LEVELS,
  capabilityGroups,
  capabilityMeta,
  type AppCapability,
  type CapabilityMatrix,
} from "@/lib/capabilities";
import { roleLabel } from "@/lib/labels";
import { Button } from "@/components/ui/Button";

export function PermissionMatrixEditor({ initialMatrix }: { initialMatrix: CapabilityMatrix }) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => capabilityGroups(), []);

  const dirty = useMemo(() => JSON.stringify(matrix) !== JSON.stringify(initialMatrix), [matrix, initialMatrix]);

  function toggle(role: (typeof PERMISSION_LEVELS)[number], capability: AppCapability) {
    setSaved(false);
    setError(null);
    setMatrix((current) => ({
      ...current,
      [role]: {
        ...current[role],
        [capability]: !current[role][capability],
      },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        System admins always have every capability. The matrix below only configures Recruit, Firefighter, and
        Captain.
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-200">Capability</th>
              {PERMISSION_LEVELS.map((role) => (
                <th key={role} className="px-4 py-3 text-center font-semibold text-zinc-700 dark:text-zinc-200">
                  {roleLabel(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, capabilities]) => (
              <Fragment key={group}>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td
                    colSpan={1 + PERMISSION_LEVELS.length}
                    className="bg-zinc-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80"
                  >
                    {group}
                  </td>
                </tr>
                {capabilities.map((capability) => {
                  const meta = capabilityMeta[capability];
                  return (
                    <tr
                      key={capability}
                      className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">{meta.label}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{meta.description}</p>
                      </td>
                      {PERMISSION_LEVELS.map((role) => (
                        <td key={`${role}-${capability}`} className="px-4 py-3 text-center align-middle">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300"
                            checked={matrix[role][capability]}
                            disabled={pending}
                            onChange={() => toggle(role, capability)}
                            aria-label={`${meta.label} for ${roleLabel(role)}`}
                          />
                        </td>
                      ))}
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
          disabled={pending || !dirty}
          className="bg-[#0B2E4B] text-white"
          onClick={() => {
            setError(null);
            setSaved(false);
            startTransition(async () => {
              try {
                await updateCapabilityMatrix({
                  rows: APP_CAPABILITIES.flatMap((capability) =>
                    PERMISSION_LEVELS.map((role) => ({
                      role,
                      capability,
                      enabled: matrix[role][capability],
                    }))
                  ),
                });
                setSaved(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to save capabilities");
              }
            });
          }}
        >
          {pending ? "Saving..." : "Save capabilities"}
        </Button>
        {saved ? <p className="text-sm text-green-700">Capabilities saved.</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
