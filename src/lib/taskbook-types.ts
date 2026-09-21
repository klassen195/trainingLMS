export const TASKBOOK_GROUP_OPTIONS = [
  { key: "rank", label: "Rank" },
  { key: "specialty", label: "Specialty" },
  { key: "ems", label: "EMS" },
  { key: "wildland", label: "Wildland" },
  { key: "other", label: "Other" },
] as const;

export type TaskbookGroupOption = (typeof TASKBOOK_GROUP_OPTIONS)[number];
export type TaskbookGroupKey = TaskbookGroupOption["key"];

export type TaskbookType = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  group_key: string;
  group_label: string;
  sort_order: number;
  is_active: boolean;
  auto_issued: boolean;
  requestable: boolean;
  pdip_eligible: boolean;
  qualification_id: string | null;
  notes: string;
};

export type TaskbookPrerequisiteDef = {
  id: string;
  taskbook_type_id: string;
  code: string;
  label: string;
  sort_order: number;
  created_at: string;
};

export type TaskbookTypeWithPrerequisites = TaskbookType & {
  prerequisites: TaskbookPrerequisiteDef[];
};

export const TASKBOOK_TYPE_SELECT =
  "id, created_at, updated_at, name, group_key, group_label, sort_order, is_active, auto_issued, requestable, pdip_eligible, qualification_id, notes";

export const TASKBOOK_PREREQUISITE_SELECT =
  "id, taskbook_type_id, code, label, sort_order, created_at";

export const TASKBOOK_TYPE_WITH_PREREQS_SELECT = `${TASKBOOK_TYPE_SELECT}, prerequisites:taskbook_prerequisites(${TASKBOOK_PREREQUISITE_SELECT})`;

export function taskbookGroupLabelForKey(key: string) {
  const match = TASKBOOK_GROUP_OPTIONS.find((option) => option.key === key);
  return match?.label ?? (key.trim() || "Other");
}

export function slugifyTaskbookPrerequisiteCode(label: string) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `prereq-${Date.now().toString(36)}`;
}

export function findTaskbookTypeByName<T extends TaskbookType>(
  types: readonly T[],
  name: string
): T | null {
  const needle = name.trim().toLowerCase();
  return types.find((type) => type.name.trim().toLowerCase() === needle) ?? null;
}

export function groupTaskbookCatalog(types: readonly TaskbookType[]) {
  const byKey = new Map<string, { key: string; label: string; types: TaskbookType[] }>();
  for (const type of types) {
    const key = type.group_key || "other";
    const existing = byKey.get(key);
    if (existing) {
      existing.types.push(type);
      continue;
    }
    byKey.set(key, {
      key,
      label: type.group_label || taskbookGroupLabelForKey(key),
      types: [type],
    });
  }

  const preferred = TASKBOOK_GROUP_OPTIONS.map((option) => option.key);
  const groups = [...byKey.values()].sort((a, b) => {
    const ai = preferred.indexOf(a.key as TaskbookGroupKey);
    const bi = preferred.indexOf(b.key as TaskbookGroupKey);
    const aOrder = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bOrder = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.label.localeCompare(b.label);
  });

  for (const group of groups) {
    group.types.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
  return groups;
}
