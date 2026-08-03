"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  ORG_NODE_LEADER_ROLE_LABELS,
  ORG_NODE_TYPE_LABELS,
  incidentUnitKindLabel,
  unitDisplayLabel,
  type IncidentAssignment,
  type IncidentOrgNode,
  type IncidentUnit,
  type OrgNodeType,
} from "@/lib/incident-types";
import { createOrgNode, deleteOrgNode, updateOrgNode } from "@/app/incidents/actions";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

function UnitChip({ unit }: { unit: IncidentUnit }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unit:${unit.id}`,
    data: { unitId: unit.id },
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "w-full cursor-grab rounded-md border bg-background px-2 py-1.5 text-left text-xs font-medium active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <span className="block truncate">{unitDisplayLabel(unit)}</span>
      <span className="text-[10px] text-muted-foreground">
        {[incidentUnitKindLabel(unit.unit_type), unit.agency_name && !unit.asset_id ? unit.agency_name : null]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </button>
  );
}

function OrgCard({
  node,
  assignedUnits,
  onChanged,
  onDelete,
}: {
  node: IncidentOrgNode;
  assignedUnits: IncidentUnit[];
  onChanged: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `org:${node.id}` });
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(node.name);
  const [nodeType, setNodeType] = useState<OrgNodeType>(node.node_type);
  const [leaderUnitId, setLeaderUnitId] = useState(node.leader_unit_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const setCardRef = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      setNodeRef(el);
    },
    [setNodeRef]
  );

  const assignedUnitIds = assignedUnits.map((u) => u.id).join(",");

  const leader = node.leader_unit_id
    ? assignedUnits.find((u) => u.id === node.leader_unit_id) ?? null
    : null;
  const roleLabel = ORG_NODE_LEADER_ROLE_LABELS[node.node_type];

  useEffect(() => {
    setName(node.name);
    setNodeType(node.node_type);
    const stillAssigned =
      Boolean(node.leader_unit_id) && assignedUnitIds.split(",").includes(node.leader_unit_id!);
    setLeaderUnitId(stillAssigned ? node.leader_unit_id! : "");
  }, [node.name, node.node_type, node.leader_unit_id, assignedUnitIds]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div
      ref={setCardRef}
      className={cn(
        "relative flex w-56 shrink-0 flex-col overflow-hidden rounded-md border bg-background p-3 shadow-sm transition-colors",
        isOver && !open ? "border-primary ring-2 ring-primary/30" : "border-border",
        open && "border-primary ring-1 ring-primary/40"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {ORG_NODE_TYPE_LABELS[node.node_type]}
          </p>
          <p className="truncate text-sm font-semibold leading-tight">{node.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {leader
              ? `${roleLabel}: ${unitDisplayLabel(leader)}`
              : `${roleLabel}: —`}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpen((v) => !v)}
            aria-label={`Edit ${node.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDelete}
            aria-label={`Delete ${node.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-[4.5rem] flex-1 space-y-1 overflow-y-auto">
        {assignedUnits.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Drop units here</p>
        ) : (
          assignedUnits.map((u) => <UnitChip key={u.id} unit={u} />)
        )}
      </div>

      {open ? (
        <div
          className="absolute inset-0 z-20 flex flex-col gap-1.5 overflow-y-auto bg-popover p-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Edit
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[11px]"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
          <Input
            className="h-7 text-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            disabled={pending}
          />
          <Select
            className="h-7 text-xs"
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value as OrgNodeType)}
            disabled={pending}
          >
            <option value="branch">Branch</option>
            <option value="division">Division</option>
            <option value="group">Group</option>
            <option value="section">Section</option>
          </Select>
          <Select
            className="h-7 text-xs"
            value={leaderUnitId}
            onChange={(e) => setLeaderUnitId(e.target.value)}
            disabled={pending || assignedUnits.length === 0}
            aria-label={ORG_NODE_LEADER_ROLE_LABELS[nodeType]}
          >
            <option value="">
              {assignedUnits.length === 0
                ? "Assign units first…"
                : `${ORG_NODE_LEADER_ROLE_LABELS[nodeType]}…`}
            </option>
            {assignedUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {unitDisplayLabel(u)}
                {incidentUnitKindLabel(u.unit_type)
                  ? ` · ${incidentUnitKindLabel(u.unit_type)}`
                  : ""}
              </option>
            ))}
          </Select>
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          <Button
            type="button"
            size="sm"
            className="mt-auto h-7 w-full text-xs"
            disabled={pending || !name.trim()}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await updateOrgNode({
                    incidentId: node.incident_id,
                    nodeId: node.id,
                    name,
                    nodeType,
                    leaderUnitId: leaderUnitId || null,
                  });
                  setOpen(false);
                  onChanged();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to save");
                }
              });
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function IncidentOrgCards({
  incidentId,
  orgNodes,
  units,
  activeAssignmentByUnit,
  onChanged,
}: {
  incidentId: string;
  orgNodes: IncidentOrgNode[];
  units: IncidentUnit[];
  activeAssignmentByUnit: Map<string, IncidentAssignment>;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState<OrgNodeType>("division");
  const [error, setError] = useState<string | null>(null);

  const unitsForNode = (nodeId: string) =>
    units.filter((u) => activeAssignmentByUnit.get(u.id)?.org_node_id === nodeId);

  const sortedNodes = [...orgNodes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="max-h-[40%] shrink-0 overflow-y-auto border-b bg-muted/20 px-3 py-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Organization</h2>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await createOrgNode({
                  incidentId,
                  name: nodeName,
                  nodeType,
                });
                setNodeName("");
                onChanged();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add");
              }
            });
          }}
        >
          <Select
            className="h-8 w-28"
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value as OrgNodeType)}
            disabled={pending}
          >
            <option value="branch">Branch</option>
            <option value="division">Division</option>
            <option value="group">Group</option>
            <option value="section">Section</option>
          </Select>
          <Input
            className="h-8 w-40"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            placeholder="e.g. Division B"
            required
            disabled={pending}
          />
          <Button type="submit" size="sm" className="h-8" disabled={pending || !nodeName.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </form>
      </div>

      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}

      <div className="flex gap-3 overflow-x-auto pb-1">
        {sortedNodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a Division or Group to assign units.</p>
        ) : (
          sortedNodes.map((node) => (
            <OrgCard
              key={node.id}
              node={node}
              assignedUnits={unitsForNode(node.id)}
              onChanged={onChanged}
              onDelete={() =>
                startTransition(async () => {
                  await deleteOrgNode(incidentId, node.id);
                  onChanged();
                })
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
