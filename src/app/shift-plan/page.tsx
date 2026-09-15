import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/capability-access";
import { currentShiftDayStartIso } from "@/lib/dates";

export default async function ShiftPlanIndexPage() {
  await requireCapability("access_shift_plan");
  redirect(`/shift-plan/${currentShiftDayStartIso()}`);
}
