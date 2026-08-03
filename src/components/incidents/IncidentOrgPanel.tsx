"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Trash2 } from "lucide-react";
import {
  INCIDENT_UNIT_KIND_LABELS,
  INCIDENT_UNIT_KINDS,
  apparatusTypeToIncidentUnitKind,
  incidentUnitKindLabel,
  unitDisplayLabel,
  type IncidentUnit,
  type IncidentUnitKind,
} from "@/lib/incident-types";
import {
  addHomeUnit,
  addMutualAidUnit,
  removeUnit,
  updateIncidentUnitType,
} from "@/app/incidents/actions";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type ApparatusOption = { id: string; label: string; apparatus_type: string | null };

function UnitKindSelect({
  value,
  onChange,
  disabled,
  required,
  id,
}: {
  value: string;
  onChange: (value: IncidentUnitKind | "") => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as IncidentUnitKind | "")}
      disabled={disabled}
      required={required}
    >
      <option value="">Select kind…</option>
      {INCIDENT_UNIT_KINDS.map((kind) => (
        <option key={kind} value={kind}>
          {INCIDENT_UNIT_KIND_LABELS[kind]}
        </option>
      ))}
    </Select>
  );
}

function isIncidentUnitKindValue(value: string | null): value is IncidentUnitKind {
  return Boolean(value && (INCIDENT_UNIT_KINDS as readonly string[]).includes(value));
}

function UnitChip({
  unit,
  incidentId,
  onChanged,
}: {
  unit: IncidentUnit;
  incidentId: string;
  onChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unit:${unit.id}`,
    data: { unitId: unit.id },
  });
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<IncidentUnitKind | "">(
    isIncidentUnitKindValue(unit.unit_type) ? unit.unit_type : ""
  );
  const skipClickRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const kindLabel = incidentUnitKindLabel(unit.unit_type);

  useEffect(() => {
    setKind(isIncidentUnitKindValue(unit.unit_type) ? unit.unit_type : "");
  }, [unit.unit_type]);

  useEffect(() => {
    if (isDragging) {
      skipClickRef.current = true;
      setOpen(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => {
          if (skipClickRef.current) {
            skipClickRef.current = false;
            return;
          }
          setOpen((v) => !v);
        }}
        className={cn(
          "w-full cursor-grab rounded-md border bg-background px-2 py-1.5 text-left text-xs font-medium active:cursor-grabbing",
          isDragging && "opacity-40",
          open && "border-primary ring-1 ring-primary/40"
        )}
      >
        <span className="block truncate">{unitDisplayLabel(unit)}</span>
        <span className="text-[10px] text-muted-foreground">
          {[kindLabel, unit.asset_id ? "Home" : unit.agency_name].filter(Boolean).join(" · ") ||
            "Click to set kind"}
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 space-y-2 rounded-md border bg-popover p-2 shadow-lg">
          <p className="text-[11px] font-medium text-foreground">Unit kind</p>
          <UnitKindSelect value={kind} onChange={setKind} disabled={pending} required />
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              className="h-7 flex-1 text-xs"
              disabled={pending || !kind || kind === unit.unit_type}
              onClick={() => {
                if (!kind) return;
                startTransition(async () => {
                  await updateIncidentUnitType(incidentId, unit.id, kind);
                  setOpen(false);
                  onChanged();
                });
              }}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StagingDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "staging-drop" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[4.5rem] flex-1 rounded-md border border-dashed p-1.5 transition-colors",
        isOver ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border/60"
      )}
    >
      {children}
    </div>
  );
}

/** Map-left inset: staged units list + drop target */
export function IncidentStagingInset({
  incidentId,
  unassignedUnits,
  onChanged,
}: {
  incidentId: string;
  unassignedUnits: IncidentUnit[];
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-background/95 shadow-lg backdrop-blur-sm">
      <div className="border-b px-2.5 py-2">
        <h2 className="text-sm font-semibold">Staged</h2>
        <p className="text-[10px] text-muted-foreground">
          Drag to card/map · Drop here to stage
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        <StagingDropZone>
          <div className="space-y-1">
            {unassignedUnits.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No staged units</p>
            ) : (
              unassignedUnits.map((u) => (
                <div key={u.id} className="flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <UnitChip unit={u} incidentId={incidentId} onChanged={onChanged} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await removeUnit(incidentId, u.id);
                        onChanged();
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </StagingDropZone>
      </div>
    </aside>
  );
}

/** Left column: add home / mutual-aid units */
export function IncidentAddUnitsPanel({
  incidentId,
  units,
  apparatusOptions,
  onChanged,
}: {
  incidentId: string;
  units: IncidentUnit[];
  apparatusOptions: ApparatusOption[];
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [homeAssetId, setHomeAssetId] = useState("");
  const [homeUnitKind, setHomeUnitKind] = useState<IncidentUnitKind | "">("");
  const [aidLabel, setAidLabel] = useState("");
  const [aidAgency, setAidAgency] = useState("");
  const [aidUnitKind, setAidUnitKind] = useState<IncidentUnitKind | "">("");
  const [error, setError] = useState<string | null>(null);

  const onSceneAssetIds = new Set(units.filter((u) => u.asset_id).map((u) => u.asset_id!));
  const availableApparatus = apparatusOptions.filter((a) => !onSceneAssetIds.has(a.id));

  useEffect(() => {
    const selected = apparatusOptions.find((a) => a.id === homeAssetId);
    if (!selected) {
      setHomeUnitKind("");
      return;
    }
    setHomeUnitKind(apparatusTypeToIncidentUnitKind(selected.apparatus_type) ?? "");
  }, [homeAssetId, apparatusOptions]);

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-r bg-muted/20 p-3">
      <h2 className="mb-3 text-sm font-semibold">Add units</h2>
      <div className="space-y-4">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!homeAssetId || !homeUnitKind) return;
            setError(null);
            startTransition(async () => {
              try {
                await addHomeUnit(incidentId, homeAssetId, homeUnitKind);
                setHomeAssetId("");
                setHomeUnitKind("");
                onChanged();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add unit");
              }
            });
          }}
        >
          <FieldLabel>Add home unit</FieldLabel>
          <Select
            value={homeAssetId}
            onChange={(e) => setHomeAssetId(e.target.value)}
            disabled={pending}
          >
            <option value="">Select apparatus…</option>
            {availableApparatus.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
          <UnitKindSelect
            value={homeUnitKind}
            onChange={setHomeUnitKind}
            disabled={pending || !homeAssetId}
            required
          />
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={pending || !homeAssetId || !homeUnitKind}
          >
            Add home unit
          </Button>
        </form>

        <form
          className="space-y-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!aidUnitKind) return;
            setError(null);
            startTransition(async () => {
              try {
                await addMutualAidUnit({
                  incidentId,
                  label: aidLabel,
                  agencyName: aidAgency,
                  unitType: aidUnitKind,
                });
                setAidLabel("");
                setAidAgency("");
                setAidUnitKind("");
                onChanged();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add unit");
              }
            });
          }}
        >
          <FieldLabel>Add mutual-aid unit</FieldLabel>
          <Input
            value={aidAgency}
            onChange={(e) => setAidAgency(e.target.value)}
            placeholder="Agency"
            required
            disabled={pending}
          />
          <Input
            value={aidLabel}
            onChange={(e) => setAidLabel(e.target.value)}
            placeholder="Unit (e.g. E21)"
            required
            disabled={pending}
          />
          <UnitKindSelect
            value={aidUnitKind}
            onChange={setAidUnitKind}
            disabled={pending}
            required
          />
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={pending || !aidLabel.trim() || !aidAgency.trim() || !aidUnitKind}
          >
            Add mutual aid
          </Button>
        </form>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </aside>
  );
}
