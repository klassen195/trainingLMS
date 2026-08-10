"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingQualificationsTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import {
  QUALIFICATION_SELECT,
  type Qualification,
} from "@/lib/qualifications-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (isMissingQualificationsTable(error)) {
    throw new Error(
      "Qualifications table is not set up yet. Run the qualifications migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type QualificationFormInput = {
  name: string;
  sort_order?: number;
  is_active?: boolean;
  notes?: string;
};

function revalidateQualifications() {
  revalidatePath("/admin");
  revalidatePath("/admin/qualifications");
  revalidatePath("/document-training");
  revalidatePath("/document-training/new");
  revalidatePath("/personnel", "layout");
}

export async function createQualification(input: QualificationFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("qualifications")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("qualifications")
    .insert({
      name,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      notes: input.notes?.trim() ?? "",
    })
    .select(QUALIFICATION_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateQualifications();
  return data as Qualification;
}

export async function updateQualification(id: string, input: QualificationFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("qualifications")
    .select(QUALIFICATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Qualification not found.");

  const previous = existing as Qualification;

  const { data, error } = await supabase
    .from("qualifications")
    .update({
      name,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      notes: input.notes?.trim() ?? previous.notes,
    })
    .eq("id", id)
    .select(QUALIFICATION_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateQualifications();
  return data as Qualification;
}

export async function deleteQualification(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("qualifications")
    .select(QUALIFICATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Qualification not found.");

  const qualification = existing as Qualification;

  const [{ count: sessionCount, error: sessionCountError }, { count: personnelCount, error: personnelCountError }] =
    await Promise.all([
      supabase
        .from("training_sessions")
        .select("id", { count: "exact", head: true })
        .eq("qualification_id", qualification.id),
      supabase
        .from("personnel_qualifications")
        .select("id", { count: "exact", head: true })
        .eq("qualification_id", qualification.id),
    ]);

  if (sessionCountError) throw new Error(supabaseErrorMessage(sessionCountError));
  if (personnelCountError) throw new Error(supabaseErrorMessage(personnelCountError));

  const sessions = sessionCount ?? 0;
  const people = personnelCount ?? 0;
  if (sessions > 0 || people > 0) {
    const parts: string[] = [];
    if (sessions > 0) {
      parts.push(`${sessions} training report${sessions === 1 ? "" : "s"}`);
    }
    if (people > 0) {
      parts.push(`${people} personnel assignment${people === 1 ? "" : "s"}`);
    }
    throw new Error(
      `Cannot delete "${qualification.name}" while it is still used by ${parts.join(" and ")}. Deactivate it instead.`
    );
  }

  const { error } = await supabase.from("qualifications").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateQualifications();
}

export async function reorderQualifications(input: { qualificationIds: string[] }) {
  await requireAdmin();
  if (input.qualificationIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.qualificationIds.entries()) {
    const { error } = await supabase
      .from("qualifications")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidateQualifications();
}
