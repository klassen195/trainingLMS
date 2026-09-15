import { notFound, redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingShiftPlanTable, supabaseErrorMessage } from "@/lib/supabase/errors";
import { listLocations } from "@/lib/locations";
import {
  currentShiftDayStartIso,
  isIsoDateString,
  shiftDayStartForCalendarDate,
} from "@/lib/dates";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { MissingProfileSetup } from "@/components/MissingProfileSetup";
import { ShiftPlanDatabaseSetup } from "@/components/ShiftPlanDatabaseSetup";
import { ShiftPlanBoard } from "@/components/ShiftPlanBoard";
import {
  SHIFT_PLAN_ITEM_SELECT,
  compareShiftPlanItems,
  parseShiftPlanItems,
} from "@/lib/shift-plan-types";

export default async function ShiftPlanShiftPage({
  params,
}: {
  params: Promise<{ shiftDate: string }>;
}) {
  const auth = await getAuthContext();
  if (auth.kind === "unauthenticated") redirect("/login");
  if (auth.kind === "missing_tables") return <DatabaseSetup />;
  if (auth.kind === "missing_profile") return <MissingProfileSetup userId={auth.userId} />;
  await requireCapability("access_shift_plan");

  const { shiftDate: raw } = await params;
  if (!isIsoDateString(raw)) notFound();
  const shiftDate = shiftDayStartForCalendarDate(raw);
  if (shiftDate !== raw) redirect(`/shift-plan/${shiftDate}`);

  const supabase = await createSupabaseServerClient();
  const [{ rows: locations, error: locationsError }, itemsRes] = await Promise.all([
    listLocations(supabase, { activeOnly: true, shiftPlanOnly: true }),
    supabase
      .from("shift_plan_items")
      .select(SHIFT_PLAN_ITEM_SELECT)
      .eq("shift_date", shiftDate)
      .order("item_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true }),
  ]);

  if (itemsRes.error) {
    if (isMissingShiftPlanTable(itemsRes.error)) return <ShiftPlanDatabaseSetup />;
    throw new Error(supabaseErrorMessage(itemsRes.error));
  }
  if (locationsError) throw new Error(locationsError.message);

  const items = parseShiftPlanItems(itemsRes.data).sort(compareShiftPlanItems);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Shift Plan</h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          What is on the plan for this 48-hour shift. Battalion items apply everywhere; stations add their own.
        </p>
      </div>

      <ShiftPlanBoard
        shiftDate={shiftDate}
        currentShiftDate={currentShiftDayStartIso()}
        items={items}
        locations={locations}
      />
    </div>
  );
}
