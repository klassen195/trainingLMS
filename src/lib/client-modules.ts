import type { AppCapability } from "@/lib/capabilities";
import { capabilityMeta } from "@/lib/capabilities";

/** Feature modules that platform admins can enable/disable and reorder per client. */
export const CLIENT_MODULES = [
  "access_shift_exchange",
  "access_shift_plan",
  "access_professional_services",
  "access_programs",
  "access_assets",
  "view_fleet",
  "manage_incidents",
  "access_personnel",
  "document_training",
  "approval_tracker",
  "author_training",
  "access_reports",
] as const satisfies readonly AppCapability[];

export type ClientModuleKey = (typeof CLIENT_MODULES)[number];

export type ClientModule = {
  module_key: ClientModuleKey;
  enabled: boolean;
  sort_order: number;
};

export type ClientModuleRow = ClientModule & {
  client_id: string;
};

export type PlatformModuleOrderItem = {
  module_key: ClientModuleKey;
  sort_order: number;
};

export function isClientModuleKey(value: string): value is ClientModuleKey {
  return (CLIENT_MODULES as readonly string[]).includes(value);
}

export function clientModuleLabel(key: ClientModuleKey): string {
  if (key === "access_professional_services") return "Services";
  if (key === "author_training") return "Instructor";
  if (key === "approval_tracker") return "Policy Tracker";
  if (key === "document_training") return "Training";
  if (key === "access_reports") return "Reports";
  return capabilityMeta[key].label;
}

export function normalizePlatformModuleOrder(
  rows?: readonly { module_key: string; sort_order?: number | null }[] | null
): PlatformModuleOrderItem[] {
  const byKey = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!isClientModuleKey(row.module_key)) continue;
    byKey.set(row.module_key, row.sort_order ?? Number.MAX_SAFE_INTEGER);
  }

  const ordered = CLIENT_MODULES.map((module_key, index) => ({
    module_key,
    sort_order: byKey.get(module_key) ?? index + 1,
  }));

  ordered.sort((a, b) => a.sort_order - b.sort_order || a.module_key.localeCompare(b.module_key));
  return ordered.map((row, index) => ({ ...row, sort_order: index + 1 }));
}

export function masterModuleKeys(
  masterOrder?: readonly PlatformModuleOrderItem[] | readonly ClientModuleKey[] | null
): ClientModuleKey[] {
  if (!masterOrder || masterOrder.length === 0) return [...CLIENT_MODULES];
  if (typeof masterOrder[0] === "string") {
    return normalizePlatformModuleOrder(
      (masterOrder as readonly ClientModuleKey[]).map((module_key, index) => ({
        module_key,
        sort_order: index + 1,
      }))
    ).map((row) => row.module_key);
  }
  return normalizePlatformModuleOrder(masterOrder as readonly PlatformModuleOrderItem[]).map(
    (row) => row.module_key
  );
}

export function defaultClientModules(
  masterOrder?: readonly PlatformModuleOrderItem[] | readonly ClientModuleKey[] | null
): ClientModule[] {
  return masterModuleKeys(masterOrder).map((module_key, index) => ({
    module_key,
    enabled: true,
    sort_order: index + 1,
  }));
}

export function normalizeClientModules(
  rows?: readonly { module_key: string; enabled?: boolean | null; sort_order?: number | null }[] | null,
  masterOrder?: readonly PlatformModuleOrderItem[] | readonly ClientModuleKey[] | null
): ClientModule[] {
  const byKey = new Map<string, { enabled: boolean; sort_order: number }>();
  for (const row of rows ?? []) {
    if (!isClientModuleKey(row.module_key)) continue;
    byKey.set(row.module_key, {
      enabled: row.enabled !== false,
      sort_order: row.sort_order ?? Number.MAX_SAFE_INTEGER,
    });
  }

  const catalog = masterModuleKeys(masterOrder);
  const ordered = catalog.map((module_key, index) => {
    const existing = byKey.get(module_key);
    return {
      module_key,
      enabled: existing?.enabled ?? true,
      sort_order: existing?.sort_order ?? index + 1,
    };
  });

  ordered.sort((a, b) => a.sort_order - b.sort_order || a.module_key.localeCompare(b.module_key));
  return ordered.map((row, index) => ({ ...row, sort_order: index + 1 }));
}

export function applyClientModuleGates(
  capabilities: Record<AppCapability, boolean>,
  modules: readonly ClientModule[]
): Record<AppCapability, boolean> {
  const next = { ...capabilities };
  for (const module of modules) {
    if (!module.enabled) next[module.module_key] = false;
  }
  return next;
}
