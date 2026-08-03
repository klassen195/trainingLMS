export const INCIDENT_TYPES = [
  "structure_fire",
  "wildland",
  "ems",
  "hazmat",
  "tech_rescue",
  "mci",
  "other",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_STATUSES = ["active", "closed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const ORG_NODE_TYPES = ["section", "branch", "division", "group"] as const;
export type OrgNodeType = (typeof ORG_NODE_TYPES)[number];

export const INCIDENT_UNIT_STATUSES = [
  "staged",
  "assigned",
  "available",
  "out_of_service",
] as const;
export type IncidentUnitStatus = (typeof INCIDENT_UNIT_STATUSES)[number];

/** Tactical board unit kinds (ICS resource typing) */
export const INCIDENT_UNIT_KINDS = [
  "engine",
  "ladder",
  "brush",
  "tender",
  "medic",
  "command",
  "utv",
] as const;
export type IncidentUnitKind = (typeof INCIDENT_UNIT_KINDS)[number];

export const INCIDENT_UNIT_KIND_LABELS: Record<IncidentUnitKind, string> = {
  engine: "Engine",
  ladder: "Ladder",
  brush: "Brush",
  tender: "Tender",
  medic: "Medic",
  command: "Command",
  utv: "UTV",
};

/** Map marker colors by unit kind (label stays on org cards / staged list) */
export const INCIDENT_UNIT_KIND_MARKER_COLORS: Record<
  IncidentUnitKind,
  { bg: string; border: string }
> = {
  engine: { bg: "bg-red-600", border: "border-red-900" },
  ladder: { bg: "bg-amber-500", border: "border-amber-800" },
  brush: { bg: "bg-emerald-600", border: "border-emerald-900" },
  tender: { bg: "bg-sky-600", border: "border-sky-900" },
  medic: { bg: "bg-rose-500", border: "border-rose-800" },
  command: { bg: "bg-violet-700", border: "border-violet-950" },
  utv: { bg: "bg-teal-600", border: "border-teal-900" },
};

const UNKNOWN_UNIT_MARKER_COLORS = { bg: "bg-zinc-600", border: "border-zinc-800" };

export function isIncidentUnitKind(value: string | null | undefined): value is IncidentUnitKind {
  return Boolean(value && (INCIDENT_UNIT_KINDS as readonly string[]).includes(value));
}

export function incidentUnitKindLabel(value: string | null | undefined) {
  if (isIncidentUnitKind(value)) return INCIDENT_UNIT_KIND_LABELS[value];
  return value?.trim() || null;
}

export function incidentUnitMarkerColors(unitType: string | null | undefined) {
  if (isIncidentUnitKind(unitType)) return INCIDENT_UNIT_KIND_MARKER_COLORS[unitType];
  return UNKNOWN_UNIT_MARKER_COLORS;
}

/** Map inventory apparatus_type onto a tactical unit kind when possible */
export function apparatusTypeToIncidentUnitKind(
  apparatusType: string | null | undefined
): IncidentUnitKind | null {
  if (apparatusType === "engine") return "engine";
  if (apparatusType === "ladder") return "ladder";
  if (apparatusType === "tender") return "tender";
  if (apparatusType === "ambulance") return "medic";
  return null;
}

export type Incident = {
  id: string;
  name: string;
  incident_type: IncidentType;
  status: IncidentStatus;
  location_text: string | null;
  map_center_lng: number;
  map_center_lat: number;
  map_zoom: number;
  default_work_period_minutes: number;
  ic_unit_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type IncidentOrgNode = {
  id: string;
  incident_id: string;
  parent_id: string | null;
  node_type: OrgNodeType;
  name: string;
  sort_order: number;
  leader_unit_id: string | null;
  created_at: string;
};

export type IncidentUnit = {
  id: string;
  incident_id: string;
  asset_id: string | null;
  label: string;
  agency_name: string | null;
  unit_type: string | null;
  status: IncidentUnitStatus;
  created_at: string;
};

export type IncidentAssignment = {
  id: string;
  incident_id: string;
  unit_id: string;
  org_node_id: string;
  started_at: string;
  work_period_minutes: number;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
};

export type IncidentMapOverlay = {
  id: string;
  incident_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  west: number | null;
  south: number | null;
  east: number | null;
  north: number | null;
  opacity: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type IncidentMapPlacement = {
  id: string;
  incident_id: string;
  unit_id: string;
  lng: number;
  lat: number;
  overlay_x: number | null;
  overlay_y: number | null;
  updated_at: string;
};

/** Closed ring of [lng, lat] pairs */
export type PolygonRing = [number, number][];

export type IncidentMapPolygon = {
  id: string;
  incident_id: string;
  label: string | null;
  coordinates: PolygonRing;
  fill_color: string;
  fill_opacity: number;
  stroke_color: string;
  stroke_width: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_POLYGON_FILL_OPACITY = 0.4;

export type IncidentWorkspaceData = {
  incident: Incident;
  orgNodes: IncidentOrgNode[];
  units: IncidentUnit[];
  assignments: IncidentAssignment[];
  placements: IncidentMapPlacement[];
  overlays: IncidentMapOverlay[];
  overlaySignedUrls: Record<string, string>;
  polygons: IncidentMapPolygon[];
};

export const INCIDENT_SELECT =
  "id, name, incident_type, status, location_text, map_center_lng, map_center_lat, map_zoom, default_work_period_minutes, ic_unit_id, created_by, created_at, updated_at, closed_at";

export const INCIDENT_ORG_NODE_SELECT =
  "id, incident_id, parent_id, node_type, name, sort_order, leader_unit_id, created_at";

export const INCIDENT_UNIT_SELECT =
  "id, incident_id, asset_id, label, agency_name, unit_type, status, created_at";

export const INCIDENT_ASSIGNMENT_SELECT =
  "id, incident_id, unit_id, org_node_id, started_at, work_period_minutes, ended_at, notes, created_at";

export const INCIDENT_MAP_OVERLAY_SELECT =
  "id, incident_id, storage_path, file_name, mime_type, west, south, east, north, opacity, is_active, created_by, created_at";

export const INCIDENT_MAP_PLACEMENT_SELECT =
  "id, incident_id, unit_id, lng, lat, overlay_x, overlay_y, updated_at";

export const INCIDENT_MAP_POLYGON_SELECT =
  "id, incident_id, label, coordinates, fill_color, fill_opacity, stroke_color, stroke_width, sort_order, created_by, created_at, updated_at";

export const POLYGON_COLOR_PRESETS = [
  { label: "Red", fill: "#dc2626", stroke: "#991b1b" },
  { label: "Orange", fill: "#ea580c", stroke: "#9a3412" },
  { label: "Yellow", fill: "#ca8a04", stroke: "#854d0e" },
  { label: "Blue", fill: "#2563eb", stroke: "#1e40af" },
  { label: "Green", fill: "#16a34a", stroke: "#166534" },
  { label: "Purple", fill: "#9333ea", stroke: "#6b21a8" },
] as const;

export function closePolygonRing(ring: PolygonRing): PolygonRing {
  if (ring.length < 3) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx === lx && fy === ly) return ring;
  return [...ring, [fx, fy]];
}

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  structure_fire: "Structure fire",
  wildland: "Wildland",
  ems: "EMS",
  hazmat: "HazMat",
  tech_rescue: "Tech rescue",
  mci: "MCI",
  other: "Other",
};

export const ORG_NODE_TYPE_LABELS: Record<OrgNodeType, string> = {
  section: "Section",
  branch: "Branch",
  division: "Division",
  group: "Group",
};

export const ORG_NODE_LEADER_ROLE_LABELS: Record<OrgNodeType, string> = {
  section: "Section Chief",
  branch: "Branch Director",
  division: "Division Supervisor",
  group: "Group Supervisor",
};

/** Default map center: Coeur d'Alene / Kootenai County area */
export const DEFAULT_MAP_CENTER = { lng: -116.7805, lat: 47.6777 } as const;
export const DEFAULT_MAP_ZOOM = 14;
export const DEFAULT_WORK_PERIOD_MINUTES = 20;

export function unitDisplayLabel(unit: Pick<IncidentUnit, "label" | "agency_name">) {
  if (unit.agency_name?.trim()) {
    return `${unit.label} (${unit.agency_name.trim()})`;
  }
  return unit.label;
}

export function assignmentEndsAt(assignment: Pick<IncidentAssignment, "started_at" | "work_period_minutes">) {
  return new Date(
    new Date(assignment.started_at).getTime() + assignment.work_period_minutes * 60_000
  );
}

export function assignmentRemainingMs(
  assignment: Pick<IncidentAssignment, "started_at" | "work_period_minutes" | "ended_at">,
  now = Date.now()
) {
  if (assignment.ended_at) return 0;
  return assignmentEndsAt(assignment).getTime() - now;
}

export function formatRemaining(ms: number) {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const body = `${min}:${sec.toString().padStart(2, "0")}`;
  return overdue ? `+${body}` : body;
}
