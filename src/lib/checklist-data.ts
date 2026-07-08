import type { ChecklistItem, ChecklistItemWithProgress } from "@/lib/training-lms-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loadChecklistItems(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resourceId: string
): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("resource_id", resourceId)
    .order("sort_order");

  if (error) throw error;
  return (data ?? []) as ChecklistItem[];
}

export async function loadChecklistItemsByResourceIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resourceIds: string[]
): Promise<Record<string, ChecklistItem[]>> {
  if (resourceIds.length === 0) return {};

  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .in("resource_id", resourceIds)
    .order("sort_order");

  if (error) throw error;

  const grouped: Record<string, ChecklistItem[]> = {};
  for (const item of (data ?? []) as ChecklistItem[]) {
    grouped[item.resource_id] ??= [];
    grouped[item.resource_id].push(item);
  }
  return grouped;
}

export async function loadChecklistItemsWithProgress(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resourceId: string,
  userId: string
): Promise<ChecklistItemWithProgress[]> {
  const items = await loadChecklistItems(supabase, resourceId);
  if (items.length === 0) return [];

  const itemIds = items.map((item) => item.id);
  const { data: progressRows, error } = await supabase
    .from("checklist_item_progress")
    .select("item_id, completed_at")
    .eq("user_id", userId)
    .in("item_id", itemIds);

  if (error) throw error;

  const progressByItemId = new Map(
    (progressRows ?? []).map((row) => [row.item_id as string, row.completed_at as string])
  );

  return items.map((item) => ({
    ...item,
    completed_at: progressByItemId.get(item.id) ?? null,
  }));
}

export type ModuleChecklistWithProgress = {
  resourceId: string;
  title: string;
  items: ChecklistItemWithProgress[];
  resourceCompleted: boolean;
};

export async function loadModuleChecklistsWithProgress(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  checklistResources: { id: string; title: string }[],
  userId: string,
  completedResourceIds: string[]
): Promise<ModuleChecklistWithProgress[]> {
  const completedSet = new Set(completedResourceIds);

  return Promise.all(
    checklistResources.map(async (resource) => ({
      resourceId: resource.id,
      title: resource.title,
      items: await loadChecklistItemsWithProgress(supabase, resource.id, userId),
      resourceCompleted: completedSet.has(resource.id),
    }))
  );
}
