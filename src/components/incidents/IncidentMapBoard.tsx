"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import MapGL, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useDroppable } from "@dnd-kit/core";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  INCIDENT_UNIT_KINDS,
  INCIDENT_UNIT_KIND_LABELS,
  INCIDENT_UNIT_KIND_MARKER_COLORS,
  POLYGON_COLOR_PRESETS,
  incidentUnitKindLabel,
  incidentUnitMarkerColors,
  type Incident,
  type IncidentMapOverlay,
  type IncidentMapPlacement,
  type IncidentMapPolygon,
  type IncidentUnit,
  type PolygonRing,
} from "@/lib/incident-types";
import {
  createMapPolygon,
  deleteMapPolygon,
  deleteOverlay,
  setOverlayActive,
  updateIncidentMapView,
  updateMapPolygon,
  updateOverlayBounds,
  uploadMapOverlay,
  upsertMapPlacement,
} from "@/app/incidents/actions";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type BasemapId = "street" | "satellite";

const STREET_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: { "background-color": "#e8eef2" },
    },
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

/** Esri World Imagery — no API key required for tactical basemap use */
const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    satellite: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: { "background-color": "#0b1220" },
    },
    {
      id: "satellite",
      type: "raster" as const,
      source: "satellite",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const BASEMAP_STYLES: Record<BasemapId, typeof STREET_STYLE | typeof SATELLITE_STYLE> = {
  street: STREET_STYLE,
  satellite: SATELLITE_STYLE,
};

function normalizeRing(raw: unknown): PolygonRing | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const ring: PolygonRing = [];
  for (const pt of raw) {
    if (!Array.isArray(pt) || pt.length < 2) return null;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    ring.push([lng, lat]);
  }
  return ring;
}

function ringToSvgPoints(map: MapLibreMap, ring: PolygonRing) {
  return ring
    .map(([lng, lat]) => {
      const p = map.project([lng, lat]);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

/** SVG polygons in the canvas container — above basemap, below unit markers */
function PolygonSvgOverlay({
  map,
  polygons,
  draftRing,
  draftColor,
  draftStroke,
  selectedPolygonId,
  editRing,
  selectEnabled,
  clickable,
  onSelect,
  onPolygonClick,
  onVertexDrag,
}: {
  map: MapLibreMap;
  polygons: IncidentMapPolygon[];
  draftRing: PolygonRing;
  draftColor: string;
  draftStroke: string;
  selectedPolygonId: string | null;
  /** When set, this ring is shown with draggable handles instead of the saved selected polygon */
  editRing: PolygonRing | null;
  selectEnabled: boolean;
  clickable: boolean;
  onSelect: (id: string | null) => void;
  onPolygonClick: (id: string, clientX: number, clientY: number) => void;
  onVertexDrag: (index: number, lng: number, lat: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const bump = () => setTick((t) => t + 1);
    map.on("move", bump);
    map.on("zoom", bump);
    map.on("resize", bump);
    map.on("pitch", bump);
    map.on("rotate", bump);
    const raf = requestAnimationFrame(bump);
    return () => {
      cancelAnimationFrame(raf);
      map.off("move", bump);
      map.off("zoom", bump);
      map.off("resize", bump);
      map.off("pitch", bump);
      map.off("rotate", bump);
    };
  }, [map, mounted]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragIndexRef.current == null) return;
      const rect = map.getCanvas().getBoundingClientRect();
      const lngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
      onVertexDrag(dragIndexRef.current, lngLat.lng, lngLat.lat);
    };
    const onUp = () => {
      dragIndexRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [map, onVertexDrag]);

  if (!mounted) return null;

  const container = map.getCanvasContainer();
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const openRing = (ring: PolygonRing) => {
    if (ring.length < 2) return ring;
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx === lx && fy === ly) return ring.slice(0, -1) as PolygonRing;
    return ring;
  };

  const svg = (
    <svg
      width={width}
      height={height}
      className="pointer-events-none absolute left-0 top-0"
      style={{ zIndex: 1 }}
    >
      {polygons.map((polygon) => {
        if (editRing && selectedPolygonId === polygon.id) return null;
        const ring = normalizeRing(polygon.coordinates);
        if (!ring) return null;
        const closed =
          ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
            ? ring
            : ([...ring, ring[0]] as PolygonRing);
        const selected = selectedPolygonId === polygon.id;
        return (
          <polygon
            key={polygon.id}
            points={ringToSvgPoints(map, closed)}
            fill={polygon.fill_color || "#dc2626"}
            fillOpacity={polygon.fill_opacity ?? 0.4}
            stroke={selected ? "#ffffff" : polygon.stroke_color || "#991b1b"}
            strokeWidth={selected ? 4 : polygon.stroke_width || 3}
            className={clickable ? "pointer-events-auto cursor-pointer" : undefined}
            onClick={
              clickable
                ? (e) => {
                    e.stopPropagation();
                    onPolygonClick(polygon.id, e.clientX, e.clientY);
                    if (selectEnabled) onSelect(polygon.id);
                  }
                : undefined
            }
          />
        );
      })}

      {editRing && editRing.length >= 3 ? (
        <>
          <polygon
            points={ringToSvgPoints(map, [...editRing, editRing[0]])}
            fill={draftColor}
            fillOpacity={0.35}
            stroke="#ffffff"
            strokeWidth={3}
            strokeDasharray="6 4"
          />
          {openRing(editRing).map(([lng, lat], i) => {
            const p = map.project([lng, lat]);
            return (
              <circle
                key={`edit-v-${i}`}
                cx={p.x}
                cy={p.y}
                r={8}
                fill={draftColor}
                stroke="#ffffff"
                strokeWidth={2}
                className="pointer-events-auto cursor-grab"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dragIndexRef.current = i;
                }}
              />
            );
          })}
        </>
      ) : null}

      {draftRing.length >= 3 ? (
        <polygon
          points={ringToSvgPoints(map, [...draftRing, draftRing[0]])}
          fill={draftColor}
          fillOpacity={0.35}
          stroke={draftStroke}
          strokeWidth={3}
          strokeDasharray="6 4"
        />
      ) : null}

      {draftRing.length >= 2 ? (
        <polyline
          points={ringToSvgPoints(map, draftRing)}
          fill="none"
          stroke={draftStroke}
          strokeWidth={3}
          strokeDasharray="6 4"
        />
      ) : null}

      {draftRing.map(([lng, lat], i) => {
        const p = map.project([lng, lat]);
        return (
          <circle
            key={`v-${i}`}
            cx={p.x}
            cy={p.y}
            r={6}
            fill={draftColor}
            stroke="#ffffff"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );

  return createPortal(svg, container);
}

function UnitMarker({
  unit,
  placement,
  onDragEnd,
  interactive,
}: {
  unit: IncidentUnit;
  placement: IncidentMapPlacement;
  onDragEnd: (lng: number, lat: number) => void;
  interactive: boolean;
}) {
  const colors = incidentUnitMarkerColors(unit.unit_type);
  const kindTitle = incidentUnitKindLabel(unit.unit_type);
  return (
    <Marker
      longitude={placement.lng}
      latitude={placement.lat}
      draggable={interactive}
      onDragEnd={(e) => {
        onDragEnd(e.lngLat.lng, e.lngLat.lat);
      }}
      style={{ zIndex: 10 }}
    >
      <div
        title={kindTitle ?? undefined}
        className={cn(
          "rounded border px-1.5 py-0.5 text-[10px] font-bold text-white shadow",
          colors.bg,
          colors.border,
          interactive ? "cursor-grab active:cursor-grabbing" : "pointer-events-none opacity-90"
        )}
      >
        {unit.label}
      </div>
    </Marker>
  );
}

function MapDropSurface({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "map-drop" });
  return (
    <div
      ref={setNodeRef}
      className={cn("relative h-full min-h-0 w-full", isOver && "ring-2 ring-inset ring-primary")}
    >
      {children}
    </div>
  );
}

export function IncidentMapBoard({
  incident,
  units,
  placements,
  overlays,
  overlaySignedUrls,
  polygons,
  mapDropUnitId,
  onMapDropConsumed,
  onChanged,
  onPlacementsLocal,
  leftInset,
}: {
  incident: Incident;
  units: IncidentUnit[];
  placements: IncidentMapPlacement[];
  overlays: IncidentMapOverlay[];
  overlaySignedUrls: Record<string, string>;
  polygons: IncidentMapPolygon[];
  mapDropUnitId: string | null;
  onMapDropConsumed: () => void;
  onChanged: () => void;
  onPlacementsLocal: (placements: IncidentMapPlacement[]) => void;
  leftInset?: ReactNode;
}) {
  const mapRef = useRef<MapRef>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draftRing, setDraftRing] = useState<PolygonRing>([]);
  const [editRing, setEditRing] = useState<PolygonRing | null>(null);
  const [polygonLabel, setPolygonLabel] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [localPolygons, setLocalPolygons] = useState(polygons);
  const [basemap, setBasemap] = useState<BasemapId>("street");
  const [labelTip, setLabelTip] = useState<{
    polygonId: string;
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const mapPaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMapReady(true);
  }, []);

  useEffect(() => {
    setLocalPolygons(polygons);
  }, [polygons]);

  useEffect(() => {
    if (drawMode) setLabelTip(null);
  }, [drawMode]);

  useEffect(() => {
    if (!mapInstance || !labelTip) return;
    const clear = () => setLabelTip(null);
    mapInstance.on("movestart", clear);
    return () => {
      mapInstance.off("movestart", clear);
    };
  }, [mapInstance, labelTip]);

  const showPolygonLabel = useCallback(
    (polygonId: string, clientX: number, clientY: number) => {
      const pane = mapPaneRef.current;
      if (!pane) return;
      const rect = pane.getBoundingClientRect();
      const poly = localPolygons.find((p) => p.id === polygonId);
      setLabelTip({
        polygonId,
        label: poly?.label?.trim() || "Untitled shape",
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    },
    [localPolygons]
  );

  const unitsById = useMemo(() => {
    const m = new Map<string, IncidentUnit>();
    for (const u of units) m.set(u.id, u);
    return m;
  }, [units]);

  const activeOverlay = overlays.find((o) => o.is_active) ?? null;
  const overlayUrl = activeOverlay ? overlaySignedUrls[activeOverlay.id] : null;
  const colorPreset = POLYGON_COLOR_PRESETS[colorIndex] ?? POLYGON_COLOR_PRESETS[0];
  const selectedPolygon = localPolygons.find((p) => p.id === selectedPolygonId) ?? null;

  const openRing = useCallback((ring: PolygonRing): PolygonRing => {
    if (ring.length < 2) return ring;
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx === lx && fy === ly) return ring.slice(0, -1) as PolygonRing;
    return ring;
  }, []);

  const selectPolygon = useCallback(
    (id: string | null) => {
      setSelectedPolygonId(id);
      setEditRing(null);
      if (!id) return;
      const poly = localPolygons.find((p) => p.id === id);
      if (!poly) return;
      setPolygonLabel(poly.label ?? "");
      const match = POLYGON_COLOR_PRESETS.findIndex(
        (c) => c.fill.toLowerCase() === (poly.fill_color || "").toLowerCase()
      );
      setColorIndex(match >= 0 ? match : 0);
    },
    [localPolygons]
  );

  const startReshape = useCallback(() => {
    if (!selectedPolygon) return;
    const ring = normalizeRing(selectedPolygon.coordinates);
    if (!ring) return;
    setEditRing(openRing(ring));
  }, [openRing, selectedPolygon]);

  const handleVertexDrag = useCallback((index: number, lng: number, lat: number) => {
    setEditRing((prev) => {
      if (!prev) return prev;
      const next = [...prev] as PolygonRing;
      next[index] = [lng, lat];
      return next;
    });
  }, []);

  const saveReshape = useCallback(() => {
    if (!selectedPolygonId || !editRing || editRing.length < 3) {
      setError("Need at least 3 vertices to save.");
      return;
    }
    const ring = editRing;
    setLocalPolygons((prev) =>
      prev.map((p) =>
        p.id === selectedPolygonId
          ? { ...p, coordinates: [...ring, ring[0]], updated_at: new Date().toISOString() }
          : p
      )
    );
    setEditRing(null);
    setError(null);
    startTransition(async () => {
      try {
        await updateMapPolygon({
          incidentId: incident.id,
          polygonId: selectedPolygonId,
          coordinates: ring,
        });
        onChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save shape");
        onChanged();
      }
    });
  }, [editRing, incident.id, onChanged, selectedPolygonId]);

  const savePolygonMeta = useCallback(() => {
    if (!selectedPolygonId) return;
    const fill = colorPreset.fill;
    const stroke = colorPreset.stroke;
    const label = polygonLabel;
    setLocalPolygons((prev) =>
      prev.map((p) =>
        p.id === selectedPolygonId
          ? {
              ...p,
              label: label.trim() || null,
              fill_color: fill,
              stroke_color: stroke,
              updated_at: new Date().toISOString(),
            }
          : p
      )
    );
    startTransition(async () => {
      try {
        await updateMapPolygon({
          incidentId: incident.id,
          polygonId: selectedPolygonId,
          label: label.trim() || null,
          fillColor: fill,
          strokeColor: stroke,
        });
        onChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update polygon");
      }
    });
  }, [colorPreset, incident.id, onChanged, polygonLabel, selectedPolygonId]);

  const removeSelectedPolygon = useCallback(() => {
    if (!selectedPolygonId) return;
    const id = selectedPolygonId;
    setLocalPolygons((prev) => prev.filter((p) => p.id !== id));
    setSelectedPolygonId(null);
    setEditRing(null);
    startTransition(async () => {
      try {
        await deleteMapPolygon(incident.id, id);
        onChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
        onChanged();
      }
    });
  }, [incident.id, onChanged, selectedPolygonId]);

  useEffect(() => {
    if (!mapDropUnitId || drawMode) return;
    const map = mapRef.current;
    const center = map?.getCenter() ?? {
      lng: incident.map_center_lng,
      lat: incident.map_center_lat,
    };
    const unitId = mapDropUnitId;
    // Clear drop id after this effect flush — avoids parent updates mid-commit
    queueMicrotask(() => onMapDropConsumed());

    startTransition(async () => {
      await upsertMapPlacement({
        incidentId: incident.id,
        unitId,
        lng: center.lng,
        lat: center.lat,
      });
      onChanged();
    });
  }, [
    mapDropUnitId,
    drawMode,
    incident.id,
    incident.map_center_lng,
    incident.map_center_lat,
    onChanged,
    onMapDropConsumed,
  ]);

  const handleMarkerDrag = useCallback(
    (unitId: string, lng: number, lat: number) => {
      let overlayX: number | null = null;
      let overlayY: number | null = null;
      if (
        activeOverlay &&
        activeOverlay.west != null &&
        activeOverlay.east != null &&
        activeOverlay.south != null &&
        activeOverlay.north != null
      ) {
        const w = activeOverlay.east - activeOverlay.west;
        const h = activeOverlay.north - activeOverlay.south;
        if (w !== 0 && h !== 0) {
          overlayX = Math.min(1, Math.max(0, (lng - activeOverlay.west) / w));
          overlayY = Math.min(1, Math.max(0, (activeOverlay.north - lat) / h));
        }
      }

      onPlacementsLocal(
        placements.map((p) =>
          p.unit_id === unitId
            ? {
                ...p,
                lng,
                lat,
                overlay_x: overlayX,
                overlay_y: overlayY,
                updated_at: new Date().toISOString(),
              }
            : p
        )
      );
      startTransition(async () => {
        await upsertMapPlacement({
          incidentId: incident.id,
          unitId,
          lng,
          lat,
          overlayX,
          overlayY,
        });
      });
    },
    [activeOverlay, incident.id, onPlacementsLocal, placements]
  );

  const finishPolygon = useCallback(() => {
    if (draftRing.length < 3) {
      setError("Add at least 3 points, then finish.");
      return;
    }
    const ring = draftRing;
    const label = polygonLabel;
    const fill = colorPreset.fill;
    const stroke = colorPreset.stroke;
    const tempId = `temp-${Date.now()}`;
    const optimistic: IncidentMapPolygon = {
      id: tempId,
      incident_id: incident.id,
      label: label || null,
      coordinates: [...ring, ring[0]],
      fill_color: fill,
      fill_opacity: 0.4,
      stroke_color: stroke,
      stroke_width: 3,
      sort_order: localPolygons.length,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLocalPolygons((prev) => [...prev, optimistic]);
    setDraftRing([]);
    setError(null);
    startTransition(async () => {
      try {
        await createMapPolygon({
          incidentId: incident.id,
          coordinates: ring,
          label: label || null,
          fillColor: fill,
          strokeColor: stroke,
          fillOpacity: 0.4,
        });
        setPolygonLabel("");
        onChanged();
      } catch (err) {
        setLocalPolygons((prev) => prev.filter((p) => p.id !== tempId));
        setError(err instanceof Error ? err.message : "Failed to save polygon");
      }
    });
  }, [colorPreset, draftRing, incident.id, localPolygons.length, onChanged, polygonLabel]);

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      setLabelTip(null);
      if (drawMode) {
        setDraftRing((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
        setSelectedPolygonId(null);
        return;
      }

      if (!e.originalEvent.shiftKey) return;
      const placed = new Set(placements.map((p) => p.unit_id));
      const next = units.find((u) => !placed.has(u.id));
      if (!next) return;
      startTransition(async () => {
        await upsertMapPlacement({
          incidentId: incident.id,
          unitId: next.id,
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        });
        onChanged();
      });
    },
    [drawMode, incident.id, onChanged, placements, units]
  );

  const handleMapDblClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!drawMode) return;
      e.preventDefault();
      if (draftRing.length >= 3) finishPolygon();
    },
    [drawMode, draftRing.length, finishPolygon]
  );

  const persistView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const z = map.getZoom();
    void updateIncidentMapView(incident.id, { lng: c.lng, lat: c.lat }, z);
  }, [incident.id]);

  const nudgeOverlay = (dx: number, dy: number) => {
    if (!activeOverlay || activeOverlay.west == null) return;
    const west = activeOverlay.west + dx;
    const east = (activeOverlay.east ?? activeOverlay.west) + dx;
    const south = (activeOverlay.south ?? 0) + dy;
    const north = (activeOverlay.north ?? 0) + dy;
    startTransition(async () => {
      await updateOverlayBounds(incident.id, activeOverlay.id, { west, south, east, north });
      onChanged();
    });
  };

  const scaleOverlay = (factor: number) => {
    if (!activeOverlay || activeOverlay.west == null || activeOverlay.east == null) return;
    const cx = (activeOverlay.west + activeOverlay.east) / 2;
    const cy = ((activeOverlay.south ?? 0) + (activeOverlay.north ?? 0)) / 2;
    const hw = ((activeOverlay.east - activeOverlay.west) / 2) * factor;
    const hh = (((activeOverlay.north ?? 0) - (activeOverlay.south ?? 0)) / 2) * factor;
    startTransition(async () => {
      await updateOverlayBounds(incident.id, activeOverlay.id, {
        west: cx - hw,
        east: cx + hw,
        south: cy - hh,
        north: cy + hh,
      });
      onChanged();
    });
  };

  return (
    <section className="relative flex h-full min-h-0 min-w-0 flex-row">
      <div className="relative min-h-0 min-w-0 flex-1" ref={mapPaneRef}>
        {error ? (
          <p
            className={cn(
              "absolute right-2 top-2 z-20 rounded bg-background/95 px-2 py-1 text-xs text-destructive shadow",
              leftInset ? "left-[15rem]" : "left-2"
            )}
          >
            {error}
          </p>
        ) : null}

        <div className="absolute inset-0">
          <MapDropSurface>
            {mapReady ? (
              <>
                <MapGL
                  ref={mapRef}
                  initialViewState={{
                    longitude: incident.map_center_lng,
                    latitude: incident.map_center_lat,
                    zoom: incident.map_zoom,
                  }}
                  mapStyle={BASEMAP_STYLES[basemap]}
                  style={{ width: "100%", height: "100%", cursor: drawMode ? "crosshair" : undefined }}
                  onClick={handleMapClick}
                  onDblClick={handleMapDblClick}
                  onMoveEnd={persistView}
                  onLoad={() => {
                    const map = mapRef.current?.getMap();
                    if (!map) return;
                    // Defer so MapGL finishes mounting before parent state updates
                    requestAnimationFrame(() => setMapInstance(map));
                  }}
                  doubleClickZoom={!drawMode}
                >
                  <NavigationControl position="top-right" />

                  {activeOverlay &&
                  overlayUrl &&
                  activeOverlay.west != null &&
                  activeOverlay.south != null &&
                  activeOverlay.east != null &&
                  activeOverlay.north != null ? (
                    <Source
                      id="tactical-overlay"
                      type="image"
                      url={overlayUrl}
                      coordinates={[
                        [activeOverlay.west, activeOverlay.north],
                        [activeOverlay.east, activeOverlay.north],
                        [activeOverlay.east, activeOverlay.south],
                        [activeOverlay.west, activeOverlay.south],
                      ]}
                    >
                      <Layer
                        id="tactical-overlay-layer"
                        type="raster"
                        paint={{ "raster-opacity": activeOverlay.opacity }}
                      />
                    </Source>
                  ) : null}

                  {placements.map((placement) => {
                    const unit = unitsById.get(placement.unit_id);
                    if (!unit) return null;
                    return (
                      <UnitMarker
                        key={placement.id}
                        unit={unit}
                        placement={placement}
                        interactive={!drawMode}
                        onDragEnd={(lng, lat) => handleMarkerDrag(unit.id, lng, lat)}
                      />
                    );
                  })}
                </MapGL>

                {mapInstance ? (
                  <PolygonSvgOverlay
                    map={mapInstance}
                    polygons={localPolygons}
                    draftRing={draftRing}
                    draftColor={colorPreset.fill}
                    draftStroke={colorPreset.stroke}
                    selectedPolygonId={selectedPolygonId}
                    editRing={editRing}
                    selectEnabled={editMode && !editRing}
                    clickable={!drawMode && !editRing}
                    onSelect={selectPolygon}
                    onPolygonClick={showPolygonLabel}
                    onVertexDrag={handleVertexDrag}
                  />
                ) : null}
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
                Loading map…
              </div>
            )}
          </MapDropSurface>
        </div>

        {labelTip ? (
          <div
            className="pointer-events-auto absolute z-30 max-w-[12rem] rounded-md border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg"
            style={{
              left: labelTip.x,
              top: labelTip.y,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 break-words">{labelTip.label}</span>
              <button
                type="button"
                className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setLabelTip(null)}
                aria-label="Close label"
              >
                ×
              </button>
            </div>
            <div
              className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-border"
              aria-hidden
            />
          </div>
        ) : null}

        {leftInset ? (
          <div className="pointer-events-auto absolute bottom-2 left-2 top-2 z-20 w-[13.5rem]">
            {leftInset}
          </div>
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute bottom-3 z-10 max-w-[min(100%,28rem)] space-y-1 rounded bg-background/90 px-2 py-1.5 text-[10px] text-muted-foreground shadow",
            leftInset ? "left-[15rem]" : "left-3"
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {INCIDENT_UNIT_KINDS.map((kind) => (
              <span key={kind} className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-sm border",
                    INCIDENT_UNIT_KIND_MARKER_COLORS[kind].bg,
                    INCIDENT_UNIT_KIND_MARKER_COLORS[kind].border
                  )}
                />
                {INCIDENT_UNIT_KIND_LABELS[kind]}
              </span>
            ))}
          </div>
          <FieldLabel className="pointer-events-none text-[10px]">
            {placements.length} placed · {units.length} on scene · {localPolygons.length} polygons
            {activeOverlay ? ` · overlay: ${activeOverlay.file_name}` : ""}
            {selectedPolygonId
              ? ` · selected: ${localPolygons.find((p) => p.id === selectedPolygonId)?.label || "shape"}`
              : ""}
          </FieldLabel>
        </div>
      </div>

      <aside className="flex w-[11.5rem] shrink-0 flex-col gap-2 overflow-y-auto border-l bg-muted/20 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Map tools
        </p>

        <div className="grid grid-cols-2 gap-1">
          <Button
            type="button"
            size="sm"
            variant={basemap === "street" ? "default" : "outline"}
            className="h-8 px-1 text-[11px]"
            onClick={() => setBasemap("street")}
          >
            Street
          </Button>
          <Button
            type="button"
            size="sm"
            variant={basemap === "satellite" ? "default" : "outline"}
            className="h-8 px-1 text-[11px]"
            onClick={() => setBasemap("satellite")}
          >
            Satellite
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant={drawMode ? "default" : "outline"}
          className="w-full"
          disabled={pending || editMode}
          onClick={() => {
            setDrawMode((v) => !v);
            setEditMode(false);
            setDraftRing([]);
            setEditRing(null);
            setSelectedPolygonId(null);
            setError(null);
          }}
        >
          {drawMode ? "Exit draw" : "Draw polygon"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editMode ? "default" : "outline"}
          className="w-full"
          disabled={pending || drawMode}
          onClick={() => {
            setEditMode((v) => !v);
            setDrawMode(false);
            setDraftRing([]);
            setEditRing(null);
            setSelectedPolygonId(null);
            setError(null);
          }}
        >
          {editMode ? "Exit edit" : "Edit shapes"}
        </Button>

        <p className="text-[10px] leading-snug text-muted-foreground">
          {drawMode
            ? "Click vertices · Double-click or Finish to close"
            : editMode
              ? "Select a shape to edit label, color, vertices, or delete"
              : "Drop units on map · Shift+click to place · Drag markers"}
        </p>

        {drawMode ? (
          <div className="space-y-2 border-t pt-2">
            <Select
              className="h-8 w-full text-xs"
              value={String(colorIndex)}
              onChange={(e) => setColorIndex(Number(e.target.value))}
              disabled={pending}
            >
              {POLYGON_COLOR_PRESETS.map((c, i) => (
                <option key={c.label} value={i}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Input
              className="h-8 w-full text-xs"
              placeholder="Label"
              value={polygonLabel}
              onChange={(e) => setPolygonLabel(e.target.value)}
              disabled={pending}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={pending || draftRing.length < 3}
              onClick={finishPolygon}
            >
              Finish ({draftRing.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full"
              disabled={pending || draftRing.length === 0}
              onClick={() => setDraftRing([])}
            >
              Cancel draft
            </Button>
          </div>
        ) : editMode ? (
          <div className="space-y-2 border-t pt-2">
            {localPolygons.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">No polygons yet.</span>
            ) : (
              <Select
                className="h-8 w-full text-xs"
                value={selectedPolygonId ?? ""}
                onChange={(e) => selectPolygon(e.target.value || null)}
                disabled={pending}
              >
                <option value="">Select shape…</option>
                {localPolygons.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    {p.label?.trim() || `Shape ${i + 1}`}
                  </option>
                ))}
              </Select>
            )}

            {selectedPolygon ? (
              <>
                <Input
                  className="h-8 w-full text-xs"
                  placeholder="Label"
                  value={polygonLabel}
                  onChange={(e) => setPolygonLabel(e.target.value)}
                  disabled={pending || Boolean(editRing)}
                />
                <Select
                  className="h-8 w-full text-xs"
                  value={String(colorIndex)}
                  onChange={(e) => setColorIndex(Number(e.target.value))}
                  disabled={pending || Boolean(editRing)}
                >
                  {POLYGON_COLOR_PRESETS.map((c, i) => (
                    <option key={c.label} value={i}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                {editRing ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={pending || editRing.length < 3}
                      onClick={saveReshape}
                    >
                      Save vertices
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      disabled={pending}
                      onClick={() => setEditRing(null)}
                    >
                      Cancel reshape
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={pending}
                      onClick={savePolygonMeta}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={pending}
                      onClick={startReshape}
                    >
                      Reshape
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      disabled={pending}
                      onClick={() => selectPolygon(null)}
                    >
                      Deselect
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      disabled={pending}
                      onClick={removeSelectedPolygon}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 border-t pt-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set("file", file);
                setError(null);
                startTransition(async () => {
                  try {
                    await uploadMapOverlay(incident.id, fd);
                    onChanged();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    if (fileRef.current) fileRef.current.value = "";
                  }
                });
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              Upload overlay
            </Button>
            {activeOverlay ? (
              <>
                <div className="grid grid-cols-3 gap-1">
                  <span />
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-0" disabled={pending} onClick={() => nudgeOverlay(0, 0.0004)}>
                    ↑
                  </Button>
                  <span />
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-0" disabled={pending} onClick={() => nudgeOverlay(-0.0005, 0)}>
                    ←
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-0" disabled={pending} onClick={() => nudgeOverlay(0, -0.0004)}>
                    ↓
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-0" disabled={pending} onClick={() => nudgeOverlay(0.0005, 0)}>
                    →
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => scaleOverlay(1.1)}>
                    +
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => scaleOverlay(1 / 1.1)}>
                    −
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await setOverlayActive(incident.id, activeOverlay.id, false);
                      onChanged();
                    })
                  }
                >
                  Hide overlay
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteOverlay(incident.id, activeOverlay.id);
                      onChanged();
                    })
                  }
                >
                  Remove
                </Button>
              </>
            ) : overlays[0] ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await setOverlayActive(incident.id, overlays[0].id, true);
                    onChanged();
                  })
                }
              >
                Show overlay
              </Button>
            ) : null}
          </div>
        )}
      </aside>
    </section>
  );
}
