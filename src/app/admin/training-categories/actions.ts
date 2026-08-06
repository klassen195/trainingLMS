"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingTrainingCategoriesTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import {
  TRAINING_CATEGORY_SELECT,
  type TrainingCategory,
} from "@/lib/training-categories-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (isMissingTrainingCategoriesTable(error)) {
    throw new Error(
      "Training categories table is not set up yet. Run the training categories migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type TrainingCategoryFormInput = {
  name: string;
  sort_order?: number;
  is_active?: boolean;
  notes?: string;
};

function revalidateTrainingCategories() {
  revalidatePath("/admin");
  revalidatePath("/admin/training-categories");
  revalidatePath("/document-training");
  revalidatePath("/document-training/new");
}

export async function createTrainingCategory(input: TrainingCategoryFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("training_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("training_categories")
    .insert({
      name,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      notes: input.notes?.trim() ?? "",
    })
    .select(TRAINING_CATEGORY_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateTrainingCategories();
  return data as TrainingCategory;
}

export async function updateTrainingCategory(id: string, input: TrainingCategoryFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("training_categories")
    .select(TRAINING_CATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Category not found.");

  const previous = existing as TrainingCategory;

  const { data, error } = await supabase
    .from("training_categories")
    .update({
      name,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      notes: input.notes?.trim() ?? previous.notes,
    })
    .eq("id", id)
    .select(TRAINING_CATEGORY_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateTrainingCategories();
  return data as TrainingCategory;
}

export async function deleteTrainingCategory(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("training_categories")
    .select(TRAINING_CATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Category not found.");

  const category = existing as TrainingCategory;

  const { count, error: countError } = await supabase
    .from("training_sessions")
    .select("id", { count: "exact", head: true })
    .eq("category_id", category.id);

  if (countError) throw new Error(supabaseErrorMessage(countError));
  if ((count ?? 0) > 0) {
    throw new Error(
      `Cannot delete "${category.name}" while ${count} session${count === 1 ? "" : "s"} still use it. Deactivate it instead, or reassign those sessions.`
    );
  }

  const { error } = await supabase.from("training_categories").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateTrainingCategories();
}

export async function reorderTrainingCategories(input: { categoryIds: string[] }) {
  await requireAdmin();
  if (input.categoryIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.categoryIds.entries()) {
    const { error } = await supabase
      .from("training_categories")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidateTrainingCategories();
}
