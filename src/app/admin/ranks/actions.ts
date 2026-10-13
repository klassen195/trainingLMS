"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingPersonnelRanksTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { PERSONNEL_RANK_SELECT, type PersonnelRank } from "@/lib/ranks-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (isMissingPersonnelRanksTable(error)) {
    throw new Error(
      "Personnel ranks table is not set up yet. Run the personnel_ranks migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type PersonnelRankFormInput = {
  name: string;
  sort_order?: number;
  is_active?: boolean;
  notes?: string;
  has_title?: boolean;
  title_only?: boolean;
  no_probation?: boolean;
  swing_up_eligible?: boolean;
};

function revalidateRanks() {
  revalidatePath("/admin");
  revalidatePath("/admin/ranks");
  revalidatePath("/personnel", "layout");
}

function normalizeFlags(input: PersonnelRankFormInput, previous?: PersonnelRank) {
  const hasTitle = input.has_title ?? previous?.has_title ?? false;
  const titleOnly = input.title_only ?? previous?.title_only ?? false;
  return {
    has_title: hasTitle || titleOnly,
    title_only: titleOnly,
    no_probation: input.no_probation ?? previous?.no_probation ?? false,
    swing_up_eligible: input.swing_up_eligible ?? previous?.swing_up_eligible ?? false,
  };
}

export async function createPersonnelRank(input: PersonnelRankFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();
  const flags = normalizeFlags(input);

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("personnel_ranks")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("personnel_ranks")
    .insert({
      name,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      notes: input.notes?.trim() ?? "",
      ...flags,
    })
    .select(PERSONNEL_RANK_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateRanks();
  return data as PersonnelRank;
}

export async function updatePersonnelRank(id: string, input: PersonnelRankFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("personnel_ranks")
    .select(PERSONNEL_RANK_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Rank not found.");

  const previous = existing as PersonnelRank;
  const flags = normalizeFlags(input, previous);

  const { data, error } = await supabase
    .from("personnel_ranks")
    .update({
      name,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      notes: input.notes?.trim() ?? previous.notes,
      ...flags,
    })
    .eq("id", id)
    .select(PERSONNEL_RANK_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  if (previous.name !== name) {
    const { error: profileRankError } = await supabase
      .from("profiles")
      .update({ rank: name })
      .eq("rank", previous.name);
    if (profileRankError) throw new Error(supabaseErrorMessage(profileRankError));

    const { data: swingRows, error: swingReadError } = await supabase
      .from("profiles")
      .select("id, swing_up")
      .contains("swing_up", [previous.name]);
    if (swingReadError) throw new Error(supabaseErrorMessage(swingReadError));

    for (const row of swingRows ?? []) {
      const next = (row.swing_up as string[] | null)?.map((value) =>
        value === previous.name ? name : value
      );
      if (!next) continue;
      const { error: swingWriteError } = await supabase
        .from("profiles")
        .update({ swing_up: next })
        .eq("id", row.id);
      if (swingWriteError) throw new Error(supabaseErrorMessage(swingWriteError));
    }
  }

  revalidateRanks();
  return data as PersonnelRank;
}

export async function deletePersonnelRank(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("personnel_ranks")
    .select(PERSONNEL_RANK_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Rank not found.");

  const rank = existing as PersonnelRank;

  const { count: profileCount, error: profileCountError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("rank", rank.name);

  if (profileCountError) throw new Error(supabaseErrorMessage(profileCountError));

  const profiles = profileCount ?? 0;
  if (profiles > 0) {
    throw new Error(
      `Cannot delete "${rank.name}" while it is still assigned to ${profiles} personnel file${profiles === 1 ? "" : "s"}. Deactivate it instead.`
    );
  }

  const { count: swingCount, error: swingCountError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .contains("swing_up", [rank.name]);

  if (swingCountError) throw new Error(supabaseErrorMessage(swingCountError));

  const swing = swingCount ?? 0;
  if (swing > 0) {
    throw new Error(
      `Cannot delete "${rank.name}" while it is still listed as swing-up for ${swing} personnel file${swing === 1 ? "" : "s"}. Deactivate it instead.`
    );
  }

  const { error } = await supabase.from("personnel_ranks").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateRanks();
}

export async function reorderPersonnelRanks(input: { rankIds: string[] }) {
  await requireAdmin();
  if (input.rankIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.rankIds.entries()) {
    const { error } = await supabase
      .from("personnel_ranks")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidateRanks();
}
