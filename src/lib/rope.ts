import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AssetStatus } from "@/lib/assets-types";
import {
  ropeApparatusLabel,
  ropeEquipmentLabel,
  ropeGearSummary,
  ropeStationAnchor,
  ropeStationName,
  type RopeApparatusOption,
  type RopeAttachOption,
  type RopeAuditGroup,
  type RopeAuditReason,
  type RopeAuditSummary,
  type RopeBagLineView,
  type RopeBagSummary,
  type RopeCacheRow,
  type RopeCacheSpare,
  type RopeCompartmentSummary,
  type RopeDetailKind,
  type RopeGearCategory,
  type RopeGearType,
  type RopeLineAsset,
  type RopeLineAuditFlag,
  type RopeLoadoutTarget,
  type RopeStationGroup,
} from "@/lib/rope-types";

type RopeResult<T> = { data: T; error: PostgrestError | null };

type ApparatusRow = {
  id: string;
  unit_number: string | null;
  build_number: string | null;
  station: string | null;
  tracks_rope_inventory: boolean;
};

type CompartmentRow = {
  id: string;
  apparatus_id: string;
  name: string;
  sort_order: number;
};

type BagRow = {
  id: string;
  compartment_id: string;
  name: string;
  sort_order: number;
  is_loose: boolean;
};

type GearEmbed = {
  id: string;
  name: string;
  color: string;
  diameter: string;
  length: string;
  brand: string;
  material: string;
  category: { detail_kind: string } | { detail_kind: string }[] | null;
};

type LineRow = {
  id: string;
  bag_id: string;
  gear_type_id: string;
  expected_quantity: number;
  quantity_on_hand: number;
  sort_order: number;
  gear_type: GearEmbed | GearEmbed[] | null;
};

const GEAR_TYPE_COLUMNS =
  "id, name, notes, sort_order, category_id, color, diameter, length, brand, material, category:rope_gear_categories(name, sort_order, detail_kind)";

const LINE_GEAR_COLUMNS =
  "id, bag_id, gear_type_id, expected_quantity, quantity_on_hand, sort_order, gear_type:rope_gear_types!gear_type_id(id, name, color, diameter, length, brand, material, category:rope_gear_categories(detail_kind))";

function detailKindOf(value: string | null | undefined): RopeDetailKind {
  if (value === "rope" || value === "webbing" || value === "carabiner") return value;
  return "none";
}

function mapGearType(row: {
  id: string;
  name: string;
  notes: string;
  sort_order: number;
  category_id: string;
  color: string;
  diameter: string;
  length: string;
  brand: string;
  material: string;
  category:
    | { name: string; sort_order: number; detail_kind: string }
    | { name: string; sort_order: number; detail_kind: string }[]
    | null;
}): RopeGearType {
  const category = asSingle(row.category);
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    sort_order: row.sort_order,
    categoryId: row.category_id,
    categoryName: category?.name ?? "Other",
    categorySortOrder: category?.sort_order ?? 0,
    detailKind: detailKindOf(category?.detail_kind),
    color: row.color,
    diameter: row.diameter,
    length: row.length,
    brand: row.brand,
    material: row.material,
  };
}

function embedSummary(gear: GearEmbed | null) {
  if (!gear) return "";
  return ropeGearSummary(detailKindOf(asSingle(gear.category)?.detail_kind), gear);
}

type PlacementRow = {
  id: string;
  asset_id: string;
  gear_type_id: string;
  bag_id: string | null;
  in_cache: boolean;
  asset:
    | {
        id: string;
        name: string | null;
        serial_number: string | null;
        status: AssetStatus;
      }
    | {
        id: string;
        name: string | null;
        serial_number: string | null;
        status: AssetStatus;
      }[]
    | null;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function lineShort(expected: number, actual: number) {
  return Math.max(0, expected - actual);
}

export async function fetchGearTypes(
  supabase: SupabaseClient
): Promise<RopeResult<RopeGearType[]>> {
  const { data, error } = await supabase.from("rope_gear_types").select(GEAR_TYPE_COLUMNS);
  if (error) return { data: [], error };
  const types = ((data ?? []) as Parameters<typeof mapGearType>[0][]).map(mapGearType);
  types.sort(
    (a, b) =>
      a.categorySortOrder - b.categorySortOrder ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name) ||
      ropeGearSummary(a.detailKind, a).localeCompare(ropeGearSummary(b.detailKind, b))
  );
  return { data: types, error: null };
}

export async function fetchGearCategories(
  supabase: SupabaseClient
): Promise<RopeResult<RopeGearCategory[]>> {
  const [{ data, error }, types] = await Promise.all([
    supabase
      .from("rope_gear_categories")
      .select("id, name, sort_order, detail_kind")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("rope_gear_types").select("category_id"),
  ]);
  if (error) return { data: [], error };
  if (types.error) return { data: [], error: types.error };
  const counts = new Map<string, number>();
  for (const row of (types.data ?? []) as { category_id: string }[]) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return {
    data: ((data ?? []) as { id: string; name: string; sort_order: number; detail_kind: string }[]).map(
      (row) => ({
        id: row.id,
        name: row.name,
        sortOrder: row.sort_order,
        detailKind: detailKindOf(row.detail_kind),
        gearTypeCount: counts.get(row.id) ?? 0,
      })
    ),
    error: null,
  };
}

export async function fetchRopeApparatusOptions(
  supabase: SupabaseClient
): Promise<RopeResult<RopeApparatusOption[]>> {
  const { data, error } = await supabase
    .from("assets")
    .select("id, unit_number, build_number, station, tracks_rope_inventory")
    .eq("kind", "apparatus")
    .order("unit_number", { ascending: true, nullsFirst: false });
  if (error) return { data: [], error };
  const options = ((data ?? []) as ApparatusRow[]).map((row) => ({
    id: row.id,
    label: ropeApparatusLabel(row),
    station: ropeStationName(row.station),
    tracksRope: row.tracks_rope_inventory,
  }));
  options.sort((a, b) => a.label.localeCompare(b.label));
  return { data: options, error: null };
}

export async function fetchRopeStations(
  supabase: SupabaseClient
): Promise<RopeResult<RopeStationGroup[]>> {
  const { data: apparatusData, error: apparatusError } = await supabase
    .from("assets")
    .select("id, unit_number, build_number, station, tracks_rope_inventory")
    .eq("kind", "apparatus")
    .eq("tracks_rope_inventory", true);
  if (apparatusError) return { data: [], error: apparatusError };

  const apparatus = (apparatusData ?? []) as ApparatusRow[];
  if (apparatus.length === 0) return { data: [], error: null };

  const apparatusIds = apparatus.map((row) => row.id);
  const { data: compartmentData, error: compartmentError } = await supabase
    .from("rope_compartments")
    .select("id, apparatus_id, name, sort_order")
    .in("apparatus_id", apparatusIds);
  if (compartmentError) return { data: [], error: compartmentError };

  const compartments = (compartmentData ?? []) as CompartmentRow[];
  const compartmentIds = compartments.map((row) => row.id);
  const bags = await loadBags(supabase, compartmentIds);
  if (bags.error) return { data: [], error: bags.error };

  const lines = await loadLines(supabase, bags.rows.map((row) => row.id));
  if (lines.error) return { data: [], error: lines.error };

  const placements = await loadBagPlacements(supabase, bags.rows.map((row) => row.id));
  if (placements.error) return { data: [], error: placements.error };

  const placementsByBag = groupPlacements(placements.rows);
  const linesByBag = new Map<string, LineRow[]>();
  for (const line of lines.rows) {
    const list = linesByBag.get(line.bag_id) ?? [];
    list.push(line);
    linesByBag.set(line.bag_id, list);
  }

  const coverage = await fetchAuditCoverage(
    supabase,
    bags.rows.map((bag) => ({ id: bag.id, compartmentId: bag.compartment_id }))
  );
  if (coverage.error) return { data: [], error: coverage.error };

  const bagStats = new Map<string, { short: number; requiredLineCount: number }>();
  for (const bag of bags.rows) {
    bagStats.set(
      bag.id,
      statsForLines(
        linesByBag.get(bag.id) ?? [],
        placementsByBag.get(bag.id) ?? [],
        coverage.byBag.get(bag.id)?.flags
      )
    );
  }

  const compartmentsByApparatus = new Map<string, CompartmentRow[]>();
  for (const compartment of compartments) {
    const list = compartmentsByApparatus.get(compartment.apparatus_id) ?? [];
    list.push(compartment);
    compartmentsByApparatus.set(compartment.apparatus_id, list);
  }
  const bagsByCompartment = new Map<string, BagRow[]>();
  for (const bag of bags.rows) {
    const list = bagsByCompartment.get(bag.compartment_id) ?? [];
    list.push(bag);
    bagsByCompartment.set(bag.compartment_id, list);
  }

  const groups = new Map<string, RopeStationGroup>();
  for (const unit of apparatus) {
    const station = ropeStationName(unit.station);
    const group = groups.get(station) ?? {
      station,
      anchor: ropeStationAnchor(station),
      trucks: [],
      short: 0,
      requiredLineCount: 0,
    };
    let short = 0;
    let requiredLineCount = 0;
    const unitCompartments = compartmentsByApparatus.get(unit.id) ?? [];
    for (const compartment of unitCompartments) {
      for (const bag of bagsByCompartment.get(compartment.id) ?? []) {
        const stats = bagStats.get(bag.id);
        short += stats?.short ?? 0;
        requiredLineCount += stats?.requiredLineCount ?? 0;
      }
    }
    group.trucks.push({
      id: unit.id,
      label: ropeApparatusLabel(unit),
      station,
      short,
      requiredLineCount,
      compartmentCount: unitCompartments.length,
    });
    group.short += short;
    group.requiredLineCount += requiredLineCount;
    groups.set(station, group);
  }

  const stations = [...groups.values()];
  for (const station of stations) {
    station.trucks.sort((a, b) => a.label.localeCompare(b.label));
  }
  stations.sort((a, b) => {
    if (a.station === "Unassigned") return 1;
    if (b.station === "Unassigned") return -1;
    return a.station.localeCompare(b.station);
  });
  return { data: stations, error: null };
}

export async function fetchRopeApparatus(
  supabase: SupabaseClient,
  apparatusId: string
): Promise<RopeResult<{ apparatus: ApparatusRow; compartments: RopeCompartmentSummary[] } | null>> {
  const { data, error } = await supabase
    .from("assets")
    .select("id, unit_number, build_number, station, tracks_rope_inventory, kind")
    .eq("id", apparatusId)
    .maybeSingle();
  if (error) return { data: null, error };
  const apparatus = data as (ApparatusRow & { kind: string }) | null;
  if (!apparatus || apparatus.kind !== "apparatus" || !apparatus.tracks_rope_inventory) {
    return { data: null, error: null };
  }

  const { data: compartmentData, error: compartmentError } = await supabase
    .from("rope_compartments")
    .select("id, apparatus_id, name, sort_order")
    .eq("apparatus_id", apparatusId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (compartmentError) return { data: null, error: compartmentError };

  const compartments = (compartmentData ?? []) as CompartmentRow[];
  const bags = await loadBags(supabase, compartments.map((row) => row.id));
  if (bags.error) return { data: null, error: bags.error };
  const lines = await loadLines(supabase, bags.rows.map((row) => row.id));
  if (lines.error) return { data: null, error: lines.error };
  const placements = await loadBagPlacements(supabase, bags.rows.map((row) => row.id));
  if (placements.error) return { data: null, error: placements.error };

  const placementsByBag = groupPlacements(placements.rows);
  const linesByBag = new Map<string, LineRow[]>();
  for (const line of lines.rows) {
    const list = linesByBag.get(line.bag_id) ?? [];
    list.push(line);
    linesByBag.set(line.bag_id, list);
  }
  const bagsByCompartment = new Map<string, BagRow[]>();
  for (const bag of bags.rows) {
    const list = bagsByCompartment.get(bag.compartment_id) ?? [];
    list.push(bag);
    bagsByCompartment.set(bag.compartment_id, list);
  }

  const coverage = await fetchAuditCoverage(
    supabase,
    bags.rows.map((bag) => ({ id: bag.id, compartmentId: bag.compartment_id }))
  );
  if (coverage.error) return { data: null, error: coverage.error };

  return {
    data: {
      apparatus,
      compartments: compartments.map((compartment) => {
        let short = 0;
        let requiredLineCount = 0;
        const compartmentBags = bagsByCompartment.get(compartment.id) ?? [];
        for (const bag of compartmentBags) {
          const stats = statsForLines(
            linesByBag.get(bag.id) ?? [],
            placementsByBag.get(bag.id) ?? [],
            coverage.byBag.get(bag.id)?.flags
          );
          short += stats.short;
          requiredLineCount += stats.requiredLineCount;
        }
        return {
          id: compartment.id,
          name: compartment.name,
          bagCount: compartmentBags.filter((bag) => !bag.is_loose).length,
          short,
          requiredLineCount,
        };
      }),
    },
    error: null,
  };
}

export async function fetchRopeCompartment(
  supabase: SupabaseClient,
  compartmentId: string
): Promise<
  RopeResult<{
    compartment: CompartmentRow;
    apparatus: ApparatusRow;
    bags: RopeBagSummary[];
    looseBagId: string | null;
    audit: RopeAuditSummary | null;
  } | null>
> {
  const { data, error } = await supabase
    .from("rope_compartments")
    .select("id, apparatus_id, name, sort_order")
    .eq("id", compartmentId)
    .maybeSingle();
  if (error) return { data: null, error };
  const compartment = data as CompartmentRow | null;
  if (!compartment) return { data: null, error: null };

  const { data: apparatusData, error: apparatusError } = await supabase
    .from("assets")
    .select("id, unit_number, build_number, station, tracks_rope_inventory")
    .eq("id", compartment.apparatus_id)
    .maybeSingle();
  if (apparatusError) return { data: null, error: apparatusError };
  const apparatus = apparatusData as ApparatusRow | null;
  if (!apparatus) return { data: null, error: null };

  const bags = await loadBags(supabase, [compartment.id]);
  if (bags.error) return { data: null, error: bags.error };
  const namedBags = bags.rows.filter((bag) => !bag.is_loose);
  namedBags.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const lines = await loadLines(supabase, bags.rows.map((row) => row.id));
  if (lines.error) return { data: null, error: lines.error };
  const placements = await loadBagPlacements(supabase, bags.rows.map((row) => row.id));
  if (placements.error) return { data: null, error: placements.error };

  const placementsByBag = groupPlacements(placements.rows);
  const linesByBag = new Map<string, LineRow[]>();
  for (const line of lines.rows) {
    const list = linesByBag.get(line.bag_id) ?? [];
    list.push(line);
    linesByBag.set(line.bag_id, list);
  }

  const coverage = await fetchAuditCoverage(
    supabase,
    bags.rows.map((bag) => ({ id: bag.id, compartmentId: bag.compartment_id }))
  );
  if (coverage.error) return { data: null, error: coverage.error };

  return {
    data: {
      compartment,
      apparatus,
      looseBagId: bags.rows.find((bag) => bag.is_loose)?.id ?? null,
      audit: summarizeCoverage(coverage.byBag),
      bags: namedBags.map((bag) => {
        const bagLines = linesByBag.get(bag.id) ?? [];
        const stats = statsForLines(
          bagLines,
          placementsByBag.get(bag.id) ?? [],
          coverage.byBag.get(bag.id)?.flags
        );
        return {
          id: bag.id,
          name: bag.name,
          lineCount: bagLines.length,
          short: stats.short,
          requiredLineCount: stats.requiredLineCount,
          openFindings: coverage.byBag.get(bag.id)?.findingCount ?? 0,
        };
      }),
    },
    error: null,
  };
}

export type RopeBagPanelData = {
  lines: RopeBagLineView[];
  audit: RopeAuditSummary | null;
};

export type RopeCompartmentBoard = {
  compartment: CompartmentRow;
  apparatus: ApparatusRow;
  bags: RopeBagSummary[];
  looseBagId: string | null;
  audit: RopeAuditSummary | null;
  checklist: RopeAuditGroup[];
  looseLines: RopeBagLineView[];
  gearTypes: RopeGearType[];
  attachOptions: RopeAttachOption[];
  bagViews: Record<string, RopeBagPanelData>;
  initialBagId: string | null;
  targets: RopeLoadoutTarget[];
};

export async function fetchCompartmentBoard(
  supabase: SupabaseClient,
  compartmentId: string,
  canManage: boolean,
  bagId?: string
): Promise<RopeResult<RopeCompartmentBoard | null>> {
  const result = await fetchRopeCompartment(supabase, compartmentId);
  if (result.error || !result.data) return { data: null, error: result.error };

  const { compartment, apparatus, bags, looseBagId, audit } = result.data;
  const viewBags = [
    ...bags.map((bag) => ({ id: bag.id, compartmentId: compartment.id })),
    ...(looseBagId ? [{ id: looseBagId, compartmentId: compartment.id }] : []),
  ];
  const [checklist, sources, gearTypes, attach, targets] = await Promise.all([
    fetchCompartmentAuditGroups(supabase, compartment.id),
    loadBagViewSources(supabase, viewBags),
    fetchGearTypes(supabase),
    canManage
      ? fetchUnplacedEquipment(supabase)
      : Promise.resolve({ data: [] as RopeAttachOption[], error: null }),
    canManage
      ? fetchLoadoutTargets(supabase, "")
      : Promise.resolve({ data: [] as RopeLoadoutTarget[], error: null }),
  ]);
  for (const response of [checklist, sources, gearTypes, attach, targets]) {
    if (response.error) return { data: null, error: response.error };
  }

  const gearById = new Map(gearTypes.data.map((type) => [type.id, type]));
  const linesByBag = new Map<string, LineRow[]>();
  for (const line of sources.lines) {
    const list = linesByBag.get(line.bag_id) ?? [];
    list.push(line);
    linesByBag.set(line.bag_id, list);
  }
  const placementsByBag = groupPlacements(sources.placements);
  const bagViews: Record<string, RopeBagPanelData> = {};
  for (const bag of viewBags) {
    const cover = sources.coverage.get(bag.id) ?? null;
    bagViews[bag.id] = {
      lines: viewsForBag(linesByBag.get(bag.id) ?? [], placementsByBag.get(bag.id) ?? [], gearById, cover),
      audit: cover ? { createdAt: cover.createdAt, findingCount: cover.findingCount } : null,
    };
  }

  return {
    data: {
      compartment,
      apparatus,
      bags,
      looseBagId,
      audit,
      checklist: checklist.data,
      looseLines: looseBagId ? (bagViews[looseBagId]?.lines ?? []) : [],
      gearTypes: gearTypes.data,
      attachOptions: attach.data,
      bagViews,
      initialBagId: bags.some((bag) => bag.id === bagId) ? (bagId ?? null) : null,
      targets: targets.data,
    },
    error: null,
  };
}

export async function fetchCompartmentAuditGroups(
  supabase: SupabaseClient,
  compartmentId: string
): Promise<RopeResult<RopeAuditGroup[]>> {
  const bags = await loadBags(supabase, [compartmentId]);
  if (bags.error) return { data: [], error: bags.error };
  bags.rows.sort((a, b) => Number(a.is_loose) - Number(b.is_loose) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const lines = await loadLines(supabase, bags.rows.map((row) => row.id));
  if (lines.error) return { data: [], error: lines.error };
  const linesByBag = new Map<string, LineRow[]>();
  for (const line of lines.rows) {
    const list = linesByBag.get(line.bag_id) ?? [];
    list.push(line);
    linesByBag.set(line.bag_id, list);
  }

  return {
    data: bags.rows
      .map((bag) => ({
        bagId: bag.id,
        bagName: bag.is_loose ? "Loose equipment" : bag.name,
        loose: bag.is_loose,
        lines: (linesByBag.get(bag.id) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .filter((line) => line.expected_quantity > 0)
          .map((line) => {
            const gear = asSingle(line.gear_type);
            return {
              lineId: line.id,
              bagId: bag.id,
              gearTypeId: line.gear_type_id,
              gearTypeName: gear?.name ?? "Gear",
              gearSpec: embedSummary(gear),
              expectedQuantity: line.expected_quantity,
            };
          })
          ,
      }))
      .filter((group) => group.lines.length > 0),
    error: null,
  };
}

export async function fetchLoadoutTargets(
  supabase: SupabaseClient,
  excludeBagId: string
): Promise<RopeResult<RopeLoadoutTarget[]>> {
  const { data, error } = await supabase
    .from("rope_bags")
    .select("id, name, compartment_id, is_loose")
    .eq("is_loose", false);
  if (error) return { data: [], error };
  const bags = ((data ?? []) as BagRow[]).filter((bag) => bag.id !== excludeBagId);
  if (bags.length === 0) return { data: [], error: null };

  const compartmentIds = [...new Set(bags.map((bag) => bag.compartment_id))];
  const { data: compartmentData, error: compartmentError } = await supabase
    .from("rope_compartments")
    .select("id, name, apparatus_id")
    .in("id", compartmentIds);
  if (compartmentError) return { data: [], error: compartmentError };
  const compartments = (compartmentData ?? []) as { id: string; name: string; apparatus_id: string }[];
  const apparatusIds = [...new Set(compartments.map((compartment) => compartment.apparatus_id))];
  const { data: apparatusData, error: apparatusError } = await supabase
    .from("assets")
    .select("id, unit_number, build_number")
    .in("id", apparatusIds);
  if (apparatusError) return { data: [], error: apparatusError };

  const compartmentById = new Map(compartments.map((compartment) => [compartment.id, compartment]));
  const apparatusById = new Map(
    ((apparatusData ?? []) as { id: string; unit_number: string | null; build_number: string | null }[]).map(
      (unit) => [unit.id, unit]
    )
  );

  const targets = bags.flatMap((bag) => {
    const compartment = compartmentById.get(bag.compartment_id);
    const apparatus = compartment ? apparatusById.get(compartment.apparatus_id) : undefined;
    if (!compartment || !apparatus) return [];
    return [
      {
        id: bag.id,
        label: `${bag.name} · ${compartment.name} · ${ropeApparatusLabel(apparatus)}`,
      },
    ];
  });
  targets.sort((a, b) => a.label.localeCompare(b.label));
  return { data: targets, error: null };
}

function specForType(gearById: Map<string, RopeGearType>, gearTypeId: string) {
  const type = gearById.get(gearTypeId);
  return type ? ropeGearSummary(type.detailKind, type) : "";
}

function viewsForBag(
  lines: LineRow[],
  placements: PlacementRow[],
  gearById: Map<string, RopeGearType>,
  cover: AuditCover | null
): RopeBagLineView[] {
  const placementAssets = placements.map((row) => toLineAsset(row)).filter(Boolean) as RopeLineAsset[];
  const byType = new Map<string, RopeLineAsset[]>();
  for (const asset of placementAssets) {
    const typeId = placements.find((row) => row.id === asset.placementId)?.gear_type_id;
    if (!typeId) continue;
    const list = byType.get(typeId) ?? [];
    list.push(asset);
    byType.set(typeId, list);
  }

  const views: RopeBagLineView[] = lines.map((line) => {
    const gear = asSingle(line.gear_type);
    const assets = byType.get(line.gear_type_id) ?? [];
    const actual = line.quantity_on_hand + assets.length;
    return {
      id: line.id,
      persisted: true,
      gearTypeId: line.gear_type_id,
      gearTypeName: gear?.name ?? gearById.get(line.gear_type_id)?.name ?? "Gear",
      gearSpec: specForType(gearById, line.gear_type_id) || embedSummary(gear),
      expectedQuantity: line.expected_quantity,
      quantityOnHand: line.quantity_on_hand,
      sortOrder: line.sort_order,
      assets,
      actual,
      short: lineShort(line.expected_quantity, actual),
      auditFlag: null,
    };
  });

  const knownTypes = new Set(views.map((line) => line.gearTypeId));
  for (const [gearTypeId, assets] of byType) {
    if (knownTypes.has(gearTypeId)) continue;
    views.push({
      id: `orphan-${gearTypeId}`,
      persisted: false,
      gearTypeId,
      gearTypeName: gearById.get(gearTypeId)?.name ?? "Gear",
      gearSpec: specForType(gearById, gearTypeId),
      expectedQuantity: 0,
      quantityOnHand: 0,
      sortOrder: Number.MAX_SAFE_INTEGER,
      assets,
      actual: assets.length,
      short: 0,
      auditFlag: null,
    });
  }
  views.sort((a, b) => a.sortOrder - b.sortOrder || a.gearTypeName.localeCompare(b.gearTypeName));

  for (const view of views) {
    if (!cover) continue;
    view.auditFlag = cover.flags.get(view.gearTypeId) ?? null;
    const noted = view.auditFlag?.quantity ?? 0;
    if (noted > 0) {
      view.actual = Math.max(0, view.actual - noted);
      view.short = lineShort(view.expectedQuantity, view.actual);
    } else if (view.expectedQuantity > 0) {
      view.short = 0;
      view.actual = Math.max(view.actual, view.expectedQuantity);
    }
  }
  return views;
}

async function loadBagViewSources(
  supabase: SupabaseClient,
  bags: { id: string; compartmentId: string }[]
): Promise<{
  lines: LineRow[];
  placements: PlacementRow[];
  coverage: Map<string, AuditCover>;
  error: PostgrestError | null;
}> {
  const empty = { lines: [] as LineRow[], placements: [] as PlacementRow[], coverage: new Map<string, AuditCover>() };
  if (bags.length === 0) return { ...empty, error: null };
  const ids = bags.map((bag) => bag.id);
  const [lines, placements, coverage] = await Promise.all([
    loadLines(supabase, ids),
    loadBagPlacements(supabase, ids),
    fetchAuditCoverage(supabase, bags),
  ]);
  if (lines.error) return { ...empty, error: lines.error };
  if (placements.error) return { ...empty, error: placements.error };
  if (coverage.error) return { ...empty, error: coverage.error };
  return { lines: lines.rows, placements: placements.rows, coverage: coverage.byBag, error: null };
}

export async function fetchRopeBag(
  supabase: SupabaseClient,
  bagId: string
): Promise<
  RopeResult<{
    bag: BagRow;
    compartment: CompartmentRow;
    apparatus: ApparatusRow;
    lines: RopeBagLineView[];
    audit: RopeAuditSummary | null;
    gearTypes: RopeGearType[];
  } | null>
> {
  const { data, error } = await supabase
    .from("rope_bags")
    .select("id, compartment_id, name, sort_order, is_loose")
    .eq("id", bagId)
    .maybeSingle();
  if (error) return { data: null, error };
  const bag = data as BagRow | null;
  if (!bag) return { data: null, error: null };

  const { data: compartmentData, error: compartmentError } = await supabase
    .from("rope_compartments")
    .select("id, apparatus_id, name, sort_order")
    .eq("id", bag.compartment_id)
    .maybeSingle();
  if (compartmentError) return { data: null, error: compartmentError };
  const compartment = compartmentData as CompartmentRow | null;
  if (!compartment) return { data: null, error: null };

  const { data: apparatusData, error: apparatusError } = await supabase
    .from("assets")
    .select("id, unit_number, build_number, station, tracks_rope_inventory")
    .eq("id", compartment.apparatus_id)
    .maybeSingle();
  if (apparatusError) return { data: null, error: apparatusError };
  const apparatus = apparatusData as ApparatusRow | null;
  if (!apparatus) return { data: null, error: null };

  const lines = await loadLines(supabase, [bag.id]);
  if (lines.error) return { data: null, error: lines.error };
  const placements = await loadBagPlacements(supabase, [bag.id]);
  if (placements.error) return { data: null, error: placements.error };
  const gearTypes = await fetchGearTypes(supabase);
  if (gearTypes.error) return { data: null, error: gearTypes.error };

  const coverage = await fetchAuditCoverage(supabase, [
    { id: bag.id, compartmentId: bag.compartment_id },
  ]);
  if (coverage.error) return { data: null, error: coverage.error };
  const gearById = new Map(gearTypes.data.map((type) => [type.id, type]));
  const cover = coverage.byBag.get(bag.id) ?? null;
  const views = viewsForBag(lines.rows, placements.rows, gearById, cover);

  return {
    data: {
      bag,
      compartment,
      apparatus,
      lines: views,
      audit: cover
        ? { createdAt: cover.createdAt, findingCount: cover.findingCount }
        : null,
      gearTypes: gearTypes.data,
    },
    error: null,
  };
}

export async function fetchRopeCache(supabase: SupabaseClient): Promise<
  RopeResult<{
    gearTypes: RopeGearType[];
    rows: RopeCacheRow[];
  }>
> {
  const gearTypes = await fetchGearTypes(supabase);
  if (gearTypes.error) return { data: { gearTypes: [], rows: [] }, error: gearTypes.error };

  const { data: stockData, error: stockError } = await supabase
    .from("rope_cache_stock")
    .select("gear_type_id, quantity");
  if (stockError) return { data: { gearTypes: [], rows: [] }, error: stockError };

  const { data: spareData, error: spareError } = await supabase
    .from("rope_placements")
    .select(
      "id, asset_id, gear_type_id, bag_id, in_cache, asset:assets!asset_id(id, name, serial_number, status)"
    )
    .eq("in_cache", true);
  if (spareError) return { data: { gearTypes: [], rows: [] }, error: spareError };

  const quantities = new Map<string, number>();
  for (const row of (stockData ?? []) as { gear_type_id: string; quantity: number }[]) {
    quantities.set(row.gear_type_id, row.quantity);
  }

  const sparesByType = new Map<string, RopeCacheSpare[]>();
  for (const row of (spareData ?? []) as PlacementRow[]) {
    const asset = asSingle(row.asset);
    if (!asset) continue;
    const gearTypeName = gearTypes.data.find((type) => type.id === row.gear_type_id)?.name ?? "Gear";
    const list = sparesByType.get(row.gear_type_id) ?? [];
    list.push({
      placementId: row.id,
      assetId: row.asset_id,
      gearTypeId: row.gear_type_id,
      gearTypeName,
      label: ropeEquipmentLabel(asset),
      serialNumber: asset.serial_number,
      status: asset.status,
    });
    sparesByType.set(row.gear_type_id, list);
  }

  const rows: RopeCacheRow[] = gearTypes.data.map((type) => ({
    gearTypeId: type.id,
    gearTypeName: type.name,
    description: type.notes,
    summary: ropeGearSummary(type.detailKind, type),
    categoryId: type.categoryId,
    categoryName: type.categoryName,
    categorySortOrder: type.categorySortOrder,
    sortOrder: type.sort_order,
    detailKind: type.detailKind,
    color: type.color,
    diameter: type.diameter,
    length: type.length,
    brand: type.brand,
    material: type.material,
    quantity: quantities.get(type.id) ?? 0,
    spares: sparesByType.get(type.id) ?? [],
  }));

  return { data: { gearTypes: gearTypes.data, rows }, error: null };
}

export async function fetchUnplacedEquipment(
  supabase: SupabaseClient
): Promise<RopeResult<RopeAttachOption[]>> {
  const [{ data: assets, error: assetsError }, { data: placements, error: placementsError }] =
    await Promise.all([
      supabase
        .from("assets")
        .select("id, name, serial_number")
        .eq("kind", "ppe")
        .order("name", { ascending: true }),
      supabase.from("rope_placements").select("asset_id"),
    ]);
  if (assetsError) return { data: [], error: assetsError };
  if (placementsError) return { data: [], error: placementsError };

  const placed = new Set(
    ((placements ?? []) as { asset_id: string }[]).map((row) => row.asset_id)
  );
  const options = ((assets ?? []) as { id: string; name: string | null; serial_number: string | null }[])
    .filter((asset) => !placed.has(asset.id))
    .map((asset) => ({
      id: asset.id,
      label: ropeEquipmentLabel(asset),
    }));
  return { data: options, error: null };
}

function statsForLines(
  lines: LineRow[],
  placements: PlacementRow[],
  flags?: Map<string, RopeLineAuditFlag>
) {
  const counts = new Map<string, number>();
  for (const placement of placements) {
    counts.set(placement.gear_type_id, (counts.get(placement.gear_type_id) ?? 0) + 1);
  }
  let short = 0;
  let requiredLineCount = 0;
  for (const line of lines) {
    if (line.expected_quantity > 0) requiredLineCount += 1;
    const onHand = line.quantity_on_hand + (counts.get(line.gear_type_id) ?? 0);
    if (flags) {
      const noted = flags.get(line.gear_type_id)?.quantity ?? 0;
      if (noted > 0) short += lineShort(line.expected_quantity, Math.max(0, onHand - noted));
      continue;
    }
    short += lineShort(line.expected_quantity, onHand);
  }
  return { short, requiredLineCount };
}

type AuditCover = {
  createdAt: string;
  findingCount: number;
  flags: Map<string, RopeLineAuditFlag>;
};

function summarizeCoverage(byBag: Map<string, AuditCover>): RopeAuditSummary | null {
  let createdAt = "";
  let findingCount = 0;
  for (const cover of byBag.values()) {
    findingCount += cover.findingCount;
    if (cover.createdAt > createdAt) createdAt = cover.createdAt;
  }
  if (!createdAt) return null;
  return { createdAt, findingCount };
}

async function fetchAuditCoverage(
  supabase: SupabaseClient,
  bags: { id: string; compartmentId: string }[]
): Promise<{ byBag: Map<string, AuditCover>; error: PostgrestError | null }> {
  const byBag = new Map<string, AuditCover>();
  if (bags.length === 0) return { byBag, error: null };

  const bagIds = bags.map((bag) => bag.id);
  const compartmentIds = [...new Set(bags.map((bag) => bag.compartmentId))];
  const [{ data: bagAudits, error: bagError }, { data: compartmentAudits, error: compartmentError }] =
    await Promise.all([
      supabase.from("rope_audits").select("id, created_at, bag_id, compartment_id").in("bag_id", bagIds),
      supabase
        .from("rope_audits")
        .select("id, created_at, bag_id, compartment_id")
        .in("compartment_id", compartmentIds),
    ]);
  if (bagError) return { byBag, error: bagError };
  if (compartmentError) return { byBag, error: compartmentError };

  const audits = [
    ...((bagAudits ?? []) as { id: string; created_at: string; bag_id: string | null; compartment_id: string | null }[]),
    ...((compartmentAudits ?? []) as {
      id: string;
      created_at: string;
      bag_id: string | null;
      compartment_id: string | null;
    }[]),
  ];
  const uniqueAudits = [...new Map(audits.map((audit) => [audit.id, audit])).values()];
  if (uniqueAudits.length === 0) return { byBag, error: null };

  const { data: findingData, error: findingError } = await supabase
    .from("rope_audit_findings")
    .select("audit_id, bag_id, gear_type_id, reason, quantity, notes")
    .in(
      "audit_id",
      uniqueAudits.map((audit) => audit.id)
    );
  if (findingError) return { byBag, error: findingError };

  const findings = (findingData ?? []) as {
    audit_id: string;
    bag_id: string | null;
    gear_type_id: string | null;
    reason: RopeAuditReason;
    quantity: number;
    notes: string;
  }[];
  const rank: Record<RopeAuditReason, number> = { damaged: 3, missing: 2, other: 1 };

  for (const bag of bags) {
    const covering = uniqueAudits.filter(
      (audit) => audit.bag_id === bag.id || audit.compartment_id === bag.compartmentId
    );
    covering.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const winner = covering[0];
    if (!winner) continue;
    const flags = new Map<string, RopeLineAuditFlag>();
    for (const finding of findings) {
      if (finding.audit_id !== winner.id || !finding.gear_type_id) continue;
      if (finding.bag_id && finding.bag_id !== bag.id) continue;
      const next = {
        reason: finding.reason,
        quantity: finding.quantity,
        notes: finding.notes,
      };
      const current = flags.get(finding.gear_type_id);
      if (!current || rank[next.reason] > rank[current.reason]) flags.set(finding.gear_type_id, next);
    }
    byBag.set(bag.id, {
      createdAt: winner.created_at,
      findingCount: flags.size,
      flags,
    });
  }

  return { byBag, error: null };
}

function groupPlacements(rows: PlacementRow[]) {
  const map = new Map<string, PlacementRow[]>();
  for (const row of rows) {
    if (!row.bag_id) continue;
    const list = map.get(row.bag_id) ?? [];
    list.push(row);
    map.set(row.bag_id, list);
  }
  return map;
}

function toLineAsset(row: PlacementRow): RopeLineAsset | null {
  const asset = asSingle(row.asset);
  if (!asset) return null;
  return {
    placementId: row.id,
    assetId: row.asset_id,
    label: ropeEquipmentLabel(asset),
    serialNumber: asset.serial_number,
    status: asset.status,
  };
}

async function loadBags(
  supabase: SupabaseClient,
  compartmentIds: string[]
): Promise<{ rows: BagRow[]; error: PostgrestError | null }> {
  if (compartmentIds.length === 0) return { rows: [], error: null };
  const { data, error } = await supabase
    .from("rope_bags")
    .select("id, compartment_id, name, sort_order, is_loose")
    .in("compartment_id", compartmentIds);
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as BagRow[], error: null };
}

async function loadLines(
  supabase: SupabaseClient,
  bagIds: string[]
): Promise<{ rows: LineRow[]; error: PostgrestError | null }> {
  if (bagIds.length === 0) return { rows: [], error: null };
  const { data, error } = await supabase
    .from("rope_bag_lines")
    .select(
      LINE_GEAR_COLUMNS
    )
    .in("bag_id", bagIds);
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as LineRow[], error: null };
}

async function loadBagPlacements(
  supabase: SupabaseClient,
  bagIds: string[]
): Promise<{ rows: PlacementRow[]; error: PostgrestError | null }> {
  if (bagIds.length === 0) return { rows: [], error: null };
  const { data, error } = await supabase
    .from("rope_placements")
    .select(
      "id, asset_id, gear_type_id, bag_id, in_cache, asset:assets!asset_id(id, name, serial_number, status)"
    )
    .in("bag_id", bagIds);
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as PlacementRow[], error: null };
}
