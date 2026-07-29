import type { PostgrestError } from "@supabase/supabase-js";

export function isMissingTrainingLmsTables(error: PostgrestError | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("profiles") ||
    error.message.includes("Could not find the table")
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
    error.message.includes("Could not find the table")
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

export function supabaseErrorMessage(error: PostgrestError) {
  return error.message || `Database error (${error.code})`;
}
