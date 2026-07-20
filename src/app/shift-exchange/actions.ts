"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingShiftExchangeTable, supabaseErrorMessage } from "@/lib/supabase/errors";
import type { ShiftExchangeCategory } from "@/lib/shift-exchange-types";
import { shiftColorForShiftDay } from "@/lib/shift-rotation";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingShiftExchangeTable(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260720120000_shift_exchange_requests.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateStation(stationLabel: string) {
  const match = stationLabel.match(/(\d+)/);
  if (match) {
    revalidatePath(`/shift-exchange/station/${match[1]}`);
  }
  revalidatePath("/shift-exchange");
}

export async function createShiftExchangeRequest(input: {
  category: ShiftExchangeCategory;
  stationLabel: string;
  shiftDate: string; // YYYY-MM-DD
  requestNotes: string;
}) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("shift_exchange_requests").insert({
    category: input.category,
    shift_color: shiftColorForShiftDay(input.shiftDate),
    shift_date: input.shiftDate,
    station_or_unit: input.stationLabel,
    request_notes: input.requestNotes ?? "",
  });

  throwIfDbError(error);
  revalidateStation(input.stationLabel);
}

export async function resolveShiftExchangeRequest(input: { id: string; resolvedNote?: string }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shift_exchange_requests")
    .update({
      status: "resolved",
      resolved_note: input.resolvedNote ?? null,
    })
    .eq("id", input.id);

  throwIfDbError(error);
  revalidatePath("/shift-exchange", "layout");
}
