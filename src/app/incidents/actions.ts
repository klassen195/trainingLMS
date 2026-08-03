"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertCapability, requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseErrorMessage } from "@/lib/supabase/errors";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_WORK_PERIOD_MINUTES,
  INCIDENT_ASSIGNMENT_SELECT,
  INCIDENT_MAP_OVERLAY_SELECT,
  INCIDENT_MAP_PLACEMENT_SELECT,
  INCIDENT_MAP_POLYGON_SELECT,
  INCIDENT_ORG_NODE_SELECT,
  INCIDENT_SELECT,
  INCIDENT_TYPES,
  INCIDENT_UNIT_SELECT,
  ORG_NODE_TYPES,
  closePolygonRing,
  apparatusTypeToIncidentUnitKind,
  type Incident,
  type IncidentAssignment,
  type IncidentMapOverlay,
  type IncidentMapPlacement,
  type IncidentMapPolygon,
  type IncidentOrgNode,
  type IncidentType,
  type IncidentUnit,
  type IncidentWorkspaceData,
  type OrgNodeType,
  type PolygonRing,
} from "@/lib/incident-types";
import { assetDisplayLabel } from "@/lib/assets-types";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  throw new Error(supabaseErrorMessage(error));
}

function revalidateIncident(incidentId?: string) {
  revalidatePath("/incidents");
  if (incidentId) {
    revalidatePath(`/incidents/${incidentId}`);
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseIncidentType(value: FormDataEntryValue | null): IncidentType {
  const raw = String(value ?? "structure_fire");
  if ((INCIDENT_TYPES as readonly string[]).includes(raw)) {
    return raw as IncidentType;
  }
  return "structure_fire";
}

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

function parseFloatOr(value: FormDataEntryValue | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function listIncidents(): Promise<Incident[]> {
  await requireCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("incidents")
    .select(INCIDENT_SELECT)
    .order("created_at", { ascending: false });
  throwIfDbError(error);
  return (data ?? []) as Incident[];
}

export async function loadIncidentWorkspace(incidentId: string): Promise<IncidentWorkspaceData> {
  await requireCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const { data: incident, error: incidentError } = await supabase
    .from("incidents")
    .select(INCIDENT_SELECT)
    .eq("id", incidentId)
    .maybeSingle();
  throwIfDbError(incidentError);
  if (!incident) throw new Error("Incident not found.");

  const [
    { data: orgNodes, error: orgError },
    { data: units, error: unitsError },
    { data: assignments, error: assignmentsError },
    { data: placements, error: placementsError },
    { data: overlays, error: overlaysError },
    { data: polygons, error: polygonsError },
  ] = await Promise.all([
    supabase
      .from("incident_org_nodes")
      .select(INCIDENT_ORG_NODE_SELECT)
      .eq("incident_id", incidentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("incident_units")
      .select(INCIDENT_UNIT_SELECT)
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: true }),
    supabase
      .from("incident_assignments")
      .select(INCIDENT_ASSIGNMENT_SELECT)
      .eq("incident_id", incidentId)
      .order("started_at", { ascending: true }),
    supabase
      .from("incident_map_placements")
      .select(INCIDENT_MAP_PLACEMENT_SELECT)
      .eq("incident_id", incidentId),
    supabase
      .from("incident_map_overlays")
      .select(INCIDENT_MAP_OVERLAY_SELECT)
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("incident_map_polygons")
      .select(INCIDENT_MAP_POLYGON_SELECT)
      .eq("incident_id", incidentId)
      .order("sort_order", { ascending: true }),
  ]);

  throwIfDbError(orgError);
  throwIfDbError(unitsError);
  throwIfDbError(assignmentsError);
  throwIfDbError(placementsError);
  throwIfDbError(overlaysError);
  throwIfDbError(polygonsError);

  const overlayRows = (overlays ?? []) as IncidentMapOverlay[];
  const overlaySignedUrls: Record<string, string> = {};
  await Promise.all(
    overlayRows.map(async (overlay) => {
      const { data: signed } = await supabase.storage
        .from("incident-overlays")
        .createSignedUrl(overlay.storage_path, 60 * 60);
      if (signed?.signedUrl) {
        overlaySignedUrls[overlay.id] = signed.signedUrl;
      }
    })
  );

  return {
    incident: incident as Incident,
    orgNodes: (orgNodes ?? []) as IncidentOrgNode[],
    units: (units ?? []) as IncidentUnit[],
    assignments: (assignments ?? []) as IncidentAssignment[],
    placements: (placements ?? []) as IncidentMapPlacement[],
    overlays: overlayRows,
    overlaySignedUrls,
    polygons: (polygons ?? []) as IncidentMapPolygon[],
  };
}

export async function createIncident(formData: FormData) {
  const profile = await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Incident name is required.");

  const incident_type = parseIncidentType(formData.get("incident_type"));
  const location_text = emptyToNull(String(formData.get("location_text") ?? ""));
  const map_center_lng = parseFloatOr(formData.get("map_center_lng"), DEFAULT_MAP_CENTER.lng);
  const map_center_lat = parseFloatOr(formData.get("map_center_lat"), DEFAULT_MAP_CENTER.lat);
  const map_zoom = parseFloatOr(formData.get("map_zoom"), DEFAULT_MAP_ZOOM);
  const default_work_period_minutes = parsePositiveInt(
    formData.get("default_work_period_minutes"),
    DEFAULT_WORK_PERIOD_MINUTES
  );

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      name,
      incident_type,
      location_text,
      map_center_lng,
      map_center_lat,
      map_zoom,
      default_work_period_minutes,
      created_by: profile.id,
      status: "active",
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (!data) throw new Error("Failed to create incident.");

  // Seed a starter Division A so the board isn't empty
  await supabase.from("incident_org_nodes").insert({
    incident_id: data.id,
    parent_id: null,
    node_type: "division",
    name: "Division A",
    sort_order: 0,
  });

  revalidateIncident(data.id);
  redirect(`/incidents/${data.id}`);
}

export async function closeIncident(incidentId: string) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("incidents")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", incidentId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function reopenIncident(incidentId: string) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("incidents")
    .update({ status: "active", closed_at: null })
    .eq("id", incidentId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function updateIncidentMapView(
  incidentId: string,
  center: { lng: number; lat: number },
  zoom: number
) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("incidents")
    .update({
      map_center_lng: center.lng,
      map_center_lat: center.lat,
      map_zoom: zoom,
    })
    .eq("id", incidentId);
  throwIfDbError(error);
}

export async function createOrgNode(input: {
  incidentId: string;
  name: string;
  nodeType: OrgNodeType;
  parentId?: string | null;
}) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");

  const { data: siblings, error: siblingsError } = input.parentId
    ? await supabase
        .from("incident_org_nodes")
        .select("sort_order")
        .eq("incident_id", input.incidentId)
        .eq("parent_id", input.parentId)
        .order("sort_order", { ascending: false })
        .limit(1)
    : await supabase
        .from("incident_org_nodes")
        .select("sort_order")
        .eq("incident_id", input.incidentId)
        .is("parent_id", null)
        .order("sort_order", { ascending: false })
        .limit(1);
  throwIfDbError(siblingsError);

  const sort_order = (siblings?.[0]?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("incident_org_nodes").insert({
    incident_id: input.incidentId,
    parent_id: input.parentId ?? null,
    node_type: input.nodeType,
    name,
    sort_order,
  });
  throwIfDbError(error);
  revalidateIncident(input.incidentId);
}

export async function deleteOrgNode(incidentId: string, nodeId: string) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("incident_org_nodes").delete().eq("id", nodeId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

async function assertUnitOnIncident(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  incidentId: string,
  unitId: string
) {
  const { data, error } = await supabase
    .from("incident_units")
    .select("id")
    .eq("id", unitId)
    .eq("incident_id", incidentId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new Error("Unit is not on this incident.");
}

export async function updateOrgNode(input: {
  incidentId: string;
  nodeId: string;
  name: string;
  nodeType: OrgNodeType;
  leaderUnitId?: string | null;
}) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  if (!(ORG_NODE_TYPES as readonly string[]).includes(input.nodeType)) {
    throw new Error("Invalid org node type.");
  }

  const leaderUnitId = input.leaderUnitId ?? null;
  if (leaderUnitId) {
    await assertUnitOnIncident(supabase, input.incidentId, leaderUnitId);
    const { data: assignment, error: assignmentError } = await supabase
      .from("incident_assignments")
      .select("id")
      .eq("incident_id", input.incidentId)
      .eq("unit_id", leaderUnitId)
      .eq("org_node_id", input.nodeId)
      .is("ended_at", null)
      .maybeSingle();
    throwIfDbError(assignmentError);
    if (!assignment) {
      throw new Error("Supervisor must be a unit assigned to this org node.");
    }
  }

  const { error } = await supabase
    .from("incident_org_nodes")
    .update({
      name,
      node_type: input.nodeType,
      leader_unit_id: leaderUnitId,
    })
    .eq("id", input.nodeId)
    .eq("incident_id", input.incidentId);
  throwIfDbError(error);
  revalidateIncident(input.incidentId);
}

export async function setIncidentCommand(incidentId: string, unitId: string | null) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  if (unitId) {
    await assertUnitOnIncident(supabase, incidentId, unitId);
  }

  const { error } = await supabase
    .from("incidents")
    .update({ ic_unit_id: unitId })
    .eq("id", incidentId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function addHomeUnit(
  incidentId: string,
  assetId: string,
  unitType?: string | null
) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, kind, name, unit_number, build_number, apparatus_type")
    .eq("id", assetId)
    .eq("kind", "apparatus")
    .maybeSingle();
  throwIfDbError(assetError);
  if (!asset) throw new Error("Apparatus not found.");

  const label = assetDisplayLabel({
    kind: "apparatus",
    name: asset.name,
    unit_number: asset.unit_number,
    build_number: asset.build_number,
  });

  const resolvedType =
    emptyToNull(unitType ?? undefined) ?? apparatusTypeToIncidentUnitKind(asset.apparatus_type);

  const { error } = await supabase.from("incident_units").insert({
    incident_id: incidentId,
    asset_id: assetId,
    label,
    agency_name: "Kootenai Fire",
    unit_type: resolvedType,
    status: "staged",
  });
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function addMutualAidUnit(input: {
  incidentId: string;
  label: string;
  agencyName: string;
  unitType?: string | null;
}) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const label = input.label.trim();
  const agency_name = input.agencyName.trim();
  if (!label) throw new Error("Unit label is required.");
  if (!agency_name) throw new Error("Agency name is required.");
  const unit_type = emptyToNull(input.unitType ?? undefined);
  if (!unit_type) throw new Error("Unit kind is required.");

  const { error } = await supabase.from("incident_units").insert({
    incident_id: input.incidentId,
    asset_id: null,
    label,
    agency_name,
    unit_type,
    status: "staged",
  });
  throwIfDbError(error);
  revalidateIncident(input.incidentId);
}

export async function updateIncidentUnitType(
  incidentId: string,
  unitId: string,
  unitType: string
) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const unit_type = unitType.trim();
  if (!unit_type) throw new Error("Unit kind is required.");

  const { error } = await supabase
    .from("incident_units")
    .update({ unit_type })
    .eq("id", unitId)
    .eq("incident_id", incidentId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function removeUnit(incidentId: string, unitId: string) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("incident_units").delete().eq("id", unitId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function assignUnit(input: {
  incidentId: string;
  unitId: string;
  orgNodeId: string;
  workPeriodMinutes?: number;
}) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const { data: incident } = await supabase
    .from("incidents")
    .select("default_work_period_minutes")
    .eq("id", input.incidentId)
    .maybeSingle();

  const work_period_minutes =
    input.workPeriodMinutes && input.workPeriodMinutes > 0
      ? Math.round(input.workPeriodMinutes)
      : (incident?.default_work_period_minutes ?? DEFAULT_WORK_PERIOD_MINUTES);

  // End any active assignment for this unit
  const { error: endError } = await supabase
    .from("incident_assignments")
    .update({ ended_at: new Date().toISOString() })
    .eq("unit_id", input.unitId)
    .is("ended_at", null);
  throwIfDbError(endError);

  const { error } = await supabase.from("incident_assignments").insert({
    incident_id: input.incidentId,
    unit_id: input.unitId,
    org_node_id: input.orgNodeId,
    started_at: new Date().toISOString(),
    work_period_minutes,
  });
  throwIfDbError(error);

  await supabase
    .from("incident_units")
    .update({ status: "assigned" })
    .eq("id", input.unitId);

  revalidateIncident(input.incidentId);
}

export async function releaseAssignment(incidentId: string, assignmentId: string) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const { data: assignment, error: fetchError } = await supabase
    .from("incident_assignments")
    .select("id, unit_id")
    .eq("id", assignmentId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!assignment) throw new Error("Assignment not found.");

  const { error } = await supabase
    .from("incident_assignments")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", assignmentId);
  throwIfDbError(error);

  await supabase
    .from("incident_units")
    .update({ status: "available" })
    .eq("id", assignment.unit_id);

  // Clear org leadership if this unit was a supervisor
  await supabase
    .from("incident_org_nodes")
    .update({ leader_unit_id: null })
    .eq("incident_id", incidentId)
    .eq("leader_unit_id", assignment.unit_id);

  revalidateIncident(incidentId);
}

export async function renewAssignment(
  incidentId: string,
  assignmentId: string,
  workPeriodMinutes?: number
) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const { data: assignment, error: fetchError } = await supabase
    .from("incident_assignments")
    .select(INCIDENT_ASSIGNMENT_SELECT)
    .eq("id", assignmentId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!assignment) throw new Error("Assignment not found.");

  const minutes =
    workPeriodMinutes && workPeriodMinutes > 0
      ? Math.round(workPeriodMinutes)
      : assignment.work_period_minutes;

  const { error } = await supabase
    .from("incident_assignments")
    .update({
      started_at: new Date().toISOString(),
      work_period_minutes: minutes,
      ended_at: null,
    })
    .eq("id", assignmentId);
  throwIfDbError(error);

  await supabase
    .from("incident_units")
    .update({ status: "assigned" })
    .eq("id", assignment.unit_id);

  revalidateIncident(incidentId);
}

export async function upsertMapPlacement(input: {
  incidentId: string;
  unitId: string;
  lng: number;
  lat: number;
  overlayX?: number | null;
  overlayY?: number | null;
}) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("incident_map_placements").upsert(
    {
      incident_id: input.incidentId,
      unit_id: input.unitId,
      lng: input.lng,
      lat: input.lat,
      overlay_x: input.overlayX ?? null,
      overlay_y: input.overlayY ?? null,
    },
    { onConflict: "unit_id" }
  );
  throwIfDbError(error);
  revalidateIncident(input.incidentId);
}

export async function removeMapPlacement(incidentId: string, unitId: string) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("incident_map_placements").delete().eq("unit_id", unitId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function uploadMapOverlay(incidentId: string, formData: FormData) {
  const profile = await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an image file.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const storage_path = `${incidentId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("incident-overlays")
    .upload(storage_path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  // Deactivate prior overlays
  await supabase
    .from("incident_map_overlays")
    .update({ is_active: false })
    .eq("incident_id", incidentId)
    .eq("is_active", true);

  const { data: incident } = await supabase
    .from("incidents")
    .select("map_center_lng, map_center_lat, map_zoom")
    .eq("id", incidentId)
    .maybeSingle();

  // Fit overlay roughly around current map center (~0.8km box at default zoom)
  const lng = incident?.map_center_lng ?? DEFAULT_MAP_CENTER.lng;
  const lat = incident?.map_center_lat ?? DEFAULT_MAP_CENTER.lat;
  const half = 0.004;

  const { error } = await supabase.from("incident_map_overlays").insert({
    incident_id: incidentId,
    storage_path,
    file_name: file.name,
    mime_type: file.type || null,
    west: lng - half,
    south: lat - half * 0.7,
    east: lng + half,
    north: lat + half * 0.7,
    opacity: 0.75,
    is_active: true,
    created_by: profile.id,
  });
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function updateOverlayBounds(
  incidentId: string,
  overlayId: string,
  bounds: { west: number; south: number; east: number; north: number }
) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("incident_map_overlays")
    .update(bounds)
    .eq("id", overlayId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function setOverlayActive(incidentId: string, overlayId: string, isActive: boolean) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  if (isActive) {
    await supabase
      .from("incident_map_overlays")
      .update({ is_active: false })
      .eq("incident_id", incidentId)
      .eq("is_active", true);
  }
  const { error } = await supabase
    .from("incident_map_overlays")
    .update({ is_active: isActive })
    .eq("id", overlayId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function deleteOverlay(incidentId: string, overlayId: string) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { data: overlay } = await supabase
    .from("incident_map_overlays")
    .select("storage_path")
    .eq("id", overlayId)
    .maybeSingle();

  const { error } = await supabase.from("incident_map_overlays").delete().eq("id", overlayId);
  throwIfDbError(error);

  if (overlay?.storage_path) {
    await supabase.storage.from("incident-overlays").remove([overlay.storage_path]);
  }
  revalidateIncident(incidentId);
}

export async function createMapPolygon(input: {
  incidentId: string;
  coordinates: PolygonRing;
  label?: string | null;
  fillColor?: string;
  strokeColor?: string;
  fillOpacity?: number;
}) {
  const profile = await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const ring = closePolygonRing(input.coordinates);
  if (ring.length < 4) {
    throw new Error("A polygon needs at least 3 vertices.");
  }

  const { data: siblings } = await supabase
    .from("incident_map_polygons")
    .select("sort_order")
    .eq("incident_id", input.incidentId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("incident_map_polygons").insert({
    incident_id: input.incidentId,
    label: emptyToNull(input.label ?? undefined),
    coordinates: ring,
    fill_color: input.fillColor ?? "#dc2626",
    stroke_color: input.strokeColor ?? "#991b1b",
    fill_opacity: input.fillOpacity ?? 0.4,
    stroke_width: 3,
    sort_order: (siblings?.[0]?.sort_order ?? -1) + 1,
    created_by: profile.id,
  });
  throwIfDbError(error);
  revalidateIncident(input.incidentId);
}

export async function updateMapPolygon(input: {
  incidentId: string;
  polygonId: string;
  label?: string | null;
  fillColor?: string;
  strokeColor?: string;
  fillOpacity?: number;
  coordinates?: PolygonRing;
}) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();

  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) {
    patch.label = emptyToNull(input.label ?? undefined);
  }
  if (input.fillColor) patch.fill_color = input.fillColor;
  if (input.strokeColor) patch.stroke_color = input.strokeColor;
  if (input.fillOpacity != null) patch.fill_opacity = input.fillOpacity;
  if (input.coordinates) {
    const ring = closePolygonRing(input.coordinates);
    if (ring.length < 4) {
      throw new Error("A polygon needs at least 3 vertices.");
    }
    patch.coordinates = ring;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("incident_map_polygons")
    .update(patch)
    .eq("id", input.polygonId)
    .eq("incident_id", input.incidentId);
  throwIfDbError(error);
  revalidateIncident(input.incidentId);
}

export async function deleteMapPolygon(incidentId: string, polygonId: string) {
  await assertCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("incident_map_polygons").delete().eq("id", polygonId);
  throwIfDbError(error);
  revalidateIncident(incidentId);
}

export async function listApparatusForIncident(): Promise<
  { id: string; label: string; apparatus_type: string | null }[]
> {
  await requireCapability("manage_incidents");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .select("id, name, unit_number, build_number, apparatus_type, kind")
    .eq("kind", "apparatus")
    .order("unit_number", { ascending: true });
  throwIfDbError(error);

  return (data ?? []).map((asset) => ({
    id: asset.id,
    label: assetDisplayLabel({
      kind: "apparatus",
      name: asset.name,
      unit_number: asset.unit_number,
      build_number: asset.build_number,
    }),
    apparatus_type: asset.apparatus_type,
  }));
}
