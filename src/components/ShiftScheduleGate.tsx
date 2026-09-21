import { getClientShiftSchedule } from "@/lib/shift-schedule-server";
import { ShiftScheduleProvider } from "@/components/ShiftScheduleProvider";

/** Loads department shift schedule into client context for calendars and labels. */
export async function ShiftScheduleGate({ children }: { children: React.ReactNode }) {
  const config = await getClientShiftSchedule();
  return <ShiftScheduleProvider config={config}>{children}</ShiftScheduleProvider>;
}
