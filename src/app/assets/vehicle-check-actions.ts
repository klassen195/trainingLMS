"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireRole, requireUserProfile } from "@/lib/auth";
import type { ApparatusType } from "@/lib/assets-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingVehicleChecksTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { resolveVehicleCheckTemplate } from "@/lib/vehicle-checks";
import type {
  VehicleCheckFieldType,
  VehicleCheckItemResult,
  VehicleCheckLevel,
  VehicleCheckType,
} from "@/lib/vehicle-checks-types";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingVehicleChecksTable(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260729140000_vehicle_checks.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateVehicleChecks(assetId?: string, templateId?: string) {
  revalidatePath("/assets", "layout");
  revalidatePath("/admin/vehicle-checks");
  if (templateId) {
    revalidatePath(`/admin/vehicle-checks/${templateId}`);
  }
  if (assetId) {
    revalidatePath(`/assets/${assetId}`);
  }
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  templateId: string
) {
  const { data, error } = await supabase
    .from("vehicle_check_template_items")
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1);

  throwIfDbError(error);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function createVehicleCheckTemplate(input: {
  name: string;
  apparatusType?: ApparatusType | null;
  isTypeDefault?: boolean;
  notes?: string;
}) {
  await requireRole(["admin"]);
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required.");

  const apparatusType = input.apparatusType ?? null;
  const isTypeDefault = Boolean(input.isTypeDefault);
  if (isTypeDefault && !apparatusType) {
    throw new Error("Set an apparatus type before marking a type default.");
  }

  const supabase = await createSupabaseServerClient();

  if (isTypeDefault && apparatusType) {
    const { error: clearError } = await supabase
      .from("vehicle_check_templates")
      .update({ is_type_default: false })
      .eq("apparatus_type", apparatusType)
      .eq("is_type_default", true);
    throwIfDbError(clearError);
  }

  const { data, error } = await supabase
    .from("vehicle_check_templates")
    .insert({
      name,
      apparatus_type: apparatusType,
      is_type_default: isTypeDefault,
      notes: input.notes?.trim() ?? "",
    })
    .select("id")
    .single();

  throwIfDbError(error);
  revalidateVehicleChecks(undefined, data!.id);
  redirect(`/admin/vehicle-checks/${data!.id}`);
}

export async function updateVehicleCheckTemplate(input: {
  id: string;
  name: string;
  apparatusType?: ApparatusType | null;
  isTypeDefault?: boolean;
  notes?: string;
}) {
  await requireRole(["admin"]);
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required.");

  const apparatusType = input.apparatusType ?? null;
  const isTypeDefault = Boolean(input.isTypeDefault);
  if (isTypeDefault && !apparatusType) {
    throw new Error("Set an apparatus type before marking a type default.");
  }

  const supabase = await createSupabaseServerClient();

  if (isTypeDefault && apparatusType) {
    const { error: clearError } = await supabase
      .from("vehicle_check_templates")
      .update({ is_type_default: false })
      .eq("apparatus_type", apparatusType)
      .eq("is_type_default", true)
      .neq("id", input.id);
    throwIfDbError(clearError);
  }

  const { error } = await supabase
    .from("vehicle_check_templates")
    .update({
      name,
      apparatus_type: apparatusType,
      is_type_default: isTypeDefault,
      notes: input.notes?.trim() ?? "",
    })
    .eq("id", input.id);

  throwIfDbError(error);
  revalidateVehicleChecks(undefined, input.id);
}

export async function deleteVehicleCheckTemplate(id: string) {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const { data: template, error: fetchError } = await supabase
    .from("vehicle_check_templates")
    .select("id, is_type_default")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!template) throw new Error("Template not found.");
  if (template.is_type_default) {
    throw new Error("Clear the type-default flag before deleting this template.");
  }

  const { count, error: countError } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_check_template_id", id);
  throwIfDbError(countError);
  if ((count ?? 0) > 0) {
    throw new Error("Reassign units that override to this template before deleting it.");
  }

  const { error } = await supabase.from("vehicle_check_templates").delete().eq("id", id);
  throwIfDbError(error);
  revalidateVehicleChecks();
  redirect("/admin/vehicle-checks");
}

export async function createVehicleCheckTemplateSection(input: {
  templateId: string;
  label: string;
}) {
  await requireRole(["admin"]);
  const label = input.label.trim();
  if (!label) throw new Error("Section title is required.");

  const supabase = await createSupabaseServerClient();
  const sort_order = await nextSortOrder(supabase, input.templateId);

  const { error } = await supabase.from("vehicle_check_template_items").insert({
    template_id: input.templateId,
    row_kind: "section",
    check_type: null,
    field_type: null,
    label,
    help_text: "",
    sort_order,
    is_active: true,
  });

  throwIfDbError(error);
  revalidateVehicleChecks(undefined, input.templateId);
}

export async function createVehicleCheckTemplateItem(input: {
  templateId: string;
  checkType: VehicleCheckType;
  fieldType: VehicleCheckFieldType;
  label: string;
  helpText?: string;
}) {
  await requireRole(["admin"]);
  const label = input.label.trim();
  if (!label) throw new Error("Label is required.");

  const supabase = await createSupabaseServerClient();
  const sort_order = await nextSortOrder(supabase, input.templateId);

  const { error } = await supabase.from("vehicle_check_template_items").insert({
    template_id: input.templateId,
    row_kind: "item",
    check_type: input.checkType,
    field_type: input.fieldType,
    label,
    help_text: input.helpText?.trim() ?? "",
    sort_order,
    is_active: true,
  });

  throwIfDbError(error);
  revalidateVehicleChecks(undefined, input.templateId);
}

export async function updateVehicleCheckTemplateItem(input: {
  id: string;
  label: string;
  helpText?: string;
  checkType?: VehicleCheckType | null;
  fieldType?: VehicleCheckFieldType | null;
}) {
  await requireRole(["admin"]);
  const label = input.label.trim();
  if (!label) throw new Error("Label is required.");

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("vehicle_check_template_items")
    .select("row_kind, template_id")
    .eq("id", input.id)
    .maybeSingle();

  throwIfDbError(fetchError);
  if (!existing) throw new Error("Template row not found.");

  const patch: {
    label: string;
    help_text?: string;
    check_type?: VehicleCheckType | null;
    field_type?: VehicleCheckFieldType | null;
  } = { label };
  if (existing.row_kind === "item") {
    if (!input.checkType) throw new Error("Daily or Weekly is required for checklist items.");
    if (!input.fieldType) throw new Error("Field type is required for checklist items.");
    patch.check_type = input.checkType;
    patch.field_type = input.fieldType;
    if (input.helpText !== undefined) {
      patch.help_text = input.helpText.trim();
    }
  } else {
    patch.check_type = null;
    patch.field_type = null;
    patch.help_text = "";
  }

  const { error } = await supabase
    .from("vehicle_check_template_items")
    .update(patch)
    .eq("id", input.id);

  throwIfDbError(error);
  revalidateVehicleChecks(undefined, existing.template_id);
}

export async function setVehicleCheckTemplateItemActive(input: {
  id: string;
  isActive: boolean;
}) {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("vehicle_check_template_items")
    .select("template_id")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(fetchError);

  const { error } = await supabase
    .from("vehicle_check_template_items")
    .update({ is_active: input.isActive })
    .eq("id", input.id);

  throwIfDbError(error);
  revalidateVehicleChecks(undefined, existing?.template_id);
}

export async function deleteVehicleCheckTemplateItem(id: string) {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("vehicle_check_template_items")
    .select("template_id")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(fetchError);

  const { error } = await supabase.from("vehicle_check_template_items").delete().eq("id", id);
  throwIfDbError(error);
  revalidateVehicleChecks(undefined, existing?.template_id);
}

export async function reorderVehicleCheckTemplateItems(input: {
  templateId: string;
  orderedIds: string[];
}) {
  await requireRole(["admin"]);
  if (input.orderedIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (let index = 0; index < input.orderedIds.length; index++) {
    const { error } = await supabase
      .from("vehicle_check_template_items")
      .update({ sort_order: index })
      .eq("id", input.orderedIds[index]!)
      .eq("template_id", input.templateId);
    throwIfDbError(error);
  }

  revalidateVehicleChecks(undefined, input.templateId);
}

export type SubmitVehicleCheckInput = {
  assetId: string;
  includesDaily: boolean;
  includesWeekly: boolean;
  checkedAt?: string | null;
  notes?: string;
  responses: Array<{
    templateItemId: string;
    result?: VehicleCheckItemResult | null;
    levelValue?: VehicleCheckLevel | null;
    textValue?: string;
    notes?: string;
  }>;
};

export async function submitVehicleCheck(input: SubmitVehicleCheckInput) {
  const profile = await requireUserProfile();
  if (!input.includesDaily && !input.includesWeekly) {
    throw new Error("Select Daily Check, Weekly Check, or both.");
  }

  const supabase = await createSupabaseServerClient();

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, kind, apparatus_type, vehicle_check_template_id")
    .eq("id", input.assetId)
    .maybeSingle();

  throwIfDbError(assetError);
  if (!asset) throw new Error("Apparatus not found.");
  if (asset.kind !== "apparatus") {
    throw new Error("Vehicle checks can only be logged on apparatus.");
  }

  const resolved = await resolveVehicleCheckTemplate(supabase, {
    apparatus_type: asset.apparatus_type,
    vehicle_check_template_id: asset.vehicle_check_template_id,
  });
  if (!resolved) {
    throw new Error("No checklist assigned for this unit.");
  }

  const types: VehicleCheckType[] = [];
  if (input.includesDaily) types.push("daily");
  if (input.includesWeekly) types.push("weekly");

  const { data: templateRows, error: templateError } = await supabase
    .from("vehicle_check_template_items")
    .select("id, row_kind, check_type, field_type, label, sort_order, is_active")
    .eq("template_id", resolved.template.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  throwIfDbError(templateError);

  const responseByTemplateId = new Map(
    input.responses.map((r) => [r.templateItemId, r] as const)
  );

  let sectionTitle: string | null = null;
  const activeItems: Array<{
    id: string;
    check_type: VehicleCheckType;
    field_type: VehicleCheckFieldType;
    label: string;
    sort_order: number;
    section_title: string | null;
  }> = [];

  for (const row of templateRows ?? []) {
    if (row.row_kind === "section") {
      sectionTitle = row.label;
      continue;
    }
    if (!row.check_type || !types.includes(row.check_type as VehicleCheckType)) continue;
    if (!row.field_type) continue;
    activeItems.push({
      id: row.id,
      check_type: row.check_type as VehicleCheckType,
      field_type: row.field_type as VehicleCheckFieldType,
      label: row.label,
      sort_order: row.sort_order,
      section_title: sectionTitle,
    });
  }

  if (activeItems.length === 0) {
    throw new Error("No checklist items are configured for the selected check type(s).");
  }

  for (const item of activeItems) {
    const response = responseByTemplateId.get(item.id);
    if (!response) {
      throw new Error(`Missing answer for "${item.label}".`);
    }
    if (item.field_type === "pass_fail") {
      if (response.result !== "pass" && response.result !== "fail") {
        throw new Error(`Select Pass or Fail for "${item.label}".`);
      }
    } else if (item.field_type === "level") {
      if (!response.levelValue) {
        throw new Error(`Select a level for "${item.label}".`);
      }
    } else if (item.field_type === "short_answer") {
      if (!response.textValue?.trim()) {
        throw new Error(`Enter an answer for "${item.label}".`);
      }
    }
  }

  const checkedAt = input.checkedAt?.trim()
    ? new Date(`${input.checkedAt.trim()}T12:00:00`).toISOString()
    : new Date().toISOString();

  const { data: check, error: checkError } = await supabase
    .from("vehicle_checks")
    .insert({
      asset_id: input.assetId,
      checked_at: checkedAt,
      checked_by: profile.id,
      includes_daily: input.includesDaily,
      includes_weekly: input.includesWeekly,
      notes: input.notes?.trim() ?? "",
    })
    .select("id")
    .single();

  throwIfDbError(checkError);

  const rows = activeItems.map((item) => {
    const response = responseByTemplateId.get(item.id)!;
    if (item.field_type === "pass_fail") {
      return {
        vehicle_check_id: check!.id,
        check_type: item.check_type,
        label: item.label,
        section_title: item.section_title,
        sort_order: item.sort_order,
        field_type: item.field_type,
        result: response.result!,
        level_value: null,
        text_value: "",
        notes: response.notes?.trim() ?? "",
      };
    }
    if (item.field_type === "level") {
      return {
        vehicle_check_id: check!.id,
        check_type: item.check_type,
        label: item.label,
        section_title: item.section_title,
        sort_order: item.sort_order,
        field_type: item.field_type,
        result: null,
        level_value: response.levelValue!,
        text_value: "",
        notes: response.notes?.trim() ?? "",
      };
    }
    return {
      vehicle_check_id: check!.id,
      check_type: item.check_type,
      label: item.label,
      section_title: item.section_title,
      sort_order: item.sort_order,
      field_type: item.field_type,
      result: null,
      level_value: null,
      text_value: response.textValue!.trim(),
      notes: response.notes?.trim() ?? "",
    };
  });

  const { error: responsesError } = await supabase
    .from("vehicle_check_responses")
    .insert(rows);

  throwIfDbError(responsesError);
  revalidateVehicleChecks(input.assetId);
}
