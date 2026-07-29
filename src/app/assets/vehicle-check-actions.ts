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
import { resolveVehicleCheckTemplateForUnit } from "@/lib/vehicle-checks";
import type {
  VehicleCheckFieldType,
  VehicleCheckItemResult,
  VehicleCheckLevel,
  VehicleChecklistKind,
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

function revalidateVehicleCheckAssets(...assetIds: Array<string | null | undefined>) {
  const seen = new Set<string>();
  for (const id of assetIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    revalidatePath(`/assets/${id}`);
  }
  revalidatePath("/assets", "layout");
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
  checklistKind?: VehicleChecklistKind;
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

  const checklistKind = input.checklistKind ?? "check";
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("vehicle_check_templates")
    .insert({
      name,
      apparatus_type: apparatusType,
      is_type_default: isTypeDefault,
      checklist_kind: checklistKind,
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
  checklistKind?: VehicleChecklistKind;
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

  const checklistKind = input.checklistKind ?? "check";
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("vehicle_check_templates")
    .select("checklist_kind")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!existing) throw new Error("Template not found.");

  const { error } = await supabase
    .from("vehicle_check_templates")
    .update({
      name,
      apparatus_type: apparatusType,
      is_type_default: isTypeDefault,
      checklist_kind: checklistKind,
      notes: input.notes?.trim() ?? "",
    })
    .eq("id", input.id);

  throwIfDbError(error);

  if (existing.checklist_kind !== checklistKind) {
    if (checklistKind === "swap") {
      const { error: clearTypeError } = await supabase
        .from("vehicle_check_template_items")
        .update({ check_type: null })
        .eq("template_id", input.id)
        .eq("row_kind", "item");
      throwIfDbError(clearTypeError);

      const { error: convertError } = await supabase
        .from("vehicle_check_template_items")
        .update({ field_type: "moved_status" })
        .eq("template_id", input.id)
        .eq("row_kind", "item")
        .eq("field_type", "pass_fail");
      throwIfDbError(convertError);
    } else {
      const { error: convertError } = await supabase
        .from("vehicle_check_template_items")
        .update({ field_type: "pass_fail", check_type: "daily" })
        .eq("template_id", input.id)
        .eq("row_kind", "item")
        .eq("field_type", "moved_status");
      throwIfDbError(convertError);

      const { error: fillTypeError } = await supabase
        .from("vehicle_check_template_items")
        .update({ check_type: "daily" })
        .eq("template_id", input.id)
        .eq("row_kind", "item")
        .is("check_type", null);
      throwIfDbError(fillTypeError);
    }
  }

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
    .from("asset_vehicle_check_templates")
    .select("asset_id", { count: "exact", head: true })
    .eq("template_id", id);
  throwIfDbError(countError);
  if ((count ?? 0) > 0) {
    throw new Error("Reassign units that use this template before deleting it.");
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
  checkType?: VehicleCheckType | null;
  fieldType: VehicleCheckFieldType;
  label: string;
  helpText?: string;
  isMandatory?: boolean;
}) {
  await requireRole(["admin"]);
  const label = input.label.trim();
  if (!label) throw new Error("Label is required.");

  const supabase = await createSupabaseServerClient();

  const { data: template, error: templateError } = await supabase
    .from("vehicle_check_templates")
    .select("checklist_kind")
    .eq("id", input.templateId)
    .maybeSingle();
  throwIfDbError(templateError);
  if (!template) throw new Error("Template not found.");

  const isCheck = template.checklist_kind === "check";
  const checkType = isCheck ? (input.checkType ?? "daily") : null;
  if (isCheck && !checkType) {
    throw new Error("Check type is required for check templates.");
  }
  const fieldType = input.fieldType;
  if (isCheck && fieldType === "moved_status") {
    throw new Error("Moved / Not moved is only available on Swap templates.");
  }
  if (!isCheck && fieldType === "pass_fail") {
    throw new Error("Pass / Fail is only available on Check templates.");
  }

  const sort_order = await nextSortOrder(supabase, input.templateId);

  const { error } = await supabase.from("vehicle_check_template_items").insert({
    template_id: input.templateId,
    row_kind: "item",
    check_type: checkType,
    field_type: input.fieldType,
    label,
    help_text: input.helpText?.trim() ?? "",
    sort_order,
    is_active: true,
    is_mandatory: Boolean(input.isMandatory),
  });

  throwIfDbError(error);
  revalidateVehicleChecks(undefined, input.templateId);
}

export async function setVehicleCheckTemplateItemMandatory(input: {
  id: string;
  isMandatory: boolean;
}) {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("vehicle_check_template_items")
    .select("template_id, row_kind")
    .eq("id", input.id)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!existing) throw new Error("Template row not found.");
  if (existing.row_kind !== "item") {
    throw new Error("Only checklist items can be marked mandatory.");
  }

  const { error } = await supabase
    .from("vehicle_check_template_items")
    .update({ is_mandatory: input.isMandatory })
    .eq("id", input.id);

  throwIfDbError(error);
  revalidateVehicleChecks(undefined, existing.template_id);
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
    .select("row_kind, template_id, vehicle_check_templates!inner(checklist_kind)")
    .eq("id", input.id)
    .maybeSingle();

  throwIfDbError(fetchError);
  if (!existing) throw new Error("Template row not found.");

  const templateMeta = existing.vehicle_check_templates as
    | { checklist_kind: VehicleChecklistKind }
    | { checklist_kind: VehicleChecklistKind }[]
    | null;
  const checklistKind = Array.isArray(templateMeta)
    ? templateMeta[0]?.checklist_kind
    : templateMeta?.checklist_kind;
  const isCheck = checklistKind === "check";

  const patch: {
    label: string;
    help_text?: string;
    check_type?: VehicleCheckType | null;
    field_type?: VehicleCheckFieldType | null;
  } = { label };
  if (existing.row_kind === "item") {
    if (isCheck && !input.checkType) {
      throw new Error("Daily or Weekly is required for checklist items.");
    }
    if (!input.fieldType) throw new Error("Field type is required for checklist items.");
    if (isCheck && input.fieldType === "moved_status") {
      throw new Error("Moved / Not moved is only available on Swap templates.");
    }
    if (!isCheck && input.fieldType === "pass_fail") {
      throw new Error("Pass / Fail is only available on Check templates.");
    }
    patch.check_type = isCheck ? input.checkType ?? null : null;
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
  templateId: string;
  includesDaily: boolean;
  includesWeekly: boolean;
  checkedAt?: string | null;
  notes?: string;
  swapDestinationAssetId?: string | null;
  responses: Array<{
    templateItemId: string;
    /** Present for items added during this check (not from the template). */
    adhocLabel?: string;
    adhocSectionTitle?: string | null;
    adhocFieldType?: VehicleCheckFieldType;
    result?: VehicleCheckItemResult | null;
    levelValue?: VehicleCheckLevel | null;
    textValue?: string;
    notes?: string;
  }>;
};

export async function submitVehicleCheck(input: SubmitVehicleCheckInput) {
  const profile = await requireUserProfile();

  const supabase = await createSupabaseServerClient();

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, kind, apparatus_type")
    .eq("id", input.assetId)
    .maybeSingle();

  throwIfDbError(assetError);
  if (!asset) throw new Error("Apparatus not found.");
  if (asset.kind !== "apparatus") {
    throw new Error("Vehicle checks can only be logged on apparatus.");
  }

  const resolved = await resolveVehicleCheckTemplateForUnit(
    supabase,
    { id: asset.id, apparatus_type: asset.apparatus_type },
    input.templateId
  );
  if (!resolved) {
    throw new Error("This checklist is not assigned to this unit.");
  }

  const usesDailyWeekly = resolved.template.checklist_kind === "check";
  if (usesDailyWeekly && !input.includesDaily && !input.includesWeekly) {
    throw new Error("Select Daily Check, Weekly Check, or both.");
  }

  let swapDestinationAssetId: string | null = null;
  if (!usesDailyWeekly) {
    const destinationId = input.swapDestinationAssetId?.trim() || null;
    if (!destinationId) {
      throw new Error("Select a swap destination unit.");
    }
    if (destinationId === input.assetId) {
      throw new Error("Swap destination must be a different unit.");
    }

    const { data: destination, error: destinationError } = await supabase
      .from("assets")
      .select("id, kind, apparatus_type")
      .eq("id", destinationId)
      .maybeSingle();
    throwIfDbError(destinationError);
    if (!destination || destination.kind !== "apparatus") {
      throw new Error("Swap destination must be an apparatus unit.");
    }
    if (
      asset.apparatus_type &&
      destination.apparatus_type !== asset.apparatus_type
    ) {
      throw new Error("Swap destination must be the same apparatus type.");
    }
    swapDestinationAssetId = destination.id;
  }

  const types: VehicleCheckType[] = [];
  if (usesDailyWeekly) {
    if (input.includesDaily) types.push("daily");
    if (input.includesWeekly) types.push("weekly");
  }

  const { data: templateRows, error: templateError } = await supabase
    .from("vehicle_check_template_items")
    .select("id, row_kind, check_type, field_type, label, sort_order, is_active, is_mandatory")
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
    check_type: VehicleCheckType | null;
    field_type: VehicleCheckFieldType;
    label: string;
    sort_order: number;
    section_title: string | null;
    is_mandatory: boolean;
  }> = [];

  for (const row of templateRows ?? []) {
    if (row.row_kind === "section") {
      sectionTitle = row.label;
      continue;
    }
    if (!row.field_type) continue;
    if (usesDailyWeekly) {
      if (!row.check_type || !types.includes(row.check_type as VehicleCheckType)) continue;
    }
    activeItems.push({
      id: row.id,
      check_type: (row.check_type as VehicleCheckType | null) ?? null,
      field_type: row.field_type as VehicleCheckFieldType,
      label: row.label,
      sort_order: row.sort_order,
      section_title: sectionTitle,
      is_mandatory: row.is_mandatory ?? false,
    });
  }

  function responseAnswered(
    fieldType: VehicleCheckFieldType,
    response:
      | {
          result?: VehicleCheckItemResult | null;
          levelValue?: VehicleCheckLevel | null;
          textValue?: string;
        }
      | undefined
  ) {
    if (!response) return false;
    if (fieldType === "pass_fail") {
      return response.result === "pass" || response.result === "fail";
    }
    if (fieldType === "moved_status") {
      return (
        response.result === "moved" ||
        response.result === "not_moved" ||
        response.result === "not_applicable"
      );
    }
    if (fieldType === "level") return Boolean(response.levelValue);
    if (fieldType === "short_answer") return Boolean(response.textValue?.trim());
    return false;
  }

  type AnswerRow = {
    id: string;
    check_type: VehicleCheckType | null;
    field_type: VehicleCheckFieldType;
    label: string;
    sort_order: number;
    section_title: string | null;
    is_mandatory: boolean;
  };

  const answeredItems: AnswerRow[] = activeItems.filter((item) => {
    const response = responseByTemplateId.get(item.id);
    const answered = responseAnswered(item.field_type, response);
    if (item.is_mandatory && !answered) {
      throw new Error(`Missing answer for "${item.label}".`);
    }
    return answered;
  });

  const adhocResponses = input.responses.filter((r) => r.templateItemId.startsWith("adhoc:"));
  let adhocSort = (templateRows?.length ?? 0) + 1;
  for (const response of adhocResponses) {
    const label = response.adhocLabel?.trim();
    if (!label) throw new Error("Added items need a label.");
    const fieldType = response.adhocFieldType ?? "moved_status";
    if (!responseAnswered(fieldType, response)) {
      throw new Error(`Missing answer for "${label}".`);
    }
    answeredItems.push({
      id: response.templateItemId,
      check_type: null,
      field_type: fieldType,
      label,
      sort_order: adhocSort++,
      section_title: response.adhocSectionTitle ?? null,
      is_mandatory: false,
    });
  }

  if (activeItems.length === 0 && adhocResponses.length === 0) {
    throw new Error(
      usesDailyWeekly
        ? "No checklist items are configured for the selected check type(s)."
        : "No checklist items are configured for this template."
    );
  }

  if (answeredItems.length === 0) {
    throw new Error("Answer at least one checklist item before submitting.");
  }

  const checkedAt = input.checkedAt?.trim()
    ? new Date(`${input.checkedAt.trim()}T12:00:00`).toISOString()
    : new Date().toISOString();

  const { data: check, error: checkError } = await supabase
    .from("vehicle_checks")
    .insert({
      asset_id: input.assetId,
      template_id: resolved.template.id,
      checked_at: checkedAt,
      checked_by: profile.id,
      includes_daily: usesDailyWeekly ? input.includesDaily : false,
      includes_weekly: usesDailyWeekly ? input.includesWeekly : false,
      notes: input.notes?.trim() ?? "",
      swap_destination_asset_id: swapDestinationAssetId,
    })
    .select("id")
    .single();

  throwIfDbError(checkError);

  const rows = answeredItems.map((item) => {
    const response = responseByTemplateId.get(item.id)!;
    if (item.field_type === "pass_fail" || item.field_type === "moved_status") {
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

  revalidateVehicleChecks(input.assetId, resolved.template.id);
  if (swapDestinationAssetId) {
    revalidateVehicleCheckAssets(swapDestinationAssetId);
    revalidatePath(`/assets/${swapDestinationAssetId}/vehicle-checks/${check!.id}`);
  }

  return { checkId: check!.id as string };
}

export async function resolveVehicleCheckResponse(input: {
  responseId: string;
  assetId: string;
}) {
  const profile = await requireUserProfile();
  const supabase = await createSupabaseServerClient();

  const { data: response, error: fetchError } = await supabase
    .from("vehicle_check_responses")
    .select("id, vehicle_check_id, field_type, result, level_value, resolved_at")
    .eq("id", input.responseId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!response) throw new Error("Checklist response not found.");
  if (response.resolved_at) return;

  const isFail = response.field_type === "pass_fail" && response.result === "fail";
  const isLowLevel =
    response.field_type === "level" &&
    Boolean(response.level_value && response.level_value !== "full");
  if (!isFail && !isLowLevel) {
    throw new Error("Only fails and levels below Full can be marked resolved.");
  }

  const { data: check, error: checkError } = await supabase
    .from("vehicle_checks")
    .select("id, asset_id, swap_destination_asset_id")
    .eq("id", response.vehicle_check_id)
    .maybeSingle();
  throwIfDbError(checkError);
  if (
    !check ||
    (check.asset_id !== input.assetId &&
      check.swap_destination_asset_id !== input.assetId)
  ) {
    throw new Error("Checklist response does not belong to this apparatus.");
  }

  const { error } = await supabase
    .from("vehicle_check_responses")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    })
    .eq("id", input.responseId);
  throwIfDbError(error);

  revalidateVehicleChecks(input.assetId);
  revalidateVehicleCheckAssets(check.asset_id, check.swap_destination_asset_id);
}

export async function setVehicleCheckResponseReturnStatus(input: {
  responseId: string;
  assetId: string;
  returnStatus: "moved_back" | "not_moved_back";
  returnDestinationAssetId?: string | null;
}) {
  const profile = await requireUserProfile();
  const supabase = await createSupabaseServerClient();

  const { data: response, error: fetchError } = await supabase
    .from("vehicle_check_responses")
    .select(
      "id, vehicle_check_id, field_type, result, label, section_title, sort_order, notes, check_type"
    )
    .eq("id", input.responseId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!response) throw new Error("Checklist response not found.");
  if (response.field_type !== "moved_status" || response.result !== "moved") {
    throw new Error("Only Moved items can be marked moved back or not moved back.");
  }

  const { data: check, error: checkError } = await supabase
    .from("vehicle_checks")
    .select("id, asset_id, swap_destination_asset_id, template_id, parent_vehicle_check_id")
    .eq("id", response.vehicle_check_id)
    .maybeSingle();
  throwIfDbError(checkError);
  if (
    !check ||
    (check.asset_id !== input.assetId &&
      check.swap_destination_asset_id !== input.assetId)
  ) {
    throw new Error("Checklist response does not belong to this apparatus.");
  }
  if (check.parent_vehicle_check_id) {
    throw new Error("Return events cannot be updated from a moved-back history row.");
  }

  let returnDestinationAssetId: string | null = null;
  if (input.returnStatus === "moved_back") {
    const destinationId = input.returnDestinationAssetId?.trim() || null;
    if (!destinationId) {
      throw new Error("Select which unit this item moved back to.");
    }

    const { data: destination, error: destinationError } = await supabase
      .from("assets")
      .select("id, kind")
      .eq("id", destinationId)
      .maybeSingle();
    throwIfDbError(destinationError);
    if (!destination || destination.kind !== "apparatus") {
      throw new Error("Return destination must be an apparatus unit.");
    }
    returnDestinationAssetId = destination.id;
  }

  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("vehicle_check_responses")
    .update({
      return_status: input.returnStatus,
      return_destination_asset_id: returnDestinationAssetId,
      resolved_at: input.returnStatus === "moved_back" ? nowIso : null,
      resolved_by: input.returnStatus === "moved_back" ? profile.id : null,
    })
    .eq("id", input.responseId);
  throwIfDbError(error);

  // Keep a separate history row for moved-back events (one per destination per day).
  const { data: existingReturnResponses, error: existingReturnError } = await supabase
    .from("vehicle_check_responses")
    .select("id, vehicle_check_id")
    .eq("source_response_id", response.id);
  throwIfDbError(existingReturnError);

  for (const existing of existingReturnResponses ?? []) {
    const { error: deleteResponseError } = await supabase
      .from("vehicle_check_responses")
      .delete()
      .eq("id", existing.id);
    throwIfDbError(deleteResponseError);

    const { count, error: countError } = await supabase
      .from("vehicle_check_responses")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_check_id", existing.vehicle_check_id);
    throwIfDbError(countError);

    if ((count ?? 0) === 0) {
      const { error: deleteCheckError } = await supabase
        .from("vehicle_checks")
        .delete()
        .eq("id", existing.vehicle_check_id)
        .not("parent_vehicle_check_id", "is", null);
      throwIfDbError(deleteCheckError);
    }
  }

  if (input.returnStatus === "moved_back" && returnDestinationAssetId) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const { data: returnChecks, error: returnChecksError } = await supabase
      .from("vehicle_checks")
      .select("id")
      .eq("parent_vehicle_check_id", check.id)
      .eq("swap_destination_asset_id", returnDestinationAssetId)
      .gte("checked_at", dayStart.toISOString())
      .lt("checked_at", dayEnd.toISOString())
      .order("checked_at", { ascending: false })
      .limit(1);
    throwIfDbError(returnChecksError);

    let returnCheckId = returnChecks?.[0]?.id ?? null;

    if (!returnCheckId) {
      const { data: createdReturn, error: createReturnError } = await supabase
        .from("vehicle_checks")
        .insert({
          asset_id: input.assetId,
          template_id: check.template_id,
          checked_at: nowIso,
          checked_by: profile.id,
          includes_daily: false,
          includes_weekly: false,
          notes: "",
          swap_destination_asset_id: returnDestinationAssetId,
          parent_vehicle_check_id: check.id,
        })
        .select("id")
        .single();
      throwIfDbError(createReturnError);
      returnCheckId = createdReturn!.id;
    } else {
      const { error: touchError } = await supabase
        .from("vehicle_checks")
        .update({
          checked_at: nowIso,
          checked_by: profile.id,
        })
        .eq("id", returnCheckId);
      throwIfDbError(touchError);
    }

    const { error: insertReturnResponseError } = await supabase
      .from("vehicle_check_responses")
      .insert({
        vehicle_check_id: returnCheckId,
        check_type: response.check_type,
        label: response.label,
        section_title: response.section_title,
        sort_order: response.sort_order,
        field_type: "moved_status",
        result: "moved",
        level_value: null,
        text_value: "",
        notes: response.notes ?? "",
        return_status: "moved_back",
        return_destination_asset_id: returnDestinationAssetId,
        resolved_at: nowIso,
        resolved_by: profile.id,
        source_response_id: response.id,
      });
    throwIfDbError(insertReturnResponseError);

    revalidatePath(`/assets/${input.assetId}/vehicle-checks/${returnCheckId}`);
    revalidatePath(`/assets/${returnDestinationAssetId}/vehicle-checks/${returnCheckId}`);
  }

  revalidateVehicleChecks(input.assetId);
  revalidateVehicleCheckAssets(
    check.asset_id,
    check.swap_destination_asset_id,
    returnDestinationAssetId
  );
  revalidatePath(`/assets/${check.asset_id}/vehicle-checks/${check.id}`);
  if (check.swap_destination_asset_id) {
    revalidatePath(
      `/assets/${check.swap_destination_asset_id}/vehicle-checks/${check.id}`
    );
  }
}
