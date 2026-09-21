"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseErrorMessage } from "@/lib/supabase/errors";
import {
  slugifyTaskbookPrerequisiteCode,
  taskbookGroupLabelForKey,
  TASKBOOK_TYPE_SELECT,
  TASKBOOK_TYPE_WITH_PREREQS_SELECT,
  type TaskbookType,
  type TaskbookTypeWithPrerequisites,
} from "@/lib/taskbook-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (
    error.code === "PGRST205" ||
    error.message.includes("taskbook_types") ||
    error.message.includes("taskbook_prerequisites")
  ) {
    throw new Error(
      "Taskbook catalog is not set up yet. Run the taskbook_types migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type TaskbookTypeFormInput = {
  name: string;
  group_key?: string;
  group_label?: string;
  sort_order?: number;
  is_active?: boolean;
  auto_issued?: boolean;
  requestable?: boolean;
  pdip_eligible?: boolean;
  qualification_id?: string | null;
  notes?: string;
  prerequisites?: { code?: string; label: string }[];
};

function revalidateTaskbooks() {
  revalidatePath("/admin");
  revalidatePath("/admin/taskbooks");
  revalidatePath("/personnel", "layout");
  revalidatePath("/reports/pdip");
}

async function replacePrerequisites(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  taskbookTypeId: string,
  prerequisites: { code?: string; label: string }[] | undefined
) {
  if (prerequisites === undefined) return;

  const { error: deleteError } = await supabase
    .from("taskbook_prerequisites")
    .delete()
    .eq("taskbook_type_id", taskbookTypeId);
  throwIfMissing(deleteError);
  if (deleteError) throw new Error(supabaseErrorMessage(deleteError));

  const rows = prerequisites
    .map((item, index) => {
      const label = item.label.trim();
      if (!label) return null;
      const code = emptyToNull(item.code) || slugifyTaskbookPrerequisiteCode(label);
      return {
        taskbook_type_id: taskbookTypeId,
        code,
        label,
        sort_order: index + 1,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length === 0) return;

  // Ensure unique codes within the batch.
  const used = new Set<string>();
  for (const row of rows) {
    let code = row.code;
    let suffix = 2;
    while (used.has(code)) {
      code = `${row.code}-${suffix}`;
      suffix += 1;
    }
    used.add(code);
    row.code = code;
  }

  const { error: insertError } = await supabase.from("taskbook_prerequisites").insert(rows);
  throwIfMissing(insertError);
  if (insertError) throw new Error(supabaseErrorMessage(insertError));
}

export async function createTaskbookType(input: TaskbookTypeFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const groupKey = emptyToNull(input.group_key) || "other";
  const groupLabel =
    emptyToNull(input.group_label) || taskbookGroupLabelForKey(groupKey);
  const autoIssued = Boolean(input.auto_issued);
  const requestable = input.requestable ?? !autoIssued;

  const supabase = await createSupabaseServerClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("taskbook_types")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("taskbook_types")
    .insert({
      name,
      group_key: groupKey,
      group_label: groupLabel,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      auto_issued: autoIssued,
      requestable,
      pdip_eligible: Boolean(input.pdip_eligible),
      qualification_id: emptyToNull(input.qualification_id ?? null),
      notes: input.notes?.trim() ?? "",
    })
    .select(TASKBOOK_TYPE_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  await replacePrerequisites(supabase, data.id, input.prerequisites ?? []);
  revalidateTaskbooks();

  const { data: full, error: fullError } = await supabase
    .from("taskbook_types")
    .select(TASKBOOK_TYPE_WITH_PREREQS_SELECT)
    .eq("id", data.id)
    .single();
  throwIfMissing(fullError);
  if (fullError) throw new Error(supabaseErrorMessage(fullError));
  return full as TaskbookTypeWithPrerequisites;
}

export async function updateTaskbookType(id: string, input: TaskbookTypeFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("taskbook_types")
    .select(TASKBOOK_TYPE_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Taskbook not found.");

  const previous = existing as TaskbookType;
  const groupKey = emptyToNull(input.group_key) || previous.group_key;
  const groupLabel =
    emptyToNull(input.group_label) ||
    taskbookGroupLabelForKey(groupKey) ||
    previous.group_label;
  const autoIssued = input.auto_issued ?? previous.auto_issued;
  const requestable = input.requestable ?? previous.requestable;

  const qualificationId =
    input.qualification_id === undefined
      ? previous.qualification_id
      : emptyToNull(input.qualification_id);

  const { data, error } = await supabase
    .from("taskbook_types")
    .update({
      name,
      group_key: groupKey,
      group_label: groupLabel,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      auto_issued: autoIssued,
      requestable: autoIssued ? false : requestable,
      pdip_eligible: input.pdip_eligible ?? previous.pdip_eligible,
      qualification_id: qualificationId,
      notes: input.notes?.trim() ?? previous.notes,
    })
    .eq("id", id)
    .select(TASKBOOK_TYPE_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  if (previous.name !== name) {
    const [{ error: renameTaskbooksError }, { error: renameChecksError }] = await Promise.all([
      supabase
        .from("personnel_taskbooks")
        .update({ rank: name })
        .eq("rank", previous.name),
      supabase
        .from("personnel_taskbook_prerequisite_checks")
        .update({ rank: name })
        .eq("rank", previous.name),
    ]);
    if (renameTaskbooksError) throw new Error(supabaseErrorMessage(renameTaskbooksError));
    if (renameChecksError) throw new Error(supabaseErrorMessage(renameChecksError));
  }

  await replacePrerequisites(supabase, id, input.prerequisites);
  revalidateTaskbooks();

  const { data: full, error: fullError } = await supabase
    .from("taskbook_types")
    .select(TASKBOOK_TYPE_WITH_PREREQS_SELECT)
    .eq("id", id)
    .single();
  throwIfMissing(fullError);
  if (fullError) throw new Error(supabaseErrorMessage(fullError));
  return full as TaskbookTypeWithPrerequisites;
}

export async function deleteTaskbookType(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("taskbook_types")
    .select(TASKBOOK_TYPE_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Taskbook not found.");

  const taskbook = existing as TaskbookType;

  const { count, error: countError } = await supabase
    .from("personnel_taskbooks")
    .select("id", { count: "exact", head: true })
    .eq("rank", taskbook.name);
  if (countError) throw new Error(supabaseErrorMessage(countError));

  const used = count ?? 0;
  if (used > 0) {
    throw new Error(
      `Cannot delete "${taskbook.name}" while it is still used by ${used} personnel record${used === 1 ? "" : "s"}. Deactivate it instead.`
    );
  }

  const { error } = await supabase.from("taskbook_types").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateTaskbooks();
}

export async function reorderTaskbookTypes(input: { taskbookTypeIds: string[] }) {
  await requireAdmin();
  if (input.taskbookTypeIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.taskbookTypeIds.entries()) {
    const { error } = await supabase
      .from("taskbook_types")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidateTaskbooks();
}
