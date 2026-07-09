import { isChecklistResource } from "@/lib/module-resources";
import { progressPercent } from "@/lib/program-progress";
import type { ModuleResourceType } from "@/lib/training-lms-types";

export type ModuleProgressUnits = {
  completedUnits: number;
  totalUnits: number;
};

type ModuleResourceRow = {
  id: string;
  module_id: string;
  resource_type: ModuleResourceType;
};

type ChecklistItemRow = {
  id: string;
  resource_id: string;
};

export function computeModuleProgressUnits(input: {
  resources: ModuleResourceRow[];
  checklistItemsByResourceId: Map<string, string[]>;
  completedResourceIds: Set<string>;
  completedChecklistItemIds: Set<string>;
  moduleMarkedComplete: boolean;
}): ModuleProgressUnits {
  const {
    resources,
    checklistItemsByResourceId,
    completedResourceIds,
    completedChecklistItemIds,
    moduleMarkedComplete,
  } = input;

  if (resources.length === 0) {
    return {
      totalUnits: 1,
      completedUnits: moduleMarkedComplete ? 1 : 0,
    };
  }

  let totalUnits = 0;
  let completedUnits = 0;

  for (const resource of resources) {
    if (isChecklistResource(resource)) {
      const itemIds = checklistItemsByResourceId.get(resource.id) ?? [];
      if (itemIds.length === 0) continue;

      totalUnits += itemIds.length;
      if (completedResourceIds.has(resource.id)) {
        completedUnits += itemIds.length;
      } else {
        for (const itemId of itemIds) {
          if (completedChecklistItemIds.has(itemId)) completedUnits += 1;
        }
      }
      continue;
    }

    totalUnits += 1;
    if (completedResourceIds.has(resource.id)) completedUnits += 1;
  }

  if (totalUnits === 0) {
    return {
      totalUnits: 1,
      completedUnits: moduleMarkedComplete ? 1 : 0,
    };
  }

  return { totalUnits, completedUnits };
}

export function moduleProgressPercent(units: ModuleProgressUnits): number {
  return progressPercent(units.totalUnits, units.completedUnits);
}

export function aggregateModuleProgressUnits(moduleUnits: ModuleProgressUnits[]): ModuleProgressUnits {
  return moduleUnits.reduce(
    (totals, units) => ({
      totalUnits: totals.totalUnits + units.totalUnits,
      completedUnits: totals.completedUnits + units.completedUnits,
    }),
    { totalUnits: 0, completedUnits: 0 }
  );
}

export function groupChecklistItemsByResourceId(
  items: ChecklistItemRow[]
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const item of items) {
    const itemIds = grouped.get(item.resource_id) ?? [];
    itemIds.push(item.id);
    grouped.set(item.resource_id, itemIds);
  }
  return grouped;
}

export function groupResourcesByModuleId(
  resources: ModuleResourceRow[]
): Map<string, ModuleResourceRow[]> {
  const grouped = new Map<string, ModuleResourceRow[]>();
  for (const resource of resources) {
    const moduleResources = grouped.get(resource.module_id) ?? [];
    moduleResources.push(resource);
    grouped.set(resource.module_id, moduleResources);
  }
  return grouped;
}
