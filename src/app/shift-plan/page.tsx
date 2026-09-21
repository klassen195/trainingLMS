import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/capability-access";
import { currentShiftDayStartIso } from "@/lib/dates";
import { getClientShiftSchedule } from "@/lib/shift-schedule-server";

export default async function ShiftPlanIndexPage() {
  await requireCapability("access_shift_plan");
  const schedule = await getClientShiftSchedule();
  redirect(`/shift-plan/${currentShiftDayStartIso(new Date(), schedule)}`);
}
