"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  assignUnit,
  closeIncident,
  reopenIncident,
  renewAssignment,
  releaseAssignment,
  setIncidentCommand,
} from "@/app/incidents/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { IncidentAddUnitsPanel, IncidentStagingInset } from "@/components/incidents/IncidentOrgPanel";
import { IncidentOrgCards } from "@/components/incidents/IncidentOrgCards";
import { IncidentAssignmentClock } from "@/components/incidents/IncidentAssignmentClock";
import { IncidentMapBoard } from "@/components/incidents/IncidentMapBoard";
import {
  INCIDENT_TYPE_LABELS,
  unitDisplayLabel,
  type IncidentAssignment,
  type IncidentOrgNode,
  type IncidentUnit,
  type IncidentWorkspaceData,
} from "@/lib/incident-types";

type ApparatusOption = { id: string; label: string; apparatus_type: string | null };

export function IncidentWorkspace({
  initial,
  apparatusOptions,
}: {
  initial: IncidentWorkspaceData;
  apparatusOptions: ApparatusOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [incident, setIncident] = useState(initial.incident);
  const [orgNodes, setOrgNodes] = useState(initial.orgNodes);
  const [units, setUnits] = useState(initial.units);
  const [assignments, setAssignments] = useState(initial.assignments);
  const [placements, setPlacements] = useState(initial.placements);
  const [overlays, setOverlays] = useState(initial.overlays);
  const [overlaySignedUrls, setOverlaySignedUrls] = useState(initial.overlaySignedUrls);
  const [polygons, setPolygons] = useState(initial.polygons);
  const [activeDragUnitId, setActiveDragUnitId] = useState<string | null>(null);
  const [mapDropUnitId, setMapDropUnitId] = useState<string | null>(null);
  // Start null so SSR and first client paint match; set after mount
  const [now, setNow] = useState<number | null>(null);
  // Defer DndContext until client mount — avoids aria-describedby ID hydration mismatches
  const [dndReady, setDndReady] = useState(false);

  useEffect(() => {
    setDndReady(true);
  }, []);

  useEffect(() => {
    setIncident(initial.incident);
    setOrgNodes(initial.orgNodes);
    setUnits(initial.units);
    setAssignments(initial.assignments);
    setPlacements(initial.placements);
    setOverlays(initial.overlays);
    setOverlaySignedUrls(initial.overlaySignedUrls);
    setPolygons(initial.polygons);
  }, [initial]);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime sync
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`incident-${incident.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents", filter: `id=eq.${incident.id}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_org_nodes",
          filter: `incident_id=eq.${incident.id}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_units",
          filter: `incident_id=eq.${incident.id}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_assignments",
          filter: `incident_id=eq.${incident.id}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_map_placements",
          filter: `incident_id=eq.${incident.id}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_map_overlays",
          filter: `incident_id=eq.${incident.id}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_map_polygons",
          filter: `incident_id=eq.${incident.id}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [incident.id, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const unitsById = useMemo(() => {
    const map = new Map<string, IncidentUnit>();
    for (const u of units) map.set(u.id, u);
    return map;
  }, [units]);

  const orgById = useMemo(() => {
    const map = new Map<string, IncidentOrgNode>();
    for (const n of orgNodes) map.set(n.id, n);
    return map;
  }, [orgNodes]);

  const activeAssignments = useMemo(
    () => assignments.filter((a) => !a.ended_at),
    [assignments]
  );

  const activeAssignmentByUnit = useMemo(() => {
    const map = new Map<string, IncidentAssignment>();
    for (const a of activeAssignments) map.set(a.unit_id, a);
    return map;
  }, [activeAssignments]);

  const unassignedUnits = useMemo(
    () => units.filter((u) => !activeAssignmentByUnit.has(u.id)),
    [units, activeAssignmentByUnit]
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith("unit:")) {
      setActiveDragUnitId(id.slice(5));
    }
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const unitId = activeDragUnitId;
      setActiveDragUnitId(null);
      if (!unitId || !event.over) return;

      const overId = String(event.over.id);
      if (overId.startsWith("org:")) {
        const orgNodeId = overId.slice(4);
        startTransition(async () => {
          await assignUnit({
            incidentId: incident.id,
            unitId,
            orgNodeId,
          });
          router.refresh();
        });
        return;
      }
      if (overId === "staging-drop") {
        const assignment = activeAssignmentByUnit.get(unitId);
        if (!assignment) return;
        startTransition(async () => {
          await releaseAssignment(incident.id, assignment.id);
          router.refresh();
        });
        return;
      }
      if (overId === "map-drop") {
        setMapDropUnitId(unitId);
      }
    },
    [activeAssignmentByUnit, activeDragUnitId, incident.id, router]
  );

  const onWorkspaceChanged = useCallback(() => {
    router.refresh();
  }, [router]);

  const onMapDropConsumed = useCallback(() => {
    setMapDropUnitId(null);
  }, []);

  const dragUnit = activeDragUnitId ? unitsById.get(activeDragUnitId) : null;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[32rem] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{incident.name}</h1>
          <Badge variant={incident.status === "active" ? "default" : "secondary"}>
            {incident.status === "active" ? "Active" : "Closed"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {INCIDENT_TYPE_LABELS[incident.incident_type]}
            {incident.location_text ? ` · ${incident.location_text}` : ""}
          </span>
          <span className="text-muted-foreground">·</span>
          <label className="inline-flex shrink-0 items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              IC
            </span>
            <Select
              className="h-8 w-auto min-w-[10rem] text-sm font-medium"
              value={incident.ic_unit_id ?? ""}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.value || null;
                startTransition(async () => {
                  await setIncidentCommand(incident.id, next);
                  router.refresh();
                });
              }}
            >
              <option value="">Unassigned</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {unitDisplayLabel(u)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="flex gap-2">
          {incident.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await closeIncident(incident.id);
                  router.refresh();
                })
              }
            >
              Close incident
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await reopenIncident(incident.id);
                  router.refresh();
                })
              }
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

      {!dndReady ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading tactical board…
        </div>
      ) : (
      <DndContext
        id={`incident-${incident.id}`}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[14rem_1fr_15rem]">
          <IncidentAddUnitsPanel
            incidentId={incident.id}
            units={units}
            apparatusOptions={apparatusOptions}
            onChanged={onWorkspaceChanged}
          />

          <div className="flex min-h-0 min-w-0 flex-col">
            <IncidentOrgCards
              incidentId={incident.id}
              orgNodes={orgNodes}
              units={units}
              activeAssignmentByUnit={activeAssignmentByUnit}
              onChanged={onWorkspaceChanged}
            />
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <IncidentMapBoard
                incident={incident}
                units={units}
                placements={placements}
                overlays={overlays}
                overlaySignedUrls={overlaySignedUrls}
                polygons={polygons}
                mapDropUnitId={mapDropUnitId}
                onMapDropConsumed={onMapDropConsumed}
                onChanged={onWorkspaceChanged}
                onPlacementsLocal={setPlacements}
                leftInset={
                  <IncidentStagingInset
                    incidentId={incident.id}
                    unassignedUnits={unassignedUnits}
                    onChanged={onWorkspaceChanged}
                  />
                }
              />
            </div>
          </div>

          <IncidentAssignmentClock
            now={now}
            assignments={activeAssignments}
            unitsById={unitsById}
            orgById={orgById}
            pending={pending}
            onRenew={(assignmentId) =>
              startTransition(async () => {
                await renewAssignment(incident.id, assignmentId);
                router.refresh();
              })
            }
            onRelease={(assignmentId) =>
              startTransition(async () => {
                await releaseAssignment(incident.id, assignmentId);
                router.refresh();
              })
            }
          />
        </div>

        <DragOverlay>
          {dragUnit ? (
            <div className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-md">
              {unitDisplayLabel(dragUnit)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}
    </div>
  );
}
