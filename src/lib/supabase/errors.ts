import type { PostgrestError } from "@supabase/supabase-js";

export function isMissingTrainingLmsTables(error: PostgrestError | null) {
  if (!error) return false;
  if (error.code === "PGRST205") return true;
  const message = error.message;
  if (message.includes("Could not find a relationship")) return false;
  return (
    message.includes("Could not find the table") ||
    /could not find the ['`]?profiles['`]? table/i.test(message)
  );
}

export function isMissingShiftExchangeTable(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("shift_exchange_requests") ||
    error.message.includes("Could not find the table")
  );
}

export function isMissingAssetsTable(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("assets") ||
    error.message.includes("asset_inspections") ||
    error.message.includes("equipment_categories") ||
    error.message.includes("equipment_subcategories") ||
    error.message.includes("equipment_category_id") ||
    error.message.includes("equipment_subcategory_id") ||
    error.message.includes("Could not find the table") ||
    (error.message.includes("Could not find the") && error.message.includes("column"))
  );
}

export function isMissingVehicleChecksTable(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("vehicle_checks") ||
    error.message.includes("vehicle_check_templates") ||
    error.message.includes("vehicle_check_template_items") ||
    error.message.includes("vehicle_check_responses") ||
    error.message.includes("Could not find the table")
  );
}

export function isMissingLocationsTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("locations") ?? false) ||
    (error.message?.includes("Could not find the table") ?? false)
  );
}

export function isMissingEquipmentCategoriesTable(
  error: { code?: string; message?: string } | null
) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("equipment_categories") ?? false) ||
    (error.message?.includes("Could not find the table") ?? false)
  );
}

export function isMissingEquipmentSubcategoriesTable(
  error: { code?: string; message?: string } | null
) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("equipment_subcategories") ?? false) ||
    (error.message?.includes("Could not find the table") ?? false)
  );
}

export function isMissingMaintenanceSchedulesTable(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("asset_maintenance_schedules") ||
    error.message.includes("Could not find the table")
  );
}

export function isMissingMaintenanceRequestsTable(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("maintenance_requests") ||
    error.message.includes("assigned_to") ||
    error.message.includes("shop_status") ||
    error.message.includes("shop_notes") ||
    error.message.includes("Could not find the table") ||
    (error.message.includes("Could not find the") && error.message.includes("column"))
  );
}

export function isMissingPersonnelTables(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("personnel_certifications") ||
    error.message.includes("personnel_documents") ||
    error.message.includes("personnel_notes") ||
    error.message.includes("personnel_taskbooks") ||
    error.message.includes("personnel_taskbook_prerequisite_checks") ||
    error.message.includes("personnel_recognitions") ||
    error.message.includes("personnel_qualifications") ||
    error.message.includes("personnel_ems_licenses") ||
    error.message.includes("ems_levels") ||
    error.message.includes("ems_clearance_levels") ||
    error.message.includes("ems_cleared_level_id") ||
    error.message.includes("anniversary") ||
    error.message.includes("spouse_name") ||
    error.message.includes("spouse_birthday") ||
    error.message.includes("kids_birthdays") ||
    error.message.includes("employee_number") ||
    error.message.includes("Could not find the table") ||
    (error.message.includes("Could not find the") && error.message.includes("column"))
  );
}

export function isMissingTrainingSessionsTable(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("training_sessions") ||
    error.message.includes("training_session_attendees") ||
    error.message.includes("training_session_files") ||
    error.message.includes("training_session_days") ||
    error.message.includes("Could not find the table")
  );
}

export function isMissingTrainingCategoriesTable(
  error: { code?: string; message?: string } | null
) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("training_categories") ?? false) ||
    (error.message?.includes("Could not find the table") ?? false)
  );
}

export function isMissingQualificationsTable(
  error: { code?: string; message?: string } | null
) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("qualifications") ?? false) ||
    (error.message?.includes("personnel_qualifications") ?? false) ||
    (error.message?.includes("Could not find the table") ?? false)
  );
}

export function isMissingEmsLevelsTable(
  error: { code?: string; message?: string } | null
) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("ems_levels") ?? false) ||
    (error.message?.includes("personnel_ems_licenses") ?? false) ||
    (error.message?.includes("Could not find the table") ?? false)
  );
}

export function isMissingEmsClearanceLevelsTable(
  error: { code?: string; message?: string } | null
) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("ems_clearance_levels") ?? false) ||
    (error.message?.includes("ems_cleared_level_id") ?? false) ||
    (error.message?.includes("Could not find the table") ?? false)
  );
}

export function isMissingHomeDashboardTables(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("home_dashboard_layouts") ||
    error.message.includes("client_ops_settings") ||
    error.message.includes("Could not find the table")
  );
}

export function isMissingApprovalTrackerTables(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("approval_documents") ||
    error.message.includes("approval_stage_members") ||
    error.message.includes("approval_document_holders") ||
    error.message.includes("approval_document_events") ||
    error.message.includes("Could not find the table")
  );
}

export function supabaseErrorMessage(error: PostgrestError) {
  return error.message || `Database error (${error.code})`;
}
